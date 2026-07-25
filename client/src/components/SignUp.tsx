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

const SIGN_UP_DRAFT_KEY = "signup_draft_v1";

type SignUpDraft = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  userType: "employer" | "worker" | "both";
  agreeToTerms: boolean;
};

export function SignUp() {
  const navigate = useNavigate();
  const { register, isAuthenticated, user } = useAuth();
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
  const [successMessage, setSuccessMessage] = useState("");
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

  useEffect(() => {
    const raw = sessionStorage.getItem(SIGN_UP_DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Partial<SignUpDraft>;
      setFormData({
        fullName: String(draft.fullName || ""),
        email: String(draft.email || ""),
        phone: String(draft.phone || ""),
        password: String(draft.password || ""),
        confirmPassword: String(draft.confirmPassword || ""),
      });
      if (draft.userType === "employer" || draft.userType === "worker" || draft.userType === "both") {
        setUserType(draft.userType);
      }
      setAgreeToTerms(Boolean(draft.agreeToTerms));
    } catch {
      sessionStorage.removeItem(SIGN_UP_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    const draft: SignUpDraft = {
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      userType,
      agreeToTerms,
    };
    sessionStorage.setItem(SIGN_UP_DRAFT_KEY, JSON.stringify(draft));
  }, [formData, userType, agreeToTerms]);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      sessionStorage.removeItem(SIGN_UP_DRAFT_KEY);
      navigate(getDefaultDashboardPath(user), { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

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
      sessionStorage.removeItem(SIGN_UP_DRAFT_KEY);
      const nextMessage = "Verification code sent. Please verify your email to continue.";
      setSuccessMessage(nextMessage);
      toast.success(nextMessage);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] flex items-center justify-center px-6 py-10 lg:py-14">
      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
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
          {successMessage ? (
            <div className="mb-6 rounded-[16px] border border-[#86efac] bg-[#f0fdf4] p-4 text-[#166534]">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Registration successful</p>
                  <p className="text-[14px]">{successMessage}</p>
                </div>
              </div>
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
                  placeholder="Enter PH mobile number (09XXXXXXXXX)"
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

      {showOTP && (
        <OTPVerification
          email={normalizedEmail}
          onClose={() => setShowOTP(false)}
        />
      )}

    </div>
  );
}
