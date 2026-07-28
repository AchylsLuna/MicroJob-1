import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, Shield, CheckCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../lib/toast";
import { ROUTES } from "../utils/routes";

export function ForgotPassword() {
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const openResetPasswordTab = () => {
    const url = `${window.location.origin}${ROUTES.resetPassword}`;
    const newTab = window.open(url, "_blank", "noopener,noreferrer");
    if (!newTab) {
      // Fallback if the browser blocks popups.
      navigate(ROUTES.resetPassword);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setEmailSent(true);
    } catch (error: any) {
      const message = String(error?.message || "Failed to send reset link");
      if (/not registered|not found|user not found/i.test(message)) {
        toast.error("Email is not registered or not found.");
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] flex items-center justify-center p-6">
        <div className="w-full max-w-[480px] bg-white rounded-[24px] shadow-2xl p-8 lg:p-10">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-[#10B981]" />
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-[28px] font-bold text-[#111827] mb-3">Check Your Email</h1>
            <p className="text-[14px] text-[#6B7280] leading-relaxed">
              We've sent a password reset code to<br />
              <span className="font-semibold text-[#111827]">{email}</span>
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-[#F9FAFB] rounded-[12px] p-4 border border-[#E5E7EB] mb-6">
            <p className="text-[13px] text-[#6B7280] mb-3">
              <span className="font-semibold text-[#111827]">Next steps:</span>
            </p>
            <ol className="text-[13px] text-[#6B7280] space-y-2 list-decimal list-inside">
              <li>Check your email inbox (and spam folder)</li>
              <li>Click the reset link or copy the 6-digit code</li>
              <li>Enter the code on the reset password page</li>
              <li>Create a new password</li>
            </ol>
          </div>

          {/* Dev Mode Helper */}
          <div className="bg-[#FEF3C7] rounded-[12px] p-4 border border-[#FDE68A] mb-6">
            <p className="text-[12px] text-[#92400E] text-center">
              💡 <span className="font-semibold">Development Mode:</span> Check your browser console for the reset code
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={openResetPasswordTab}
              className="w-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold py-4 px-6 rounded-[12px] hover:shadow-xl transition-all duration-300"
            >
              Open Change Password Tab
            </button>
            
            <button
              onClick={() => navigate(ROUTES.signIn)}
              className="w-full bg-white border border-[#E5E7EB] text-[#111827] font-semibold py-4 px-6 rounded-[12px] hover:bg-[#F9FAFB] transition-colors"
            >
              Back to Sign In
            </button>
          </div>

          {/* Resend */}
          <div className="mt-6 text-center">
            <p className="text-[13px] text-[#6B7280]">
              Didn't receive the email?{" "}
              <button
                onClick={handleSubmit}
                className="text-[#1C4D8D] hover:text-[#0F2954] font-semibold"
              >
                Resend
              </button>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] flex items-center justify-center p-6">
      <div className="w-full max-w-[480px] bg-white rounded-[24px] shadow-2xl p-8 lg:p-10">
        {/* Back Button */}
        <button
          onClick={() => navigate(ROUTES.signIn)}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] text-[14px] font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-[28px] font-bold text-[#111827] mb-3">Forgot Password?</h1>
          <p className="text-[14px] text-[#6B7280]">
            No worries! Enter your email address and we'll send you a reset code.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Input */}
          <div>
            <label htmlFor="forgot-email" className="text-[14px] font-medium text-[#111827] mb-2 block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-4 py-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold py-4 px-6 rounded-[12px] hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Sending..." : "Send Reset Code"}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB]">
          <p className="text-[12px] text-[#6B7280] text-center">
            Remember your password?{" "}
            <button
              onClick={() => navigate(ROUTES.signIn)}
              className="text-[#1C4D8D] hover:text-[#0F2954] font-semibold"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
