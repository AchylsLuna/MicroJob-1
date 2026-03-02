import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff, Phone, Briefcase, Users, Award, TrendingUp, UserPlus, Handshake, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { OTPVerification } from "./OTPVerification";
import { toast } from "../lib/toast";
import { getPasswordStrength, PASSWORD_RULES, STRONG_PASSWORD_ERROR } from "../lib/passwordPolicy";
import {
  EMAIL_VALIDATION_MESSAGE,
  FULL_NAME_VALIDATION_MESSAGE,
  PHONE_DIGITS,
  PHONE_VALIDATION_MESSAGE,
  isValidEmail,
  isValidFullName,
  isValidPhone,
  normalizeEmail,
  normalizeFullName,
  normalizePhone,
  sanitizeFullNameInput,
} from "../lib/authValidation";
import { getDefaultDashboardPath } from "../utils/dashboardRoutes";
import { ROUTES } from "../utils/routes";
import { MicroJobsLogo } from "./MicroJobsLogo";

export function SignUp() {
  const navigate = useNavigate();
  const { register, pendingVerification, isAuthenticated, user } = useAuth();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const [userType, setUserType] = useState<"employer" | "worker" | "both">("both");
  const showPasswordStrength = Boolean(formData.password || formData.confirmPassword);
  const normalizedFullName = normalizeFullName(formData.fullName);
  const normalizedEmail = normalizeEmail(formData.email);
  const normalizedPhone = normalizePhone(formData.phone);
  const fullNameHasError = Boolean(formData.fullName) && !isValidFullName(normalizedFullName);
  const emailHasError = Boolean(formData.email) && !isValidEmail(normalizedEmail);
  const phoneHasError = Boolean(formData.phone) && !isValidPhone(normalizedPhone);
  const passwordStrength = getPasswordStrength(formData.password);
  const confirmPasswordHasError = Boolean(formData.confirmPassword) && formData.password !== formData.confirmPassword;

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

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && !pendingVerification) {
      navigate(getDefaultDashboardPath(user), { replace: true });
    }
  }, [isAuthenticated, pendingVerification, navigate, user]);

  const handleChange = (field: string, value: string) => {
    if (field === "fullName") {
      setFormData({ ...formData, fullName: sanitizeFullNameInput(value) });
      return;
    }
    if (field === "phone") {
      setFormData({ ...formData, phone: normalizePhone(value) });
      return;
    }
    setFormData({ ...formData, [field]: value });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || submitInFlightRef.current) {
      return;
    }
    
    if (!formData.fullName || !formData.email || !formData.password || !formData.confirmPassword) {
      toast.error("Invalid input: Please fill in all required fields.");
      return;
    }

    if (!isValidFullName(normalizedFullName)) {
      toast.error(`Invalid input: ${FULL_NAME_VALIDATION_MESSAGE}`);
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      toast.error(`Invalid input: ${EMAIL_VALIDATION_MESSAGE}`);
      return;
    }

    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      toast.error(`Invalid input: ${PHONE_VALIDATION_MESSAGE}`);
      return;
    }

    if (!passwordStrength.isStrong) {
      toast.error(`Invalid input: ${STRONG_PASSWORD_ERROR}`);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Invalid input: Passwords do not match.");
      return;
    }

    if (!agreeToTerms) {
      toast.error("Please agree to the terms and conditions");
      return;
    }

    try {
      submitInFlightRef.current = true;
      setIsSubmitting(true);
      await register(normalizedEmail, formData.password, normalizedFullName, userType, normalizedPhone);
      setShowOTP(true);
    } catch (error: any) {
      const message = error?.message || "Registration failed";
      const invalidInputMessage = /(invalid|required|must|format|phone|email|password|name|taken|exists)/i.test(
        String(message),
      );
      const normalizedMessage = /^invalid input:/i.test(String(message))
        ? String(message)
        : `Invalid input: ${message}`;
      toast.error(invalidInputMessage ? normalizedMessage : message);
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = () => {
    toast.info("Signing up with Google...");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] flex items-start justify-center px-6 py-8 lg:py-10">
      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Side - Branding */}
        <div className="text-white space-y-8 flex flex-col justify-start">
          <div className="space-y-4">
            <div className="pl-4 mb-6">
              <MicroJobsLogo variant="light" className="[&>span]:text-[32px] [&>span]:font-bold" />
            </div>
            
            <div className="grid grid-cols-[48px_1fr] gap-4 pl-4">
              <div aria-hidden="true" />
              <div>
                <h2 className="text-[28px] font-bold leading-tight">
                  Connect with Top Talent<br />& Rewarding Opportunities
                </h2>
                <p className="text-[16px] opacity-90 leading-relaxed">
                  Join thousands of professionals finding their dream jobs and companies discovering exceptional talent.
                </p>
              </div>
            </div>
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

        {/* Right Side - Sign Up Form */}
        <div className="bg-white rounded-[24px] shadow-2xl p-8 lg:p-10 self-start">
          {/* Back Button */}
          <button
            onClick={() => navigate(ROUTES.home)}
            className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#1C4D8D] font-medium mb-6 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>

          <div className="mb-6">
            <h2 className="text-[28px] font-bold text-[#111827] mb-2">Get Started!</h2>
            <p className="text-[14px] text-[#6B7280]">Create your account to start your journey</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="text-[14px] font-medium text-[#111827] mb-2 block">
                Full Name <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  placeholder="Enter your full name"
                  aria-invalid={fullNameHasError}
                  className={`w-full bg-[#F9FAFB] border rounded-[12px] pl-12 pr-4 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:border-transparent transition-all ${
                    fullNameHasError
                      ? "border-[#EF4444] focus:ring-[#EF4444]"
                      : "border-[#E5E7EB] focus:ring-[#1C4D8D]"
                  }`}
                />
              </div>
              {fullNameHasError && (
                <p className="mt-2 text-[12px] text-[#EF4444]">{FULL_NAME_VALIDATION_MESSAGE}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="text-[14px] font-medium text-[#111827] mb-2 block">
                Email Address <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="Enter your email"
                  aria-invalid={emailHasError}
                  className={`w-full bg-[#F9FAFB] border rounded-[12px] pl-12 pr-4 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:border-transparent transition-all ${
                    emailHasError
                      ? "border-[#EF4444] focus:ring-[#EF4444]"
                      : "border-[#E5E7EB] focus:ring-[#1C4D8D]"
                  }`}
                />
              </div>
              {emailHasError && (
                <p className="mt-2 text-[12px] text-[#EF4444]">{EMAIL_VALIDATION_MESSAGE}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="text-[14px] font-medium text-[#111827] mb-2 block">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  inputMode="numeric"
                  maxLength={PHONE_DIGITS}
                  placeholder={`Enter ${PHONE_DIGITS}-digit phone number`}
                  aria-invalid={phoneHasError}
                  className={`w-full bg-[#F9FAFB] border rounded-[12px] pl-12 pr-4 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:border-transparent transition-all ${
                    phoneHasError
                      ? "border-[#EF4444] focus:ring-[#EF4444]"
                      : "border-[#E5E7EB] focus:ring-[#1C4D8D]"
                  }`}
                />
              </div>
              {phoneHasError && (
                <p className="mt-2 text-[12px] text-[#EF4444]">{PHONE_VALIDATION_MESSAGE}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-[14px] font-medium text-[#111827] mb-2 block">
                Password <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="Create a password"
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-12 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-[14px] font-medium text-[#111827] mb-2 block">
                Confirm Password <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  placeholder="Confirm your password"
                  aria-invalid={confirmPasswordHasError}
                  className={`w-full bg-[#F9FAFB] border rounded-[12px] pl-12 pr-12 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:border-transparent transition-all ${
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
                      formData.confirmPassword
                        ? confirmPasswordHasError
                          ? "text-[#EF4444]"
                          : "text-[#10B981]"
                        : "text-[#6B7280]"
                    }`}
                  >
                    {formData.confirmPassword && !confirmPasswordHasError ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    Passwords match
                  </li>
                </ul>
              </div>
            )}

            {/* I want to selection */}
            <div className="pt-2">
              <label className="text-[14px] font-medium text-[#111827] mb-3 block">
                I want to:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {/* Hire */}
                <button
                  type="button"
                  onClick={() => setUserType("employer")}
                  className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-[12px] border-2 transition-all ${
                    userType === "employer"
                      ? "border-[#1C4D8D] bg-[#F0F7FF]"
                      : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                  }`}
                >
                  <Briefcase className={`w-6 h-6 ${userType === "employer" ? "text-[#1C4D8D]" : "text-[#9CA3AF]"}`} />
                  <span className={`text-[13px] font-semibold ${userType === "employer" ? "text-[#1C4D8D]" : "text-[#6B7280]"}`}>
                    Hire
                  </span>
                </button>

                {/* Work */}
                <button
                  type="button"
                  onClick={() => setUserType("worker")}
                  className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-[12px] border-2 transition-all ${
                    userType === "worker"
                      ? "border-[#1C4D8D] bg-[#F0F7FF]"
                      : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                  }`}
                >
                  <UserPlus className={`w-6 h-6 ${userType === "worker" ? "text-[#1C4D8D]" : "text-[#9CA3AF]"}`} />
                  <span className={`text-[13px] font-semibold ${userType === "worker" ? "text-[#1C4D8D]" : "text-[#6B7280]"}`}>
                    Work
                  </span>
                </button>

                {/* Both */}
                <button
                  type="button"
                  onClick={() => setUserType("both")}
                  className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-[12px] border-2 transition-all ${
                    userType === "both"
                      ? "border-[#1C4D8D] bg-[#F0F7FF]"
                      : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                  }`}
                >
                  <Handshake className={`w-6 h-6 ${userType === "both" ? "text-[#1C4D8D]" : "text-[#9CA3AF]"}`} />
                  <span className={`text-[13px] font-semibold ${userType === "both" ? "text-[#1C4D8D]" : "text-[#6B7280]"}`}>
                    Both
                  </span>
                </button>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="w-4 h-4 rounded border-[#E5E7EB] text-[#1C4D8D] focus:ring-2 focus:ring-[#1C4D8D] cursor-pointer mt-0.5"
              />
              <label className="text-[13px] text-[#6B7280]">
                I agree to the{" "}
                <Link to={ROUTES.terms} className="text-[#1C4D8D] hover:text-[#0F2954] font-medium">
                  Terms and Conditions
                </Link>{" "}
                and{" "}
                <Link to={ROUTES.privacy} className="text-[#1C4D8D] hover:text-[#0F2954] font-medium">
                  Privacy Policy
                </Link>
              </label>
            </div>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold py-4 px-6 rounded-[12px] hover:shadow-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5E7EB]"></div>
              </div>
              <div className="relative flex justify-center text-[13px]">
                <span className="px-4 bg-white text-[#6B7280]">Or sign up with</span>
              </div>
            </div>

            {/* Google Sign Up */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
              className="w-full flex items-center justify-center gap-3 bg-white border border-[#E5E7EB] text-[#111827] font-semibold py-3 px-4 rounded-[12px] hover:bg-[#F9FAFB] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-[14px] text-[#6B7280]">
              Already have an account?{" "}
              <button
                onClick={() => navigate(ROUTES.signIn)}
                className="text-[#1C4D8D] hover:text-[#0F2954] font-semibold"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOTP && pendingVerification && (
        <OTPVerification
          email={pendingVerification.email}
          onClose={() => setShowOTP(false)}
        />
      )}
    </div>
  );
}
