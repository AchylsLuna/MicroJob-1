import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { getPostAuthLandingPath } from "../utils/dashboardRoutes";
import { LAYER_Z } from "./ui/layers";

interface OTPVerificationProps {
  onClose: () => void;
  email: string;
  // "signin" drives login-OTP verification (server-issued challenge, trusted
  // device option) instead of the signup email-verification flow.
  mode?: "signup" | "signin";
}

export function OTPVerification({ onClose, email, mode = "signup" }: OTPVerificationProps) {
  const { t } = useTranslation("auth");
  const { verifyOTP, resendOTP, verifyLoginOtpCode, resendLoginOtpCode, devVerificationCode } = useAuth();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const verifyInFlightRef = useRef(false);
  const [isResending, setIsResending] = useState(false);
  const resendInFlightRef = useRef(false);
  const [countdown, setCountdown] = useState(60);
  const [rememberDevice, setRememberDevice] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setCountdown(60);
    setIsResending(false);
    resendInFlightRef.current = false;
  }, [email]);

  const applyOtpDigits = (startIndex: number, digits: string) => {
    const nextOtp = [...otp];
    let index = startIndex;

    for (const digit of digits) {
      if (index > 5) break;
      nextOtp[index] = digit;
      index += 1;
    }

    setOtp(nextOtp);

    const lastIndex = Math.min(startIndex + digits.length - 1, 5);
    inputRefs.current[lastIndex]?.focus();

    if (!nextOtp.some((item) => !item)) {
      handleVerify(nextOtp.join(""));
    }
  };

  const handleChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "");

    if (!digits) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    if (digits.length > 1) {
      applyOtpDigits(index, digits);
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);

    // Auto-focus next input
    if (digits && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (index === 5 && digits) {
      const fullOtp = newOtp.join("");
      handleVerify(fullOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split("").forEach((char, index) => {
      if (index < 6) {
        newOtp[index] = char;
      }
    });
    setOtp(newOtp);

    // Focus last filled input or submit
    const lastIndex = Math.min(pastedData.length - 1, 5);
    inputRefs.current[lastIndex]?.focus();

    if (pastedData.length === 6) {
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (otpCode: string) => {
    if (verifyInFlightRef.current) {
      return;
    }
    verifyInFlightRef.current = true;
    setIsVerifying(true);

    try {
      if (mode === "signin") {
        const loggedInUser = await verifyLoginOtpCode(otpCode, rememberDevice, { suppressToast: true });
        const destination =
          sessionStorage.getItem("post_verify_redirect") || getPostAuthLandingPath(loggedInUser);
        sessionStorage.removeItem("post_verify_redirect");
        // Use hard redirect immediately to avoid route-guard/modal state races.
        window.location.replace(destination);
        return;
      }

      const success = await verifyOTP(otpCode);
      let nextUser: unknown = null;
      try {
        const storedUserRaw =
          localStorage.getItem("auth_user") || localStorage.getItem("current_user");
        if (storedUserRaw) {
          nextUser = JSON.parse(storedUserRaw);
        }
      } catch {
        nextUser = null;
      }

      const hasSessionUser = Boolean(
        localStorage.getItem("auth_user") || localStorage.getItem("current_user"),
      );

      if (success || (hasSessionUser && nextUser && typeof nextUser === "object")) {
        // Signup verification now lands straight in the app instead of
        // bouncing back to sign-in for a second login + OTP -- the server
        // already minted a session when the code was verified.
        const computedDestination = getPostAuthLandingPath(
          nextUser && typeof nextUser === "object" ? (nextUser as any) : null,
        );
        const destination = sessionStorage.getItem("post_verify_redirect") || computedDestination;
        sessionStorage.removeItem("post_verify_redirect");
        // Use hard redirect immediately to avoid route-guard/modal state races.
        window.location.replace(destination);
        return;
      } else {
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      inputRefs.current[0]?.focus();
    } finally {
      verifyInFlightRef.current = false;
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resendInFlightRef.current) {
      return;
    }

    resendInFlightRef.current = true;
    setIsResending(true);
    setCountdown(60);

    try {
      if (mode === "signin") {
        await resendLoginOtpCode();
      } else {
        await resendOTP();
      }
    } finally {
      resendInFlightRef.current = false;
      setIsResending(false);
    }
  };

  const handleSubmit = () => {
    const otpCode = otp.join("");
    if (otpCode.length === 6) {
      handleVerify(otpCode);
    }
  };

  // Portalled to <body> and on the modal rung, for the reasons spelled out on
  // `ui/index.tsx`'s Dialog: `position: fixed` is only viewport-relative while
  // no ancestor establishes a containing block, and at `z-50` this sat under
  // the navbar (60) and the cookie banner (90) -- so a first-time visitor
  // signing in got the banner painted across the code entry.
  //
  // The panel caps its own height and scrolls internally. Centring a flex
  // child taller than its container overflows in *both* directions, and this
  // dialog is tall enough to do that on a 375px-high landscape phone: the
  // close button left the top edge with nothing to scroll it back.
  return createPortal(
    <div className={`fixed inset-0 ${LAYER_Z.modal} flex items-center justify-center bg-black/50 p-4`}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="otp-verification-title"
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-[24px] bg-white p-5 animate-in fade-in zoom-in duration-200 sm:p-8"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-[#9CA3AF] hover:text-[#111827] transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <h2 id="otp-verification-title" className="text-[28px] font-bold text-[#111827] text-center mt-2 mb-3">
          {t("otpVerification.title")}
        </h2>
        <p className="text-body text-[#6B7280] text-center mb-8">
          {t("otpVerification.description")}<br />
          <span className="font-semibold text-[#111827]">{email}</span>
        </p>

        {/* Development only. `UserController.sendOtp` returns the code in the
            response on every non-production request, whether or not SMTP is
            configured -- and the client used to drop it, which made sign-up
            impossible to finish locally the moment mail stopped arriving.
            Nothing renders here in production because the server sends no
            code to render. */}
        {devVerificationCode ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-caption font-semibold uppercase tracking-wide text-amber-800">
              {t("otpVerification.devCode.label")}
            </p>
            <p className="mt-1 text-[22px] font-bold tracking-[0.3em] text-amber-900">{devVerificationCode}</p>
            <button
              type="button"
              onClick={() => {
                const digits = devVerificationCode.replace(/\D/g, "").slice(0, 6).split("");
                if (digits.length === 6) {
                  setOtp(digits);
                  inputRefs.current[5]?.focus();
                }
              }}
              className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-amber-300 bg-white px-4 text-body-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {t("otpVerification.devCode.fill")}
            </button>
          </div>
        ) : null}

        {/* OTP Inputs */}
        <div className="mb-8 flex justify-center gap-2 sm:gap-3">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              maxLength={1}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\\d*"
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isVerifying}
              // Six 56px boxes plus gaps need 396px, but a 375px phone leaves
              // only 279px inside this modal's padding -- the boxes shrank to
              // ~36px there and ~20px on a 280px foldable while the digit
              // stayed at 24px, so it no longer fit its own box and the targets
              // fell well under the 44px minimum. Scale the boxes and the type
              // together, and only take the full size once there is room.
              className="h-12 w-10 shrink-0 rounded-xl border-2 border-[#E5E7EB] text-center text-lg font-bold transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-gray-50 sm:h-[64px] sm:w-[56px] sm:text-[24px]"
            />
          ))}
        </div>

        {/* Centred to match the rest of the dialog -- the heading, code boxes,
            button and resend line are all centre-aligned, so a left-aligned row
            here was the only thing breaking that axis. `items-center` rather
            than `items-start` because the label is a single line. */}
        {mode === "signin" && (
          <label className="mb-6 flex cursor-pointer items-center justify-center gap-2.5">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              disabled={isVerifying}
              className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-brand focus:ring-2 focus:ring-brand"
            />
            <span className="text-body text-[#374151]">
              {t("otpVerification.trustDevice")}
            </span>
          </label>
        )}

        {/* Verify Button */}
        <button
          onClick={handleSubmit}
          disabled={otp.some(d => !d) || isVerifying}
          className="brand-primary-interactive mb-6 w-full rounded-xl py-4 font-semibold hover:shadow-lg"
        >
          {isVerifying ? t("otpVerification.submitLoading") : t("otpVerification.submit")}
        </button>

        {/* Resend */}
        <div className="text-center">
          {countdown === 0 && !isResending ? (
            <button
              onClick={handleResend}
              disabled={isResending}
              className="mx-auto flex items-center justify-center gap-2 text-body font-semibold text-brand hover:opacity-80"
            >
              <RefreshCw className="w-4 h-4" />
              {t("otpVerification.resend")}
            </button>
          ) : (
            <p className="text-body text-[#6B7280]">
              {t("otpVerification.resendPrompt")}{" "}
              <span className="font-semibold text-[#111827]">
                {t("otpVerification.resendCountdown", { count: countdown })}
              </span>
            </p>
          )}
        </div>

        <div className="mt-6 p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
          <p className="text-caption text-[#6B7280] text-center">
            {t("otpVerification.footerHint")}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
