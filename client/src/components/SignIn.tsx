import { useRef, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Award, Users, TrendingUp, ArrowLeft } from "lucide-react";
import { toast } from "../lib/toast";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getDefaultDashboardPath } from "../utils/dashboardRoutes";
import { ROUTES } from "../utils/routes";
import { MicroJobsLogo } from "./MicroJobsLogo";
import { OTPVerification } from "./OTPVerification";

export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuth();
  const dashboardPath = getDefaultDashboardPath(user);
  const [email, setEmail] = useState("");
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const successMessage = (location.state as { message?: string } | null)?.message;

  if (!isLoading && isAuthenticated && user?.role) {
    return <Navigate to={dashboardPath} replace />;
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
      toast.error("Secure connection required. Please use HTTPS.");
      return;
    }

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password, { suppressToast: true, requireOtp: true });
      setShowOTP(true);
      toast.success("OTP sent to your email. Please verify to continue.");
    } catch (error: any) {
      toast.error(error.message || "Sign in failed");
    } finally {
      if (passwordInputRef.current) {
        passwordInputRef.current.value = "";
      }
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate(ROUTES.forgotPassword);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] flex items-center justify-center px-6 py-10 lg:py-14">
      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding */}
        <div className="text-white space-y-8 flex flex-col justify-start">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <MicroJobsLogo variant="light" className="[&>span]:text-[32px] [&>span]:font-bold" />
            </div>
            
            <h2 className="text-[28px] font-bold leading-tight">
              Connect with Top Talent<br />& Rewarding Opportunities
            </h2>
            <p className="text-[16px] opacity-90 leading-relaxed">
              Join thousands of professionals finding their dream jobs and companies discovering exceptional talent.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-[16px] border border-white/20">
              <div className="w-12 h-12 rounded-[12px] bg-white/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold mb-1">Verified Professionals</h3>
                <p className="text-[14px] opacity-80">Connect with verified companies and job seekers</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-[16px] border border-white/20">
              <div className="w-12 h-12 rounded-[12px] bg-white/20 flex items-center justify-center flex-shrink-0">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold mb-1">Quality Matches</h3>
                <p className="text-[14px] opacity-80">Find the perfect match for your skills and needs</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-[16px] border border-white/20">
              <div className="w-12 h-12 rounded-[12px] bg-white/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold mb-1">Career Growth</h3>
                <p className="text-[14px] opacity-80">Access opportunities that advance your career</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Sign In Form */}
        <div className="bg-white rounded-[24px] shadow-2xl p-8 lg:p-10 self-start">
          {successMessage ? (
            <div className="mb-6 rounded-[16px] border border-[#86efac] bg-[#f0fdf4] p-4 text-[#166534]">
              <p className="font-semibold">Success</p>
              <p className="text-[14px]">{successMessage}</p>
            </div>
          ) : null}

          {/* Back Button */}
          <button
            onClick={() => navigate(ROUTES.home)}
            className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#1C4D8D] font-medium mb-6 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>

          <div className="mb-8">
            <h1 className="text-[28px] font-bold text-[#111827] mb-2">Welcome Back!</h1>
            <p className="text-[14px] text-[#6B7280]">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="signin-email" className="text-[14px] font-medium text-[#111827] mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-4 py-3.5 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signin-password" className="text-[14px] font-medium text-[#111827] mb-2 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  id="signin-password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-12 py-3.5 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E5E7EB] text-[#1C4D8D] focus:ring-2 focus:ring-[#1C4D8D] cursor-pointer"
                />
                <span className="text-[14px] text-[#6B7280]">Remember me</span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[14px] text-[#1C4D8D] hover:text-[#0F2954] font-medium"
              >
                Forgot Password?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold py-4 px-6 rounded-[12px] hover:shadow-xl transition-all duration-300"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </button>

          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-[14px] text-[#6B7280]">
              Don't have an account?{" "}
              <button
                onClick={() => navigate(ROUTES.signUp)}
                className="text-[#1C4D8D] hover:text-[#0F2954] font-semibold"
              >
                Sign Up
              </button>
            </p>
          </div>
        </div>
      </div>

      {showOTP && (
        <OTPVerification
          email={email}
          onClose={() => setShowOTP(false)}
        />
      )}

    </main>
  );
}
