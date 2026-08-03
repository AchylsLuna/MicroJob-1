import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { sendOtp } from "../services/api";
import { getDefaultDashboardPath } from "../utils/dashboardRoutes";
import { ROUTES } from "../utils/routes";

const EmailVerification: React.FC = () => {
  const navigate = useNavigate();
  const { verifyOTP, resendOTP, user } = useAuth();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSent, setHasSent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [email] = useState(() => localStorage.getItem("pending_verification_email") || "");

  const getStoredUser = () => {
    try {
      const raw = localStorage.getItem("auth_user") || localStorage.getItem("current_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!email || hasSent) {
      return;
    }

    let isCancelled = false;
    const sendCode = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        await sendOtp({ email });
        if (!isCancelled) {
          setHasSent(true);
          localStorage.setItem("pending_verification_email", email);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage("Failed to send verification code. Please try again.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    sendCode();

    return () => {
      isCancelled = true;
    };
  }, [email, hasSent]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    const otpCode = otp.join("");

    if (!email) {
      setErrorMessage("Missing email for verification. Please sign in again.");
      return;
    }

    if (otpCode.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit code.");
      return;
    }

    setIsLoading(true);
    try {
      const success = await verifyOTP(otpCode);
      if (!success) {
        setErrorMessage("Invalid verification code. Please try again.");
        return;
      }

      const targetUser = user || getStoredUser();
      const fallbackDestination = getDefaultDashboardPath(targetUser);
      const destination = sessionStorage.getItem("post_verify_redirect") || fallbackDestination;
      sessionStorage.removeItem("post_verify_redirect");
      window.location.replace(destination);
    } catch {
      setErrorMessage("Invalid verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setErrorMessage("Missing email for verification. Please sign in again.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    try {
      await resendOTP();
      setOtp(["", "", "", "", "", ""]);
    } catch {
      setErrorMessage("Failed to resend verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate(ROUTES.signIn);
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1C4D8D] p-4 page-transition">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-3">Email Required</h2>
            <p className="text-center text-gray-600 text-sm mb-6">
              Please sign in again to receive a verification code.
            </p>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="brand-primary-interactive w-full rounded-xl py-3 font-semibold"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1C4D8D] p-4 page-transition">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <button
            onClick={handleBackToLogin}
            className="mb-6 flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#1C4D8D] flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Verify Email</h2>
          <p className="text-center text-gray-500 text-sm mb-2">
            {hasSent ? "We've sent a 6-digit code to" : "Sending a 6-digit code to"}
          </p>
          <p className="text-center text-gray-700 font-medium mb-8">{email}</p>

          <form onSubmit={handleOtpSubmit}>
            <div className="flex justify-center gap-2 mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
                />
              ))}
            </div>

            {errorMessage && (
              <p className="mt-2 mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 text-center">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || otp.join("").length !== 6}
              className="brand-primary-interactive mb-4 w-full rounded-xl py-3 font-semibold"
            >
              {isLoading ? "Verifying..." : "Verify Code"}
            </button>

            <div className="text-center">
              <span className="text-gray-600 text-sm">Didn't receive the code? </span>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-[#1C4D8D] font-medium hover:underline disabled:opacity-50"
              >
                Resend Code
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
