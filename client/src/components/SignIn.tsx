import { useRef, useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "../lib/toast";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getPostAuthLandingPath } from "../utils/dashboardRoutes";
import { getPostSignInPath } from "../utils/authRedirects";
import { isCredentialLoginError } from "../utils/authSession";
import { isValidEmail, normalizeEmail } from "../lib/authValidation";
import { ROUTES } from "../utils/routes";
import { MicroJobsLogo } from "./MicroJobsLogo";
import { OTPVerification } from "./OTPVerification";
import { MfaLoginForm } from "./auth/MfaLoginForm";
import { GoogleSignInButton } from "./GoogleSignInButton";

export function SignIn() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleSignIn, isAuthenticated, user, mfaChallenge, verifyMfaLogin, cancelMfaLogin } = useAuth();
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

  const handleGoogleSignIn = async (credential: string) => {
    setIsLoading(true);
    try {
      await googleSignIn(credential);
    } catch (error: any) {
      toast.error(error?.message || t("signIn.toast.googleFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#1C4D8D] flex items-center justify-center px-6 py-10 lg:py-14">
      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding */}
        <div className="text-white space-y-8 flex flex-col justify-start">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <MicroJobsLogo variant="light" className="[&>span]:text-[32px] [&>span]:font-bold" />
            </div>
            
            <h2 className="text-[28px] font-bold leading-tight whitespace-pre-line">
              {t("signIn.hero.title")}
            </h2>
            <p className="text-[16px] opacity-90 leading-relaxed">
              {t("signIn.hero.subtitle")}
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-white/10 backdrop-blur-sm rounded-[16px]">
              <div>
                <h3 className="text-[16px] font-semibold mb-1">{t("signIn.hero.features.verified.title")}</h3>
                <p className="text-[14px] opacity-80">{t("signIn.hero.features.verified.description")}</p>
              </div>
            </div>

            <div className="p-4 bg-white/10 backdrop-blur-sm rounded-[16px]">
              <div>
                <h3 className="text-[16px] font-semibold mb-1">{t("signIn.hero.features.quality.title")}</h3>
                <p className="text-[14px] opacity-80">{t("signIn.hero.features.quality.description")}</p>
              </div>
            </div>

            <div className="p-4 bg-white/10 backdrop-blur-sm rounded-[16px]">
              <div>
                <h3 className="text-[16px] font-semibold mb-1">{t("signIn.hero.features.growth.title")}</h3>
                <p className="text-[14px] opacity-80">{t("signIn.hero.features.growth.description")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Sign In Form */}
        <div className="bg-white rounded-[24px] shadow-2xl p-8 lg:p-10 self-start">
          {successMessage ? (
            <div className="mb-6 rounded-[16px] border border-[#86efac] bg-[#f0fdf4] p-4 text-[#166534]">
              <p className="font-semibold">{t("signIn.successBanner.title")}</p>
              <p className="text-[14px]">{successMessage}</p>
            </div>
          ) : null}

          {/* Back Button */}
          <button
            onClick={() => navigate(ROUTES.home)}
            className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#1C4D8D] font-medium mb-6 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            {t("signIn.backToHome")}
          </button>

          <div className="mb-8">
            <h1 className="text-[28px] font-bold text-[#111827] mb-2">{t("signIn.title")}</h1>
            <p className="text-[14px] text-[#6B7280]">{t("signIn.subtitle")}</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="signin-email" className="text-[14px] font-medium text-[#111827] mb-2 block">
                {t("signIn.form.emailLabel")}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("signIn.form.emailPlaceholder")}
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
                {t("signIn.form.passwordLabel")}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  id="signin-password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  placeholder={t("signIn.form.passwordPlaceholder")}
                  autoComplete="current-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-12 py-3.5 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  aria-label={showPassword ? t("signIn.form.hidePassword") : t("signIn.form.showPassword")}
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
                <span className="text-[14px] text-[#6B7280]">{t("signIn.form.rememberMe")}</span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[14px] text-[#1C4D8D] hover:opacity-80 font-medium"
              >
                {t("signIn.form.forgotPassword")}
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              className="brand-primary-interactive w-full rounded-[12px] px-6 py-4 font-semibold hover:shadow-xl"
            >
              {isLoading ? t("signIn.form.submitLoading") : t("signIn.form.submit")}
            </button>

          </form>

          <div className="my-6 flex items-center gap-3 text-[12px] text-[#9CA3AF]">
            <span className="h-px flex-1 bg-[#E5E7EB]" />
            <span>{t("signIn.form.orContinueWith")}</span>
            <span className="h-px flex-1 bg-[#E5E7EB]" />
          </div>
          <GoogleSignInButton onCredential={handleGoogleSignIn} disabled={isLoading} />

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-[14px] text-[#6B7280]">
              {t("signIn.signUpPrompt.text")}{" "}
              <button
                onClick={() => navigate(ROUTES.signUp)}
                className="text-[#1C4D8D] hover:opacity-80 font-semibold"
              >
                {t("signIn.signUpPrompt.action")}
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

    </main>
  );
}
