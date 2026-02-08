import { useState, useRef, useEffect } from "react";
import { X, Mail, RefreshCw } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface OTPVerificationProps {
  onClose: () => void;
  email: string;
}

export function OTPVerification({ onClose, email }: OTPVerificationProps) {
  const { verifyOTP, resendOTP } = useAuth();
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
    setIsVerifying(true);
    
    try {
      const success = await verifyOTP(otpCode);
      if (success) {
        onClose();
        navigate("/dashboard");
      } else {
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    
    await resendOTP();
    setCanResend(false);
    setCountdown(60);
  };

  const handleSubmit = () => {
    const otpCode = otp.join("");
    if (otpCode.length === 6) {
      handleVerify(otpCode);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[24px] max-w-[480px] w-full p-8 relative animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-[#9CA3AF] hover:text-[#111827] transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-white" />
        </div>

        {/* Header */}
        <h2 className="text-[28px] font-bold text-[#111827] text-center mb-3">
          Verify your email
        </h2>
        <p className="text-[14px] text-[#6B7280] text-center mb-8">
          We've sent a 6-digit verification code to<br />
          <span className="font-semibold text-[#111827]">{email}</span>
        </p>

        {/* OTP Inputs */}
        <div className="flex justify-center gap-3 mb-8">
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
              className="w-[56px] h-[64px] text-center text-[24px] font-bold border-2 border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all disabled:bg-gray-50"
            />
          ))}
        </div>

        {/* Verify Button */}
        <button
          onClick={handleSubmit}
          disabled={otp.some(d => !d) || isVerifying}
          className="w-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold py-4 rounded-[12px] hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {isVerifying ? "Verifying..." : "Verify Code"}
        </button>

        {/* Resend */}
        <div className="text-center">
          {canResend ? (
            <button
              onClick={handleResend}
              className="text-[14px] text-[#1C4D8D] hover:text-[#0F2954] font-semibold flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Resend code
            </button>
          ) : (
            <p className="text-[14px] text-[#6B7280]">
              Didn't receive the code?{" "}
              <span className="font-semibold text-[#111827]">
                Resend in {countdown}s
              </span>
            </p>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB]">
          <p className="text-[12px] text-[#6B7280] text-center">
            💡 <span className="font-semibold">Development Mode:</span> Check your browser console for the OTP code
          </p>
        </div>
      </div>
    </div>
  );
}
