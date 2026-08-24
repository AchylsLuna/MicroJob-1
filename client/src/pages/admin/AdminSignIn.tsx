import { useRef, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { isAdmin } from "../../utils/dashboardRoutes";
import { getPostSignInPath } from "../../utils/authRedirects";
import { ROUTES } from "../../utils/routes";
import { MfaLoginForm } from "../../components/auth/MfaLoginForm";
import { isCredentialLoginError } from "../../utils/authSession";

export function AdminSignIn() {
  const { t } = useTranslation("admin");
  const { login, isAuthenticated, user, logout, mfaChallenge, verifyMfaLogin, cancelMfaLogin } = useAuth();
  const location = useLocation();
  const redirectPath = getPostSignInPath((location.state as { from?: unknown } | null)?.from, ROUTES.admin.dashboard);
  const [email, setEmail] = useState("");
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isLoading && isAuthenticated && isAdmin(user)) {
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

    if (!email || !password) {
      toast.error(t("signIn.toast.fillAllFields"));
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email, password, { suppressToast: true });
      if (result.status === "mfa_required") {
        toast.info(t("signIn.toast.mfaCodePrompt"));
        return;
      }
      if (result.status !== "authenticated" || !isAdmin(result.user)) {
        toast.error(t("signIn.toast.adminAccessRequired"));
        logout({ silent: true });
        return;
      }

      toast.success(t("signIn.toast.welcomeBack", { name: result.user.firstName ? `, ${result.user.firstName}` : "" }));
    } catch (error: any) {
      toast.error(isCredentialLoginError(error?.message)
        ? t("signIn.toast.credentialsIncorrect")
        : error?.message || t("signIn.toast.signInFailed"));
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
      const loggedInUser = await verifyMfaLogin(code, { suppressToast: true });
      if (!isAdmin(loggedInUser)) {
        toast.error(t("signIn.toast.adminAccessRequired"));
        logout({ silent: true });
        return;
      }
      toast.success(t("signIn.toast.welcomeBack", { name: loggedInUser.firstName ? `, ${loggedInUser.firstName}` : "" }));
    } catch (error: any) {
      toast.error(error?.message || t("signIn.toast.mfaVerificationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1C4D8D] p-4 sm:p-6">
      <div className="relative w-full max-w-[520px] rounded-[24px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,41,84,0.35)] backdrop-blur sm:p-8 lg:p-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#1C4D8D] shadow-lg shadow-[#1C4D8D]/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1C4D8D]">{t("signIn.eyebrow")}</p>
          <h1 className="mb-2 text-[28px] font-bold text-[#111827]">{t("signIn.title")}</h1>
          <p className="text-[14px] text-[#4B5563]">{t("signIn.subtitle")}</p>
        </div>

        {mfaChallenge ? (
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
        ) : <form onSubmit={handleSignIn} className="space-y-5">
          <div>
            <label htmlFor="admin-email" className="text-[14px] font-medium text-[#111827] mb-2 block">{t("signIn.emailLabel")}</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("signIn.emailPlaceholder")}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-4 py-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="text-[14px] font-medium text-[#111827] mb-2 block">{t("signIn.passwordLabel")}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
              <input
                id="admin-password"
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                placeholder={t("signIn.passwordPlaceholder")}
                autoComplete="current-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-12 py-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                disabled={isLoading}
              />
              <button
                type="button"
                aria-label={showPassword ? t("signIn.hidePassword") : t("signIn.showPassword")}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="brand-primary-interactive w-full rounded-[12px] px-6 py-4 font-semibold hover:shadow-xl"
          >
            {isLoading ? t("signIn.submitLoading") : t("signIn.submit")}
          </button>
        </form>}

      </div>
    </main>
  );
}
