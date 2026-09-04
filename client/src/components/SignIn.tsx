import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../lib/toast";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getPostAuthLandingPath } from "../utils/dashboardRoutes";
import { getPostSignInPath } from "../utils/authRedirects";
import { isCredentialLoginError } from "../utils/authSession";
import { isValidEmail, normalizeEmail } from "../lib/authValidation";
import { ROUTES } from "../utils/routes";
import { OTPVerification } from "./OTPVerification";
import { MfaLoginForm } from "./auth/MfaLoginForm";
import {
  AuthShell,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "./auth/AuthShell";
import { AuthDivider, GoogleButton } from "./auth/GoogleButton";
import { PasswordField } from "./auth/PasswordField";

export function SignIn() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user, mfaChallenge, verifyMfaLogin, cancelMfaLogin } = useAuth();
  const landingPath = getPostAuthLandingPath(user);
  const [email, setEmail] = useState("");
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const successMessage = (location.state as { message?: string } | null)?.message;
  const rawFrom = (location.state as { from?: unknown } | null)?.from;
  const redirectPath = getPostSignInPath(rawFrom, landingPath);
  // Validated separately with an empty-string fallback: this is staged into
  // sessionStorage for the OTP step below, so "no legitimate destination" must
  // be distinguishable from "the default dashboard" rather than defaulting to it.
  const validatedFrom = getPostSignInPath(rawFrom, "");

  const getSignInFailureMessage = (error: unknown) => {
    const message = String((error as { message?: unknown } | null)?.message || "").trim();
    const normalizedMessage = message.toLowerCase();

    if (/invalid email|email.*invalid|valid email/.test(normalizedMessage)) {
      return t("signIn.toast.emailInvalid");
    }
    if (/(?:no account|account.*not found|email.*not found|does not exist)/.test(normalizedMessage)) {
      return t("signIn.toast.accountNotFound");
    }
    if (/incorrect password|password.*incorrect/.test(normalizedMessage)) {
      return t("signIn.toast.incorrectPassword");
    }
    if (isCredentialLoginError(message)) {
      return t("signIn.toast.credentialsIncorrect");
    }
    if (/network|failed to fetch|unable to connect|connection|timeout/.test(normalizedMessage)) {
      return t("signIn.toast.networkError");
    }
    return t("signIn.toast.signInFailed");
  };

  if (!isLoading && isAuthenticated && user?.role) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const password = passwordInputRef.current?.value || "";

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1";
    const isSecureContext =
      window.isSecureContext || window.location.protocol === "https:" || isLocalhost;

    if (!isSecureContext) {
      toast.error(t("signIn.toast.secureConnectionRequired"));
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      toast.error(t("signIn.toast.fillAllFields"));
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      toast.error(t("signIn.toast.emailInvalid"));
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(normalizedEmail, password, { suppressToast: true, requireOtp: true });
      if (result.status === "mfa_required") {
        toast.info(t("signIn.toast.mfaCodePrompt"));
      } else if (result.status === "otp_required") {
        // Stage the bookmarked destination now, before OTP entry -- AuthContext's
        // verifyOTP only fills in the default dashboard when nothing is staged.
        // Always write (clearing when there's nothing to stage) so an abandoned
        // OTP attempt from an earlier "from" can't leak into this one.
        if (validatedFrom) {
          sessionStorage.setItem("post_verify_redirect", validatedFrom);
        } else {
          sessionStorage.removeItem("post_verify_redirect");
        }
        setShowOTP(true);
        toast.success(t("signIn.toast.otpSent"));
      }
    } catch (error: any) {
      toast.error(getSignInFailureMessage(error));
    } finally {
      if (passwordInputRef.current) {
        passwordInputRef.current.value = "";
      }
      setIsLoading(false);
    }
  };

  const handleMfaSignIn = async (code: string) => {
    setIsLoading(true);
    try {
      await verifyMfaLogin(code);
    } catch (error: any) {
      toast.error(error?.message || t("signIn.toast.mfaVerificationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate(ROUTES.forgotPassword);
  };

  return (
    <>
      <AuthShell
        title={t("signIn.title")}
        subtitle={t("signIn.subtitle")}
        backTo={ROUTES.home}
        backLabel={t("signIn.backToHome")}
        banner={
          successMessage ? (
            <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="font-semibold">{t("signIn.successBanner.title")}</p>
              <p className="text-[14px]">{successMessage}</p>
            </div>
          ) : null
        }
        footer={
          <>
            {t("signIn.signUpPrompt.text")}{" "}
            <button
              type="button"
              onClick={() => navigate(ROUTES.signUp)}
              className="font-semibold text-[#1C4D8D] hover:opacity-80"
            >
              {t("signIn.signUpPrompt.action")}
            </button>
          </>
        }
      >
        <GoogleButton />

        <div className="my-6">
          <AuthDivider />
        </div>

        <form onSubmit={handleSignIn} className="space-y-5" noValidate>
          <div>
            <label htmlFor="signin-email" className={authLabelClass}>
              {t("signIn.form.emailLabel")}
            </label>
            <input
              id="signin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("signIn.form.emailPlaceholder")}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className={authFieldClass}
            />
          </div>

          <PasswordField
            id="signin-password"
            label={t("signIn.form.passwordLabel")}
            placeholder={t("signIn.form.passwordPlaceholder")}
            autoComplete="current-password"
            inputRef={passwordInputRef}
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
            showLabel={t("signIn.form.showPassword")}
            hideLabel={t("signIn.form.hidePassword")}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-5 w-5 cursor-pointer rounded border-slate-300 text-[#1C4D8D] focus:ring-2 focus:ring-[#1C4D8D]"
              />
              <span className="text-[14px] text-slate-600">{t("signIn.form.rememberMe")}</span>
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[14px] font-semibold text-[#1C4D8D] hover:opacity-80"
            >
              {t("signIn.form.forgotPassword")}
            </button>
          </div>

          <button type="submit" className={authPrimaryButtonClass}>
            {isLoading ? t("signIn.form.submitLoading") : t("signIn.form.submit")}
          </button>
        </form>
      </AuthShell>

      {showOTP && (
        <OTPVerification
          email={email}
          onClose={() => setShowOTP(false)}
        />
      )}

      {mfaChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={t("signIn.mfaModal.ariaLabel")}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <MfaLoginForm
              email={mfaChallenge.email}
              method={mfaChallenge.method}
              isLoading={isLoading}
              onSubmit={handleMfaSignIn}
              onCancel={() => {
                cancelMfaLogin();
                setIsLoading(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
