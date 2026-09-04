import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../lib/toast";
import { getPasswordStrength, PASSWORD_RULES, STRONG_PASSWORD_ERROR } from "../lib/passwordPolicy";
import { ROUTES } from "../utils/routes";
import { isValidEmail, normalizeEmail } from "../lib/authValidation";
import {
  AuthShell,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "./auth/AuthShell";
import { PasswordField } from "./auth/PasswordField";

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
      // The server answers identically whether or not the address is
      // registered, so there is no "account not found" case to branch on here.
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

  const title =
    step === "email"
      ? t("forgotPassword.steps.email.title")
      : step === "code"
        ? t("forgotPassword.steps.code.title")
        : step === "password"
          ? t("forgotPassword.steps.password.title")
          : t("forgotPassword.steps.success.title");

  const subtitle =
    step === "email" ? (
      t("forgotPassword.steps.email.description")
    ) : step === "code" ? (
      <>
        {t("forgotPassword.steps.code.description")} <span className="font-semibold text-slate-900">{email}</span>.
      </>
    ) : step === "password" ? (
      t("forgotPassword.steps.password.description")
    ) : (
      t("forgotPassword.steps.success.description")
    );

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      backTo={step === "success" ? undefined : ROUTES.signIn}
      backLabel={t("forgotPassword.backToSignIn")}
    >
      {step === "email" && (
        <form onSubmit={sendCode} className="space-y-5">
          <div>
            <label htmlFor="forgot-email" className={authLabelClass}>{t("forgotPassword.emailStep.label")}</label>
            <input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isLoading} placeholder={t("forgotPassword.emailStep.placeholder")} className={authFieldClass} />
          </div>
          <button type="submit" disabled={isLoading} className={authPrimaryButtonClass}>{isLoading ? t("forgotPassword.emailStep.submitLoading") : t("forgotPassword.emailStep.submit")}</button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verifyCode} className="space-y-5">
          <div>
            <label htmlFor="password-reset-code" className={authLabelClass}>{t("forgotPassword.codeStep.label")}</label>
            <input id="password-reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={isLoading} placeholder={t("forgotPassword.codeStep.placeholder")} className={`${authFieldClass} min-h-[56px] text-center text-xl font-bold tracking-[0.4em]`} />
          </div>
          <button type="submit" disabled={isLoading || code.length !== 6} className={authPrimaryButtonClass}>{isLoading ? t("forgotPassword.codeStep.submitLoading") : t("forgotPassword.codeStep.submit")}</button>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[14px]">
            <button type="button" disabled={isLoading} onClick={() => sendCode()} className="min-h-11 px-2 font-semibold text-[#1C4D8D] hover:underline disabled:opacity-60">{t("forgotPassword.codeStep.resend")}</button>
            <button type="button" onClick={() => { setStep("email"); setCode(""); }} className="min-h-11 px-2 font-semibold text-slate-600 hover:text-slate-950">{t("forgotPassword.codeStep.changeEmail")}</button>
          </div>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={changePassword} className="space-y-5">
          <PasswordField
            id="new-password"
            label={t("forgotPassword.passwordStep.newPasswordLabel")}
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
            disabled={isLoading}
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
            showLabel={t("forgotPassword.passwordStep.showNewPassword")}
            hideLabel={t("forgotPassword.passwordStep.hideNewPassword")}
          />
          <PasswordField
            id="confirm-password"
            label={t("forgotPassword.passwordStep.confirmPasswordLabel")}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={isLoading}
            invalid={passwordsMismatch}
            visible={showConfirmation}
            onToggle={() => setShowConfirmation((current) => !current)}
            showLabel={t("forgotPassword.passwordStep.showConfirmPassword")}
            hideLabel={t("forgotPassword.passwordStep.hideConfirmPassword")}
          />
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4 text-[13px] font-bold text-slate-900"><span>{t("forgotPassword.passwordStep.strengthLabel")}</span><span className={passwordStrength.isStrong ? "text-emerald-700" : "text-[#1C4D8D]"}>{passwordStrength.label}</span></div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={t("forgotPassword.passwordStep.strengthLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={passwordStrength.percent}>
              <div className={`h-full rounded-full transition-[width] ${passwordStrength.isStrong ? "bg-emerald-600" : "bg-[#1C4D8D]"}`} style={{ width: `${passwordStrength.percent}%` }} />
            </div>
            <ul className="mt-3.5 grid gap-x-5 gap-y-2 text-[13px] text-slate-600 sm:grid-cols-2">
              {PASSWORD_RULES.map((rule) => <li key={rule.key} className={`flex min-w-0 items-start gap-2 ${passwordStrength.checks[rule.key] ? "font-medium text-emerald-700" : ""}`}><span className="mt-px shrink-0" aria-hidden="true">{passwordStrength.checks[rule.key] ? "✓" : "○"}</span><span>{rule.label}</span></li>)}
            </ul>
            {passwordsMismatch && <p role="alert" className="mt-3 text-[13px] font-medium text-red-700">{t("forgotPassword.passwordStep.mismatchError")}</p>}
          </div>
          <button type="submit" disabled={isLoading || !passwordStrength.isStrong || newPassword !== confirmPassword} className={authPrimaryButtonClass}>{isLoading ? t("forgotPassword.passwordStep.submitLoading") : t("forgotPassword.passwordStep.submit")}</button>
        </form>
      )}

      {step === "success" && (
        <div className="flex justify-center">
          {/* Sizing is asserted by the e2e suite: >=52px tall, <300px wide and
              a 10px radius at desktop widths. Keep the sm: overrides. */}
          <button
            type="button"
            onClick={() => navigate(ROUTES.signIn)}
            className="brand-primary-interactive group inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[10px] px-6 text-[15px] font-semibold sm:w-auto sm:min-w-[220px]"
          >
            {t("forgotPassword.backToSignIn")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </AuthShell>
  );
}
