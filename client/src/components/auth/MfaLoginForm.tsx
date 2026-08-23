import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export function MfaLoginForm({
  email,
  method,
  isLoading,
  onSubmit,
  onCancel,
}: {
  email: string;
  method: string;
  isLoading: boolean;
  onSubmit: (code: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation("auth");
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(code);
      }}
    >
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-slate-950">{t("mfaLoginForm.title")}</h2>
            <p id="mfa-login-help" className="mt-1 text-sm leading-5 text-slate-600">
              {t("mfaLoginForm.description", { email })}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="mfa-login-code" className="mb-2 block text-sm font-medium text-slate-900">
          {t("mfaLoginForm.codeLabel")}
        </label>
        <input
          ref={inputRef}
          id="mfa-login-code"
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value.trimStart().slice(0, 20))}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby="mfa-login-help"
          placeholder={method === "authenticator" ? t("mfaLoginForm.placeholderAuthenticator") : t("mfaLoginForm.placeholderOther")}
          disabled={isLoading}
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-700 disabled:bg-slate-100"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !code.trim()}
        className="brand-primary-interactive min-h-12 w-full rounded-xl px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? t("mfaLoginForm.submitLoading") : t("mfaLoginForm.submit")}
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("mfaLoginForm.cancel")}
      </button>
    </form>
  );
}
