import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../lib/toast";
import { getPasswordStrength, PASSWORD_RULES, STRONG_PASSWORD_ERROR } from "../lib/passwordPolicy";
import { ROUTES } from "../utils/routes";

type RecoveryStep = "email" | "code" | "password" | "success";

export function ForgotPassword() {
  const navigate = useNavigate();
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

  const sendCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setIsLoading(true);
    try {
      await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setStep("code");
    } catch (error: any) {
      toast.error(error?.message || "Unable to send the reset code.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the complete 6-digit code.");
      return;
    }
    setIsLoading(true);
    try {
      await verifyPasswordResetCode(code);
      setStep("password");
      toast.success("Code verified.");
    } catch (error: any) {
      toast.error(error?.message || "The reset code could not be verified.");
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
      toast.error("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(code, newPassword);
      setStep("success");
    } catch (error: any) {
      toast.error(error?.message || "Unable to reset the password.");
    } finally {
      setIsLoading(false);
    }
  };

  const stepNumber = step === "email" ? 1 : step === "code" ? 2 : 3;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] rounded-[24px] bg-white shadow-2xl p-8 lg:p-10">
        {step !== "success" && (
          <button type="button" onClick={() => navigate(ROUTES.signIn)} className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </button>
        )}

        <div className="text-center">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl ${step === "success" ? "bg-emerald-100 text-emerald-700" : "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white"}`}>
            {step === "success" ? <CheckCircle2 className="h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
          </div>
          <h1 className="mt-5 text-[28px] font-bold text-slate-950">
            {step === "email" && "Forgot your password?"}
            {step === "code" && "Verify your code"}
            {step === "password" && "Create a new password"}
            {step === "success" && "Password changed"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {step === "email" && "Enter your account email and we’ll send a six-digit recovery code."}
            {step === "code" && <>Enter the code sent to <span className="font-semibold text-slate-900">{email}</span>.</>}
            {step === "password" && "Your code is verified. Choose a strong password for your account."}
            {step === "success" && "Your password was updated successfully. You can now sign in with it."}
          </p>
        </div>

        {step !== "success" && (
          <ol className="my-6 grid grid-cols-3 gap-2" aria-label="Password recovery progress">
            {["Email", "Verify", "Password"].map((label, index) => {
              const number = index + 1;
              const active = number <= stepNumber;
              return <li key={label} className={`rounded-xl px-2 py-2 text-center text-xs font-semibold ${active ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-500"}`} aria-current={number === stepNumber ? "step" : undefined}>{number}. {label}</li>;
            })}
          </ol>
        )}

        {step === "email" && (
          <form onSubmit={sendCode} className="mt-6 space-y-5">
            <div>
              <label htmlFor="forgot-email" className="mb-2 block text-[14px] font-semibold text-slate-900">Email address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isLoading} placeholder="you@example.com" className="min-h-[52px] w-full rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] py-4 pl-12 pr-4 text-[14px] outline-none focus:border-transparent focus:ring-2 focus:ring-[#1C4D8D]" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="min-h-[52px] w-full rounded-[12px] bg-blue-800 px-5 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? "Sending code…" : "Send recovery code"}</button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="mt-6 space-y-5">
            <div>
              <label htmlFor="password-reset-code" className="mb-2 block text-[14px] font-semibold text-slate-900">Six-digit recovery code</label>
              <input id="password-reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={isLoading} placeholder="000000" className="min-h-[56px] w-full rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-center text-xl font-bold tracking-[0.4em] outline-none focus:border-transparent focus:ring-2 focus:ring-[#1C4D8D]" />
            </div>
            <button type="submit" disabled={isLoading || code.length !== 6} className="min-h-[52px] w-full rounded-[12px] bg-blue-800 px-5 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? "Verifying…" : "Verify code"}</button>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[14px]">
              <button type="button" disabled={isLoading} onClick={() => sendCode()} className="font-semibold text-blue-800 hover:underline disabled:opacity-60">Resend code</button>
              <button type="button" onClick={() => { setStep("email"); setCode(""); }} className="font-semibold text-slate-600 hover:text-slate-950">Change email</button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={changePassword} className="mt-6 space-y-5">
            {[
              { id: "new-password", label: "New password", value: newPassword, setter: setNewPassword, visible: showPassword, toggle: () => setShowPassword((current) => !current) },
              { id: "confirm-password", label: "Confirm new password", value: confirmPassword, setter: setConfirmPassword, visible: showConfirmation, toggle: () => setShowConfirmation((current) => !current) },
            ].map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className="mb-2 block text-[14px] font-semibold text-slate-900">{field.label}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input id={field.id} type={field.visible ? "text" : "password"} autoComplete="new-password" value={field.value} onChange={(event) => field.setter(event.target.value)} disabled={isLoading} aria-invalid={field.id === "confirm-password" && passwordsMismatch} className={`min-h-[52px] w-full rounded-[12px] border bg-[#F9FAFB] py-4 pl-12 pr-12 text-[14px] outline-none focus:border-transparent focus:ring-2 ${field.id === "confirm-password" && passwordsMismatch ? "border-red-400 focus:ring-red-600" : "border-[#E5E7EB] focus:ring-[#1C4D8D]"}`} />
                  <button type="button" onClick={field.toggle} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={field.visible ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`}>{field.visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                </div>
              </div>
            ))}
            <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800"><span>Password strength</span><span>{passwordStrength.label}</span></div>
              <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                {PASSWORD_RULES.map((rule) => <li key={rule.key} className={passwordStrength.checks[rule.key] ? "text-emerald-700" : ""}>{passwordStrength.checks[rule.key] ? "✓" : "○"} {rule.label}</li>)}
              </ul>
              {passwordsMismatch && <p role="alert" className="mt-3 text-sm font-medium text-red-700">Passwords do not match.</p>}
            </div>
            <button type="submit" disabled={isLoading || !passwordStrength.isStrong || newPassword !== confirmPassword} className="min-h-[52px] w-full rounded-[12px] bg-blue-800 px-5 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? "Changing password…" : "Change password"}</button>
          </form>
        )}

        {step === "success" && <button type="button" onClick={() => navigate(ROUTES.signIn)} className="mt-7 min-h-12 w-full rounded-xl bg-blue-800 px-5 font-semibold text-white hover:bg-blue-900">Back to sign in</button>}
      </div>
    </main>
  );
}
