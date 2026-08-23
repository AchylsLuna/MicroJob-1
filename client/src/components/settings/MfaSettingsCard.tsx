import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import {
  disableMfa,
  enableMfa,
  getMfaStatus,
  regenerateMfaBackupCodes,
  startMfaSetup,
  type MfaStatus,
} from "../../services/api";

const defaultStatus: MfaStatus = {
  enabled: false,
  method: null,
  backupCodesRemaining: 0,
  hasPendingSetup: false,
};

export function MfaSettingsCard() {
  const { t } = useTranslation("worker");
  const [status, setStatus] = useState<MfaStatus>(defaultStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      setStatus(await getMfaStatus());
    } catch (error: any) {
      toast.error(error?.message || t("settings.mfa.toast.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSetup = async () => {
    setIsSubmitting(true);
    try {
      const setup = await startMfaSetup();
      setSecret(setup.secret);
      setOtpauthUrl(setup.otpauthUrl);
      setBackupCodes([]);
      setStatus((current) => ({ ...current, hasPendingSetup: true, method: setup.method }));
      toast.success(t("settings.mfa.toast.setupCreated"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.mfa.toast.setupFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnable = async () => {
    if (!code.trim()) {
      toast.error(t("settings.mfa.toast.enterAuthenticatorCode"));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await enableMfa(code.trim());
      setStatus(result);
      setBackupCodes(result.backupCodes || []);
      setCode("");
      setSecret("");
      setOtpauthUrl("");
      toast.success(t("settings.mfa.toast.enableSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.mfa.toast.enableFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!code.trim()) {
      toast.error(t("settings.mfa.toast.enterCurrentCode"));
      return;
    }
    setIsSubmitting(true);
    try {
      setStatus(await disableMfa(code.trim()));
      setCode("");
      setBackupCodes([]);
      toast.success(t("settings.mfa.toast.disableSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.mfa.toast.disableFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!code.trim()) {
      toast.error(t("settings.mfa.toast.enterCurrentCode"));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await regenerateMfaBackupCodes(code.trim());
      setStatus(result);
      setBackupCodes(result.backupCodes || []);
      setCode("");
      toast.success(t("settings.mfa.toast.regenerateSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.mfa.toast.regenerateFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold text-[#111827]">{t("settings.mfa.title")}</h3>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            {t("settings.mfa.description")}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            status.enabled ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F1F5F9] text-[#475569]"
          }`}
        >
          {isLoading ? t("settings.mfa.statusLoading") : status.enabled ? t("settings.mfa.statusEnabled") : t("settings.mfa.statusDisabled")}
        </span>
      </div>

      {!isLoading && !status.enabled && (
        <div className="mt-5 space-y-4">
          <button
            type="button"
            onClick={handleSetup}
            disabled={isSubmitting}
            className="rounded-[10px] bg-[#0F172A] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting
              ? t("settings.mfa.preparingButton")
              : status.hasPendingSetup
                ? t("settings.mfa.generateNewKeyButton")
                : t("settings.mfa.startSetupButton")}
          </button>

          {(secret || status.hasPendingSetup) && (
            <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <p className="text-[13px] font-semibold text-[#1E293B]">{t("settings.mfa.setupHeading")}</p>
              <p className="mt-1 text-[12px] text-[#64748B]">
                {t("settings.mfa.setupInstructions")}
              </p>
              {secret ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <code className="rounded border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] text-[#0F172A]">
                    {secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(secret);
                      toast.success(t("settings.mfa.toast.keyCopied"));
                    }}
                    className="text-[12px] font-semibold text-[#1C4D8D]"
                  >
                    {t("settings.mfa.copyKeyButton")}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-[#92400E]">
                  {t("settings.mfa.keyHiddenNotice")}
                </p>
              )}
              {otpauthUrl && (
                <p className="mt-2 break-all text-[11px] text-[#64748B]">{otpauthUrl}</p>
              )}
            </div>
          )}
        </div>
      )}

      {!isLoading && (status.enabled || status.hasPendingSetup || secret) && (
        <div className="mt-5">
          <label className="block text-[13px] font-medium text-[#374151]">
            {status.enabled ? t("settings.mfa.currentOrBackupCodeLabel") : t("settings.mfa.sixDigitCodeLabel")}
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.trimStart().slice(0, 12))}
              placeholder={status.enabled ? t("settings.mfa.codeInputPlaceholderEnabled") : t("settings.mfa.codeInputPlaceholder")}
              autoComplete="one-time-code"
              inputMode="numeric"
              className="mt-2 w-full max-w-sm rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            {!status.enabled ? (
              <button
                type="button"
                onClick={handleEnable}
                disabled={isSubmitting || !status.hasPendingSetup}
                className="rounded-[10px] bg-[#1C4D8D] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {isSubmitting ? t("settings.mfa.verifyingButton") : t("settings.mfa.verifyAndEnableButton")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRegenerateBackupCodes}
                  disabled={isSubmitting}
                  className="rounded-[10px] bg-[#0F172A] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  {t("settings.mfa.regenerateBackupCodesButton")}
                </button>
                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={isSubmitting}
                  className="rounded-[10px] border border-[#FCA5A5] px-4 py-2 text-[13px] font-semibold text-[#B91C1C] disabled:opacity-60"
                >
                  {t("settings.mfa.disableButton")}
                </button>
              </>
            )}
          </div>
          {status.enabled && (
            <p className="mt-3 text-[12px] text-[#64748B]">
              {t("settings.mfa.backupCodesRemaining", { count: status.backupCodesRemaining })}
            </p>
          )}
        </div>
      )}

      {backupCodes.length > 0 && (
        <div className="mt-5 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] p-4">
          <p className="text-[13px] font-semibold text-[#92400E]">{t("settings.mfa.saveBackupCodesHeading")}</p>
          <p className="mt-1 text-[12px] text-[#92400E]">
            {t("settings.mfa.saveBackupCodesInstructions")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[12px] text-[#0F172A] sm:grid-cols-4">
            {backupCodes.map((backupCode) => (
              <div key={backupCode} className="rounded border border-[#FDE68A] bg-white px-2 py-1">
                {backupCode}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
