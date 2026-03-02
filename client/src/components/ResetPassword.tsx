import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../lib/toast";
import { getPasswordStrength, PASSWORD_RULES, STRONG_PASSWORD_ERROR } from "../lib/passwordPolicy";
import { ROUTES } from "../utils/routes";

export function ResetPassword() {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [resetCode, setResetCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const showPasswordStrength = Boolean(newPassword || confirmPassword);
  const passwordStrength = getPasswordStrength(newPassword);
  const confirmPasswordHasError = Boolean(confirmPassword) && newPassword !== confirmPassword;

  const strengthTextColor =
    passwordStrength.score <= 2
      ? "text-[#F97316]"
      : passwordStrength.score === 3
        ? "text-[#EAB308]"
        : "text-[#10B981]";

  const strengthBarColor =
    passwordStrength.score <= 2
      ? "bg-[#F97316]"
      : passwordStrength.score === 3
        ? "bg-[#EAB308]"
        : "bg-[#10B981]";

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...resetCode];
    newCode[index] = value;
    setResetCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !resetCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    
    if (!/^\d+$/.test(pastedData)) return;

    const newCode = [...resetCode];
    pastedData.split("").forEach((char, index) => {
      if (index < 6) {
        newCode[index] = char;
      }
    });
    setResetCode(newCode);

    const lastIndex = Math.min(pastedData.length - 1, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = resetCode.join("");
    
    if (code.length !== 6) {
      toast.error("Please enter the 6-digit reset code");
      return;
    }

    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (!passwordStrength.isStrong) {
      toast.error(STRONG_PASSWORD_ERROR);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(code, newPassword);
      setResetSuccess(true);
      toast.success("Password reset successful!");
      
      // Redirect to sign in after 2 seconds
      setTimeout(() => {
        navigate(ROUTES.signIn);
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
      setResetCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] flex items-center justify-center p-6">
        <div className="w-full max-w-[480px] bg-white rounded-[24px] shadow-2xl p-8 lg:p-10">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-300">
            <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-[28px] font-bold text-[#111827] mb-3">Password Reset!</h2>
            <p className="text-[14px] text-[#6B7280] leading-relaxed">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
          </div>

          {/* Redirect Message */}
          <div className="bg-[#F9FAFB] rounded-[12px] p-4 border border-[#E5E7EB] text-center">
            <p className="text-[13px] text-[#6B7280]">
              Redirecting to sign in page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] bg-white rounded-[24px] shadow-2xl p-8 lg:p-10">
        {/* Back Button */}
        <button
          onClick={() => navigate(ROUTES.forgotPassword)}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] text-[14px] font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-[28px] font-bold text-[#111827] mb-3">Reset Password</h2>
          <p className="text-[14px] text-[#6B7280]">
            Enter the 6-digit code sent to your email and create a new password
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Reset Code */}
          <div>
            <label className="text-[14px] font-medium text-[#111827] mb-3 block">
              Reset Code
            </label>
            <div className="flex justify-center gap-3 mb-2">
              {resetCode.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={isLoading}
                  className="w-[48px] h-[56px] text-center text-[20px] font-bold border-2 border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all disabled:bg-gray-50"
                />
              ))}
            </div>
            <p className="text-[12px] text-[#6B7280] text-center">
              Check your browser console for the code in dev mode
            </p>
          </div>

          {/* New Password */}
          <div>
            <label className="text-[14px] font-medium text-[#111827] mb-2 block">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={isLoading}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-12 py-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-[14px] font-medium text-[#111827] mb-2 block">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={isLoading}
                aria-invalid={confirmPasswordHasError}
                className={`w-full bg-[#F9FAFB] border rounded-[12px] pl-12 pr-12 py-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:border-transparent transition-all ${
                  confirmPasswordHasError
                    ? "border-[#EF4444] focus:ring-[#EF4444]"
                    : "border-[#E5E7EB] focus:ring-[#1C4D8D]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPasswordHasError && (
              <p className="mt-2 text-[12px] text-[#EF4444]">Passwords do not match</p>
            )}
          </div>

          {/* Password Requirements */}
          {showPasswordStrength && (
            <div className="bg-[#F9FAFB] rounded-[12px] p-4 border border-[#E5E7EB] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-[#111827]">Password Strength</p>
                <span className={`text-[12px] font-semibold ${strengthTextColor}`}>{passwordStrength.label}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                <div
                  className={`h-full ${strengthBarColor} transition-all duration-300`}
                  style={{ width: `${passwordStrength.percent}%` }}
                />
              </div>
              <ul className="space-y-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const met = passwordStrength.checks[rule.key];
                  return (
                    <li
                      key={rule.key}
                      className={`text-[12px] flex items-center gap-2 ${met ? "text-[#10B981]" : "text-[#6B7280]"}`}
                    >
                      {met ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {rule.label}
                    </li>
                  );
                })}
                <li
                  className={`text-[12px] flex items-center gap-2 ${
                    confirmPassword
                      ? confirmPasswordHasError
                        ? "text-[#EF4444]"
                        : "text-[#10B981]"
                      : "text-[#6B7280]"
                  }`}
                >
                  {confirmPassword && !confirmPasswordHasError ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  Passwords match
                </li>
              </ul>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold py-4 px-6 rounded-[12px] hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Resetting Password..." : "Reset Password"}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-[13px] text-[#6B7280]">
            Didn't receive a code?{" "}
            <button
              onClick={() => navigate(ROUTES.forgotPassword)}
              className="text-[#1C4D8D] hover:text-[#0F2954] font-semibold"
            >
              Request new code
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
