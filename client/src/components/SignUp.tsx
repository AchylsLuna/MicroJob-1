import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff, Phone, Briefcase, UserPlus, Handshake, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { OTPVerification } from "./OTPVerification";
import { toast } from "../lib/toast";
import { getPasswordStrength, PASSWORD_RULES, STRONG_PASSWORD_ERROR } from "../lib/passwordPolicy";
import {
  PHONE_DIGITS,
  getEmailValidationMessage,
  getFullNameValidationMessage,
  getPhoneValidationMessage,
  isValidEmail,
  isValidFullName,
  isValidPhone,
  normalizeEmail,
  normalizeFullName,
  normalizePhone,
  sanitizeFullNameInput,
} from "../lib/authValidation";
import { getPostAuthLandingPath } from "../utils/dashboardRoutes";
import { ROUTES } from "../utils/routes";
import { MicroJobsLogo } from "./MicroJobsLogo";
import { GoogleSignInButton } from "./GoogleSignInButton";

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
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { register, googleSignIn, isAuthenticated, user } = useAuth();
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
      navigate(getPostAuthLandingPath(user), { replace: true });
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
      toast.error(t("validation.invalidInputPrefix", { detail: t("signUp.toast.missingRequiredFieldsDetail") }));
      return;
    }

    if (!isValidFullName(normalizedFullName)) {
      toast.error(t("validation.invalidInputPrefix", { detail: getFullNameValidationMessage(t) }));
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      toast.error(t("validation.invalidInputPrefix", { detail: getEmailValidationMessage(t) }));
      return;
    }

    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      toast.error(t("validation.invalidInputPrefix", { detail: getPhoneValidationMessage(t) }));
      return;
    }

    if (!passwordStrength.isStrong) {
      toast.error(t("validation.invalidInputPrefix", { detail: STRONG_PASSWORD_ERROR }));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error(t("validation.invalidInputPrefix", { detail: t("signUp.toast.passwordsMismatchDetail") }));
      return;
    }

    if (!agreeToTerms) {
      toast.error(t("signUp.toast.agreeToTermsRequired"));
      return;
    }

    try {
      submitInFlightRef.current = true;
      setIsSubmitting(true);
      await register(normalizedEmail, formData.password, normalizedFullName, userType, normalizedPhone);
      sessionStorage.removeItem(SIGN_UP_DRAFT_KEY);
      const nextMessage = t("signUp.toast.registrationSuccess");
      setSuccessMessage(nextMessage);
      toast.success(nextMessage);
      setShowOTP(true);
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      if (/already registered|already exists|email.*taken|email.*exists/.test(message)) {
        toast.error(t("signUp.toast.emailAlreadyRegistered"));
      } else if (/invalid email|email.*invalid|valid email/.test(message)) {
        toast.error(t("signUp.toast.emailInvalid"));
      } else if (/password.*(?:weak|must)|weak password/.test(message)) {
        toast.error(t("signUp.toast.weakPassword"));
      } else if (/network|failed to fetch|unable to connect|connection|timeout/.test(message)) {
        toast.error(t("signUp.toast.networkError"));
      } else {
        toast.error(t("signUp.toast.registrationFailed"));
      }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async (credential: string) => {
    setIsSubmitting(true);
    try {
      const role = userType === "employer" ? "hire" : userType === "worker" ? "work" : "both";
      await googleSignIn(credential, role);
    } catch (error: any) {
      toast.error(error?.message || t("signUp.toast.googleFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#1C4D8D] flex items-start lg:items-center justify-center px-4 py-8 lg:px-6 lg:py-10 overflow-x-hidden">
      <div className="w-full max-w-[1240px] grid grid-cols-1 lg:grid-cols-[0.55fr_0.45fr] gap-10 items-start lg:items-stretch min-w-0">
        {/* Left Side - Branding */}
        <div className="text-white space-y-8 flex flex-col justify-start max-w-full min-w-0 overflow-hidden">
          <div className="space-y-4">
            <div className="mb-6">
              <MicroJobsLogo variant="light" className="[&>span]:text-[32px] [&>span]:font-bold" />
            </div>

            <h2 className="text-[28px] font-bold leading-tight whitespace-pre-line">
              {t("signUp.hero.title")}
            </h2>
            <p className="text-[16px] opacity-90 leading-relaxed">
              {t("signUp.hero.subtitle")}
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-white/10 backdrop-blur-sm rounded-[16px]">
              <div>
                <h3 className="text-[16px] font-semibold mb-1">{t("signUp.hero.features.verified.title")}</h3>
                <p className="text-[14px] opacity-80">{t("signUp.hero.features.verified.description")}</p>
              </div>
            </div>

            <div className="p-4 bg-white/10 backdrop-blur-sm rounded-[16px]">
              <div>
                <h3 className="text-[16px] font-semibold mb-1">{t("signUp.hero.features.quality.title")}</h3>
                <p className="text-[14px] opacity-80">{t("signUp.hero.features.quality.description")}</p>
              </div>
            </div>

            <div className="p-4 bg-white/10 backdrop-blur-sm rounded-[16px]">
              <div>
                <h3 className="text-[16px] font-semibold mb-1">{t("signUp.hero.features.growth.title")}</h3>
                <p className="text-[14px] opacity-80">{t("signUp.hero.features.growth.description")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Sign Up Form */}
        <div className="bg-white rounded-[24px] shadow-2xl p-6 sm:p-8 lg:p-10 w-full max-w-full min-w-0 overflow-hidden max-h-[calc(100vh-4rem)]">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto pr-0 lg:pr-2">
              {successMessage ? (
                <div className="mb-6 rounded-[16px] border border-[#86efac] bg-[#f0fdf4] p-4 text-[#166534]">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">{t("signUp.successBanner.title")}</p>
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
                {t("signUp.backToHome")}
              </button>

              <div className="mb-6">
                <h1 className="text-[28px] font-bold text-[#111827] mb-2">{t("signUp.title")}</h1>
                <p className="text-[14px] text-[#6B7280]">{t("signUp.subtitle")}</p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label htmlFor="signup-full-name" className="text-[14px] font-medium text-[#111827] mb-2 block">
                    {t("signUp.form.fullNameLabel")} <span className="text-[#EF4444]">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                    <input
                      id="signup-full-name"
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => handleChange("fullName", e.target.value)}
                      placeholder={t("signUp.form.fullNamePlaceholder")}
                      aria-invalid={fullNameHasError}
                      className={`w-full bg-[#F9FAFB] border rounded-[12px] pl-12 pr-4 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:border-transparent transition-all ${
                        fullNameHasError
                          ? "border-[#EF4444] focus:ring-[#EF4444]"
                          : "border-[#E5E7EB] focus:ring-[#1C4D8D]"
                      }`}
                    />
                  </div>
                  {fullNameHasError && (
                    <p className="mt-2 text-[12px] text-[#EF4444]">{getFullNameValidationMessage(t)}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="signup-email" className="text-[14px] font-medium text-[#111827] mb-2 block">
                    {t("signUp.form.emailLabel")} <span className="text-[#EF4444]">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                    <input
                      id="signup-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder={t("signUp.form.emailPlaceholder")}
                      aria-invalid={emailHasError}
                      className={`w-full bg-[#F9FAFB] border rounded-[12px] pl-12 pr-4 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:border-transparent transition-all ${
                        emailHasError
                          ? "border-[#EF4444] focus:ring-[#EF4444]"
                          : "border-[#E5E7EB] focus:ring-[#1C4D8D]"
                      }`}
                    />
                  </div>
                  {emailHasError && (
                    <p className="mt-2 text-[12px] text-[#EF4444]">{getEmailValidationMessage(t)}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="signup-phone" className="text-[14px] font-medium text-[#111827] mb-2 block">
                    {t("signUp.form.phoneLabel")}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                    <input
                      id="signup-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      inputMode="numeric"
                      maxLength={PHONE_DIGITS}
                      placeholder={t("signUp.form.phonePlaceholder")}
                      aria-invalid={phoneHasError}
                      className={`w-full bg-[#F9FAFB] border rounded-[12px] pl-12 pr-4 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:border-transparent transition-all ${
                        phoneHasError
                          ? "border-[#EF4444] focus:ring-[#EF4444]"
                          : "border-[#E5E7EB] focus:ring-[#1C4D8D]"
                      }`}
                    />
                  </div>
                  {phoneHasError && (
                    <p className="mt-2 text-[12px] text-[#EF4444]">{getPhoneValidationMessage(t)}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="signup-password" className="text-[14px] font-medium text-[#111827] mb-2 block">
                    {t("signUp.form.passwordLabel")} <span className="text-[#EF4444]">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                      placeholder={t("signUp.form.passwordPlaceholder")}
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-12 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? t("signUp.form.hidePassword") : t("signUp.form.showPassword")}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="signup-confirm-password" className="text-[14px] font-medium text-[#111827] mb-2 block">
                    {t("signUp.form.confirmPasswordLabel")} <span className="text-[#EF4444]">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => handleChange("confirmPassword", e.target.value)}
                      placeholder={t("signUp.form.confirmPasswordPlaceholder")}
                      aria-invalid={confirmPasswordHasError}
                      className={`w-full bg-[#F9FAFB] border rounded-[12px] pl-12 pr-12 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:border-transparent transition-all ${
                        confirmPasswordHasError
                          ? "border-[#EF4444] focus:ring-[#EF4444]"
                          : "border-[#E5E7EB] focus:ring-[#1C4D8D]"
                      }`}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? t("signUp.form.hideConfirmPassword") : t("signUp.form.showConfirmPassword")}
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
                      <p className="text-[12px] font-semibold text-[#111827]">{t("signUp.passwordStrength.label")}</p>
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
                        {t("signUp.passwordStrength.passwordsMatch")}
                      </li>
                    </ul>
                  </div>
                )}

                {/* I want to selection */}
                <div className="pt-2">
                  <p className="text-[14px] font-medium text-[#111827] mb-3 block">
                    {t("signUp.userType.label")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setUserType("employer")}
                      className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-[12px] border-2 transition-all ${
                        userType === "employer"
                          ? "border-[#1C4D8D] bg-[#1C4D8D]/[0.08]"
                          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                      }`}
                    >
                      <Briefcase className={`w-6 h-6 ${userType === "employer" ? "text-[#1C4D8D]" : "text-[#9CA3AF]"}`} />
                      <span className={`text-[13px] font-semibold ${userType === "employer" ? "text-[#1C4D8D]" : "text-[#6B7280]"}`}>
                        {t("signUp.userType.employer")}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserType("worker")}
                      className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-[12px] border-2 transition-all ${
                        userType === "worker"
                          ? "border-[#1C4D8D] bg-[#1C4D8D]/[0.08]"
                          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                      }`}
                    >
                      <UserPlus className={`w-6 h-6 ${userType === "worker" ? "text-[#1C4D8D]" : "text-[#9CA3AF]"}`} />
                      <span className={`text-[13px] font-semibold ${userType === "worker" ? "text-[#1C4D8D]" : "text-[#6B7280]"}`}>
                        {t("signUp.userType.worker")}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserType("both")}
                      className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-[12px] border-2 transition-all ${
                        userType === "both"
                          ? "border-[#1C4D8D] bg-[#1C4D8D]/[0.08]"
                          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                      }`}
                    >
                      <Handshake className={`w-6 h-6 ${userType === "both" ? "text-[#1C4D8D]" : "text-[#9CA3AF]"}`} />
                      <span className={`text-[13px] font-semibold ${userType === "both" ? "text-[#1C4D8D]" : "text-[#6B7280]"}`}>
                        {t("signUp.userType.both")}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Terms & Conditions */}
                <div className="flex items-start gap-2">
                  <input
                    id="signup-terms"
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E5E7EB] text-[#1C4D8D] focus:ring-2 focus:ring-[#1C4D8D] cursor-pointer mt-0.5"
                  />
                  <label htmlFor="signup-terms" className="text-[13px] text-[#6B7280]">
                    <Trans
                      t={t}
                      i18nKey="signUp.terms.agreement"
                      components={{
                        terms: <Link to={ROUTES.terms} className="text-[#1C4D8D] hover:opacity-80 font-medium" />,
                        privacy: <Link to={ROUTES.privacy} className="text-[#1C4D8D] hover:opacity-80 font-medium" />,
                      }}
                    />
                  </label>
                </div>

                {/* Sign Up Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="brand-primary-interactive w-full rounded-[12px] px-6 py-4 font-semibold hover:shadow-xl"
                >
                  {isSubmitting ? t("signUp.form.submitLoading") : t("signUp.form.submit")}
                </button>
              </form>
                <div className="my-6 flex items-center gap-3 text-[12px] text-[#9CA3AF]">
                  <span className="h-px flex-1 bg-[#E5E7EB]" />
                  <span>{t("signUp.form.orContinueWith")}</span>
                  <span className="h-px flex-1 bg-[#E5E7EB]" />
                </div>
                <GoogleSignInButton onCredential={handleGoogleSignUp} disabled={isSubmitting} />
            </div>

            <div className="mt-4 text-center">
              <p className="text-[14px] text-[#6B7280]">
                {t("signUp.signInPrompt.text")}{" "}
                <button
                  onClick={() => navigate(ROUTES.signIn)}
                  className="text-[#1C4D8D] hover:opacity-80 font-semibold"
                >
                  {t("signUp.signInPrompt.action")}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {showOTP && (
        <OTPVerification
          email={normalizedEmail}
          onClose={() => setShowOTP(false)}
        />
      )}

    </main>
  );
}
