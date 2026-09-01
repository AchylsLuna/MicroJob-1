import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../lib/toast";
import { getPasswordStrength, PASSWORD_RULES, STRONG_PASSWORD_ERROR } from "../lib/passwordPolicy";
import { ROUTES } from "../utils/routes";
import { isValidEmail, normalizeEmail } from "../lib/authValidation";

type RecoveryStep = "email" | "code" | "password" | "success";

export function ForgotPassword() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const { requestPasswordReset, verifyPasswordResetCode, resetPassword } = useAuth();
  const [step, setStep] = useState<RecoveryStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const passwordStrength = getPasswordStrength(newPassword);
  const passwordsMismatch = Boolean(confirmPassword) && newPassword !== confirmPassword;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get("email");
    const codeParam = params.get("code");

    if (emailParam) {
      const normalizedEmail = normalizeEmail(emailParam);
      if (normalizedEmail) {
        setEmail(normalizedEmail);
        localStorage.setItem("pending_reset_email", normalizedEmail);
      }
    }

    if (codeParam && /^\d{6}$/.test(codeParam)) {
      setCode(codeParam);
      setStep("code");
    }
  }, [location.search]);

  const sendCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      toast.error(t("forgotPassword.toast.invalidEmail"));
      return;
    }
    setIsLoading(true);
    try {
      await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setStep("code");
    } catch (error: any) {
      toast.error(error?.message || t("forgotPassword.toast.sendCodeFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error(t("forgotPassword.toast.incompleteCode"));
      return;
    }
    setIsLoading(true);
    try {
      await verifyPasswordResetCode(code);
      setStep("password");
      toast.success(t("forgotPassword.toast.codeVerified"));
    } catch (error: any) {
      toast.error(error?.message || t("forgotPassword.toast.verifyCodeFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordStrength.isStrong) {
      toast.error(STRONG_PASSWORD_ERROR);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("forgotPassword.toast.passwordsMismatch"));
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(code, newPassword);
      setStep("success");
    } catch (error: any) {
      toast.error(error?.message || t("forgotPassword.toast.resetPasswordFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const stepNumber = step === "email" ? 1 : step === "code" ? 2 : 3;

  return (
    <main className="min-h-screen bg-[#1C4D8D] flex items-center justify-center p-6">
      <div className={`w-full bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] ${step === "success" ? "max-w-[480px] rounded-[22px] border border-white/60 p-7 sm:p-10" : "max-w-[520px] rounded-[24px] p-8 lg:p-10"}`}>
        {step !== "success" && (
          <button type="button" onClick={() => navigate(ROUTES.signIn)} className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("forgotPassword.backToSignIn")}
          </button>
        )}

        <div className="text-center">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center ${step === "success" ? "rounded-[20px] bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" : "rounded-3xl bg-[#1C4D8D] text-white"}`}>
            {step === "success" ? <CheckCircle2 className="h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
          </div>
          <h1 className={`font-bold tracking-tight text-slate-950 ${step === "success" ? "mt-6 text-[30px]" : "mt-5 text-[28px]"}`}>
            {step === "email" && t("forgotPassword.steps.email.title")}
            {step === "code" && t("forgotPassword.steps.code.title")}
            {step === "password" && t("forgotPassword.steps.password.title")}
            {step === "success" && t("forgotPassword.steps.success.title")}
          </h1>
          <p className={`mx-auto text-slate-600 ${step === "success" ? "mt-3 max-w-sm text-[15px] leading-7" : "mt-2 text-sm leading-6"}`}>
            {step === "email" && t("forgotPassword.steps.email.description")}
            {step === "code" && <>{t("forgotPassword.steps.code.description")} <span className="font-semibold text-slate-900">{email}</span>.</>}
            {step === "password" && t("forgotPassword.steps.password.description")}
            {step === "success" && t("forgotPassword.steps.success.description")}
          </p>
        </div>

        {step !== "success" && (
          <ol className="my-6 grid grid-cols-3 gap-2" aria-label={t("forgotPassword.progress.ariaLabel")}>
            {[t("forgotPassword.progress.email"), t("forgotPassword.progress.verify"), t("forgotPassword.progress.password")].map((label, index) => {
              const number = index + 1;
              const active = number <= stepNumber;
              return <li key={label} className={`rounded-xl px-2 py-2 text-center text-xs font-semibold ${active ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"}`} aria-current={number === stepNumber ? "step" : undefined}>{number}. {label}</li>;
            })}
          </ol>
        )}

        {step === "email" && (
          <form onSubmit={sendCode} className="mt-6 space-y-5">
            <div>
              <label htmlFor="forgot-email" className="mb-2 block text-[14px] font-semibold text-slate-900">{t("forgotPassword.emailStep.label")}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isLoading} placeholder={t("forgotPassword.emailStep.placeholder")} className="min-h-[52px] w-full rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] py-4 pl-12 pr-4 text-[14px] outline-none focus:border-transparent focus:ring-2 focus:ring-[#1C4D8D]" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="brand-primary-interactive min-h-[52px] w-full rounded-[12px] px-5 font-semibold">{isLoading ? t("forgotPassword.emailStep.submitLoading") : t("forgotPassword.emailStep.submit")}</button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="mt-6 space-y-5">
            <div>
              <label htmlFor="password-reset-code" className="mb-2 block text-[14px] font-semibold text-slate-900">{t("forgotPassword.codeStep.label")}</label>
              <input id="password-reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={isLoading} placeholder={t("forgotPassword.codeStep.placeholder")} className="min-h-[56px] w-full rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-center text-xl font-bold tracking-[0.4em] outline-none focus:border-transparent focus:ring-2 focus:ring-[#1C4D8D]" />
            </div>
            <button type="submit" disabled={isLoading || code.length !== 6} className="brand-primary-interactive min-h-[52px] w-full rounded-[12px] px-5 font-semibold">{isLoading ? t("forgotPassword.codeStep.submitLoading") : t("forgotPassword.codeStep.submit")}</button>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[14px]">
              <button type="button" disabled={isLoading} onClick={() => sendCode()} className="font-semibold text-blue-800 hover:underline disabled:opacity-60">{t("forgotPassword.codeStep.resend")}</button>
              <button type="button" onClick={() => { setStep("email"); setCode(""); }} className="font-semibold text-slate-600 hover:text-slate-950">{t("forgotPassword.codeStep.changeEmail")}</button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={changePassword} className="mt-6 space-y-5">
            {[
              { id: "new-password", label: t("forgotPassword.passwordStep.newPasswordLabel"), value: newPassword, setter: setNewPassword, visible: showPassword, toggle: () => setShowPassword((current) => !current), showLabel: t("forgotPassword.passwordStep.showNewPassword"), hideLabel: t("forgotPassword.passwordStep.hideNewPassword") },
              { id: "confirm-password", label: t("forgotPassword.passwordStep.confirmPasswordLabel"), value: confirmPassword, setter: setConfirmPassword, visible: showConfirmation, toggle: () => setShowConfirmation((current) => !current), showLabel: t("forgotPassword.passwordStep.showConfirmPassword"), hideLabel: t("forgotPassword.passwordStep.hideConfirmPassword") },
            ].map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className="mb-2 block text-[14px] font-semibold text-slate-900">{field.label}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input id={field.id} type={field.visible ? "text" : "password"} autoComplete="new-password" value={field.value} onChange={(event) => field.setter(event.target.value)} disabled={isLoading} aria-invalid={field.id === "confirm-password" && passwordsMismatch} className={`min-h-[52px] w-full rounded-[12px] border bg-[#F9FAFB] py-4 pl-12 pr-12 text-[14px] outline-none focus:border-transparent focus:ring-2 ${field.id === "confirm-password" && passwordsMismatch ? "border-red-400 focus:ring-red-600" : "border-[#E5E7EB] focus:ring-[#1C4D8D]"}`} />
                  <button type="button" onClick={field.toggle} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={field.visible ? field.hideLabel : field.showLabel}>{field.visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4 text-sm font-bold text-slate-900"><span>{t("forgotPassword.passwordStep.strengthLabel")}</span><span className={passwordStrength.isStrong ? "text-emerald-700" : "text-[#1C4D8D]"}>{passwordStrength.label}</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={t("forgotPassword.passwordStep.strengthLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={passwordStrength.percent}>
                <div className={`h-full rounded-full transition-[width] ${passwordStrength.isStrong ? "bg-emerald-600" : "bg-[#1C4D8D]"}`} style={{ width: `${passwordStrength.percent}%` }} />
              </div>
              <ul className="mt-4 grid gap-x-6 gap-y-2.5 text-sm text-slate-600 sm:grid-cols-2">
                {PASSWORD_RULES.map((rule) => <li key={rule.key} className={`flex min-w-0 items-start gap-2 ${passwordStrength.checks[rule.key] ? "font-medium text-emerald-700" : ""}`}><span className="mt-px shrink-0" aria-hidden="true">{passwordStrength.checks[rule.key] ? "✓" : "○"}</span><span>{rule.label}</span></li>)}
              </ul>
              {passwordsMismatch && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{t("forgotPassword.passwordStep.mismatchError")}</p>}
            </div>
            <button type="submit" disabled={isLoading || !passwordStrength.isStrong || newPassword !== confirmPassword} className="brand-primary-interactive min-h-[52px] w-full rounded-[12px] px-5 font-semibold">{isLoading ? t("forgotPassword.passwordStep.submitLoading") : t("forgotPassword.passwordStep.submit")}</button>
          </form>
        )}

        {step === "success" && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => navigate(ROUTES.signIn)}
              className="brand-primary-interactive group inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[10px] px-6 text-[15px] font-semibold shadow-[0_10px_24px_rgba(28,77,141,0.22)] sm:w-auto sm:min-w-[220px]"
            >
              {t("forgotPassword.backToSignIn")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
