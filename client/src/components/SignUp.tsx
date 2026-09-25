import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { OTPVerification } from "./OTPVerification";
import { Dialog } from "./ui";
import { LegalDocumentBody } from "./LegalDocumentBody";
import { LEGAL_DOCUMENTS, type LegalDocId } from "../constants/legalDocuments";
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
import {
  AuthDivider,
  AuthShell,
  authFieldClass,
  authFieldErrorClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "./auth/AuthShell";
import { PasswordField } from "./auth/PasswordField";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { googleSignInConfigured } from "../lib/googleAuth";
import { RoleChooser, type SignUpRole } from "./auth/RoleChooser";

const SIGN_UP_DRAFT_KEY = "signup_draft_v1";

// Passwords are kept only for the lifetime of this SPA session so navigating
// to a legal document does not discard them. They are never persisted.
let inMemoryPasswordDraft = {
  password: "",
  confirmPassword: "",
};

// Non-sensitive fields are mirrored into sessionStorage on every keystroke.
type SignUpDraft = {
  fullName: string;
  email: string;
  phone: string;
  userType: SignUpRole;
  agreeToTerms: boolean;
};

type SignUpField = "email" | "phone";

const isSignUpRole = (value: unknown): value is SignUpRole =>
  value === "employer" || value === "worker" || value === "both";

export function SignUp() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { register, googleSignIn, isAuthenticated, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: inMemoryPasswordDraft.password,
    confirmPassword: inMemoryPasswordDraft.confirmPassword,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [legalDialogDoc, setLegalDialogDoc] = useState<LegalDocId | null>(null);
  const [showOTP, setShowOTP] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<SignUpField, string>>>({});
  const submitInFlightRef = useRef(false);

  // The chosen role lives in the URL so the step survives a refresh and can be
  // linked to directly. No new route: /sign-up keeps its guards and the
  // location.state.from round trip.
  const roleParam = searchParams.get("role");
  const selectedRole: SignUpRole | null = isSignUpRole(roleParam) ? roleParam : null;

  const showPasswordStrength = Boolean(formData.password || formData.confirmPassword);
  const normalizedFullName = normalizeFullName(formData.fullName);
  const normalizedEmail = normalizeEmail(formData.email);
  const normalizedPhone = normalizePhone(formData.phone);
  const fullNameHasError = Boolean(formData.fullName) && !isValidFullName(normalizedFullName);
  const emailHasError = (Boolean(formData.email) && !isValidEmail(normalizedEmail)) || Boolean(serverFieldErrors.email);
  const phoneHasError = (Boolean(formData.phone) && !isValidPhone(normalizedPhone)) || Boolean(serverFieldErrors.phone);
  const passwordStrength = getPasswordStrength(formData.password);
  const passwordsMatch = Boolean(formData.confirmPassword) && formData.password === formData.confirmPassword;
  const confirmPasswordHasError = Boolean(formData.confirmPassword) && formData.password !== formData.confirmPassword;

  // The save effect below must not run until the draft has been read back into
  // state, or its first pass writes the empty initial values straight over a
  // good draft — which is how returning from the Terms page used to arrive at a
  // blank form. StrictMode's double-mount made it fire every time.
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(SIGN_UP_DRAFT_KEY);
    if (!raw) {
      setIsDraftHydrated(true);
      return;
    }
    try {
      const draft = JSON.parse(raw) as Partial<SignUpDraft>;
      setFormData((current) => ({
        ...current,
        fullName: String(draft.fullName || ""),
        email: String(draft.email || ""),
        phone: String(draft.phone || ""),
      }));
      setAgreeToTerms(Boolean(draft.agreeToTerms));
    } catch {
      sessionStorage.removeItem(SIGN_UP_DRAFT_KEY);
    }
    setIsDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!isDraftHydrated) return;
    const draft: SignUpDraft = {
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      userType: selectedRole ?? "both",
      agreeToTerms,
    };
    sessionStorage.setItem(SIGN_UP_DRAFT_KEY, JSON.stringify(draft));
  }, [isDraftHydrated, formData.fullName, formData.email, formData.phone, selectedRole, agreeToTerms]);

  useEffect(() => {
    inMemoryPasswordDraft = {
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    };
  }, [formData.password, formData.confirmPassword]);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      sessionStorage.removeItem(SIGN_UP_DRAFT_KEY);
      navigate(getPostAuthLandingPath(user), { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  const handleChange = (field: string, value: string) => {
    if (field === "email" || field === "phone") {
      setServerFieldErrors((current) => ({ ...current, [field]: undefined }));
    }
    if (field === "fullName") {
      setFormData({ ...formData, fullName: sanitizeFullNameInput(value) });
      return;
    }
    if (field === "phone") {
      setFormData({ ...formData, phone: normalizePhone(value) });
      return;
    }
    setFormData({ ...formData, [field]: value });
    if (field === "password" || field === "confirmPassword") {
      inMemoryPasswordDraft = {
        ...inMemoryPasswordDraft,
        [field]: value,
      };
    }
  };

  // Google accounts skip the form entirely, so the role chosen in step 1 is the
  // only signal for which kind of account to create. Same hire/work/both wire
  // values AuthContext.register uses.
  const handleGoogleSignUp = async (credential: string) => {
    setIsSubmitting(true);
    try {
      const role = selectedRole === "employer" ? "hire" : selectedRole === "worker" ? "work" : "both";
      await googleSignIn(credential, role);
    } catch (error: any) {
      toast.error(error?.message || t("signUp.toast.googleFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || submitInFlightRef.current) {
      return;
    }

    if (!formData.fullName || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
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

    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
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
      await register(normalizedEmail, formData.password, normalizedFullName, selectedRole ?? "both", normalizedPhone);
      sessionStorage.removeItem(SIGN_UP_DRAFT_KEY);
      inMemoryPasswordDraft = { password: "", confirmPassword: "" };
      toast.success(t("signUp.toast.registrationSuccess"));
      setShowOTP(true);
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      const errorCode = String(error?.code || "");
      if (errorCode === "PHONE_NUMBER_ALREADY_EXISTS" || /phone.*(?:registered|taken|exists)|number.*already exists/.test(message)) {
        setServerFieldErrors({ phone: t("signUp.fieldErrors.phoneAlreadyExists") });
      } else if (errorCode === "EMAIL_ALREADY_EXISTS" || /email.*(?:registered|taken|exists)|already registered/.test(message)) {
        setServerFieldErrors({ email: t("signUp.fieldErrors.emailAlreadyExists") });
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

  // --- Step 1: which describes you best? -----------------------------------
  if (!selectedRole) {
    return (
      <AuthShell
        title={t("signUp.roleChooser.title")}
        subtitle={t("signUp.roleChooser.subtitle")}
        width="wide"
        backTo={ROUTES.home}
        backLabel={t("signUp.backToHome")}
        footer={
          <>
            {t("signUp.signInPrompt.text")}{" "}
            <button
              type="button"
              onClick={() => navigate(ROUTES.signIn)}
              className="font-semibold text-[#1C4D8D] hover:opacity-80"
            >
              {t("signUp.signInPrompt.action")}
            </button>
          </>
        }
      >
        <RoleChooser onSelect={(role) => setSearchParams({ role })} />
      </AuthShell>
    );
  }

  // --- Step 2: the account form --------------------------------------------
  return (
    <>
      <AuthShell
        title={t("signUp.title")}
        subtitle={t("signUp.subtitle")}
        backTo={ROUTES.home}
        backLabel={t("signUp.backToHome")}
        footer={
          <>
            {t("signUp.signInPrompt.text")}{" "}
            <button
              type="button"
              onClick={() => navigate(ROUTES.signIn)}
              className="font-semibold text-[#1C4D8D] hover:opacity-80"
            >
              {t("signUp.signInPrompt.action")}
            </button>
          </>
        }
      >
        <div className="mb-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-[10px] bg-slate-50 px-4 py-3 text-[14px]">
          <span className="text-slate-600">{t("signUp.roleChooser.selectedLabel")}</span>
          <span className="font-semibold text-slate-900">
            {t(`signUp.roleChooser.roleName.${selectedRole}`)}
          </span>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="font-semibold text-[#1C4D8D] hover:opacity-80"
          >
            {t("signUp.roleChooser.change")}
          </button>
        </div>

        {googleSignInConfigured ? (
          <>
            <GoogleSignInButton onCredential={handleGoogleSignUp} disabled={isSubmitting} />
            <div className="my-6">
              <AuthDivider label={t("signUp.form.orContinueWith")} />
            </div>
          </>
        ) : null}

        <form onSubmit={handleSignUp} className="space-y-5" noValidate>
          <div>
            <label htmlFor="signup-name" className={authLabelClass}>
              {t("signUp.form.fullNameLabel")}
            </label>
            <input
              id="signup-name"
              type="text"
              value={formData.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              placeholder={t("signUp.form.fullNamePlaceholder")}
              autoComplete="name"
              aria-invalid={fullNameHasError || undefined}
              className={`${authFieldClass} ${fullNameHasError ? authFieldErrorClass : ""}`}
            />
          </div>

          <div>
            <label htmlFor="signup-email" className={authLabelClass}>
              {t("signUp.form.emailLabel")}
            </label>
            {serverFieldErrors.email ? (
              <p id="signup-email-error" role="alert" className="mb-2 text-[13px] font-medium text-red-600">
                {serverFieldErrors.email}
              </p>
            ) : null}
            <input
              id="signup-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder={t("signUp.form.emailPlaceholder")}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={emailHasError || undefined}
              aria-describedby={serverFieldErrors.email ? "signup-email-error" : undefined}
              className={`${authFieldClass} ${emailHasError ? authFieldErrorClass : ""}`}
            />
          </div>

          <div>
            <label htmlFor="signup-phone" className={authLabelClass}>
              {t("signUp.form.phoneLabel")}
            </label>
            {serverFieldErrors.phone ? (
              <p id="signup-phone-error" role="alert" className="mb-2 text-[13px] font-medium text-red-600">
                {serverFieldErrors.phone}
              </p>
            ) : null}
            <input
              id="signup-phone"
              type="tel"
              inputMode="numeric"
              maxLength={PHONE_DIGITS}
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder={t("signUp.form.phonePlaceholder")}
              autoComplete="tel"
              aria-invalid={phoneHasError || undefined}
              aria-describedby={serverFieldErrors.phone ? "signup-phone-error" : undefined}
              className={`${authFieldClass} ${phoneHasError ? authFieldErrorClass : ""}`}
            />
          </div>

          <PasswordField
            id="signup-password"
            label={t("signUp.form.passwordLabel")}
            placeholder={t("signUp.form.passwordPlaceholder")}
            autoComplete="new-password"
            value={formData.password}
            onChange={(value) => handleChange("password", value)}
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
            showLabel={t("signUp.form.showPassword")}
            hideLabel={t("signUp.form.hidePassword")}
          />

          <PasswordField
            id="signup-confirm-password"
            label={t("signUp.form.confirmPasswordLabel")}
            placeholder={t("signUp.form.confirmPasswordPlaceholder")}
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={(value) => handleChange("confirmPassword", value)}
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((current) => !current)}
            showLabel={t("signUp.form.showConfirmPassword")}
            hideLabel={t("signUp.form.hideConfirmPassword")}
            invalid={confirmPasswordHasError}
          />

          {showPasswordStrength ? (
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4 text-[13px] font-bold text-slate-900">
                <span>{t("signUp.passwordStrength.label")}</span>
                <span className={passwordStrength.isStrong ? "text-emerald-700" : "text-[#1C4D8D]"}>
                  {passwordStrength.label}
                </span>
              </div>
              <div
                className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-label={t("signUp.passwordStrength.label")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={passwordStrength.percent}
              >
                <div
                  className={`h-full rounded-full transition-[width] ${passwordStrength.isStrong ? "bg-emerald-600" : "bg-[#1C4D8D]"}`}
                  style={{ width: `${passwordStrength.percent}%` }}
                />
              </div>
              <ul className="mt-3.5 grid gap-x-5 gap-y-2 text-[13px] text-slate-600 sm:grid-cols-2">
                {PASSWORD_RULES.map((rule) => (
                  <li
                    key={rule.key}
                    className={`flex min-w-0 items-start gap-2 ${passwordStrength.checks[rule.key] ? "font-medium text-emerald-700" : ""}`}
                  >
                    {passwordStrength.checks[rule.key] ? (
                      <CheckCircle2 className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <XCircle className="mt-px h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                    )}
                    <span>{rule.label}</span>
                  </li>
                ))}
                {formData.confirmPassword ? (
                  <li className={`flex min-w-0 items-start gap-2 ${passwordsMatch ? "font-medium text-emerald-700" : "text-red-700"}`}>
                    {passwordsMatch ? (
                      <CheckCircle2 className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <XCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{t("signUp.passwordStrength.passwordsMatch")}</span>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div className="flex items-start gap-3">
            <input
              id="signup-terms"
              type="checkbox"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-[#1C4D8D] focus:ring-2 focus:ring-[#1C4D8D]"
            />
            {/* The links live inside the <label>, so a click on one would also
                activate the label and silently flip the consent checkbox.
                stopPropagation keeps "read the terms" from meaning "I agree".
                Opening a dialog instead of navigating to /legal also means the
                click never leaves this page, so the password field (deliberately
                excluded from the sessionStorage draft) never gets wiped. */}
            <label htmlFor="signup-terms" className="text-[13px] leading-6 text-slate-600">
              <Trans
                t={t}
                i18nKey="signUp.terms.agreement"
                components={{
                  terms: (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setLegalDialogDoc("terms");
                      }}
                      className="font-medium text-[#1C4D8D] hover:opacity-80"
                    />
                  ),
                  privacy: (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setLegalDialogDoc("privacy");
                      }}
                      className="font-medium text-[#1C4D8D] hover:opacity-80"
                    />
                  ),
                }}
              />
            </label>
          </div>

          <button type="submit" disabled={isSubmitting} className={authPrimaryButtonClass}>
            {isSubmitting ? t("signUp.form.submitLoading") : t("signUp.form.submit")}
          </button>
        </form>
      </AuthShell>

      {showOTP && <OTPVerification email={normalizedEmail} onClose={() => setShowOTP(false)} />}

      <Dialog
        open={legalDialogDoc !== null}
        title={LEGAL_DOCUMENTS.find((doc) => doc.id === legalDialogDoc)?.title ?? ""}
        onClose={() => setLegalDialogDoc(null)}
      >
        {legalDialogDoc ? (
          <LegalDocumentBody doc={LEGAL_DOCUMENTS.find((doc) => doc.id === legalDialogDoc)!} hideHeading />
        ) : null}
      </Dialog>
    </>
  );
}
