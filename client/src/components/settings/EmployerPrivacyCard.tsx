import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import { updateProfile } from "../../services/api";

export function EmployerPrivacyCard({ initialValue }: { initialValue: boolean }) {
  const { t } = useTranslation("employer");
  const [hideHiredCandidates, setHideHiredCandidates] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setHideHiredCandidates(initialValue);
  }, [initialValue]);

  const handleToggle = async () => {
    const nextValue = !hideHiredCandidates;
    setHideHiredCandidates(nextValue);
    setIsSaving(true);
    try {
      await updateProfile({ hideHiredCandidates: nextValue });
      toast.success(t("employerPrivacy.toast.saveSuccess"));
    } catch (error: any) {
      setHideHiredCandidates(!nextValue);
      toast.error(error?.message || t("employerPrivacy.toast.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
      <h3 className="text-[16px] font-semibold text-[#111827]">{t("employerPrivacy.title")}</h3>
      <p className="mt-1 text-[13px] text-[#6B7280]">
        {t("employerPrivacy.subtitle")}
      </p>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-[12px] border border-[#E5E7EB] px-4 py-4">
        <div>
          <p className="text-[15px] font-semibold text-[#111827]">{t("employerPrivacy.hideHiredCandidates.label")}</p>
          <p className="text-[12px] text-[#6B7280]">{t("employerPrivacy.hideHiredCandidates.description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#6B7280]">
            {isSaving ? t("employerPrivacy.status.saving") : hideHiredCandidates ? t("employerPrivacy.status.enabled") : t("employerPrivacy.status.disabled")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={hideHiredCandidates}
            aria-label={t("employerPrivacy.hideHiredCandidates.label")}
            onClick={handleToggle}
            disabled={isSaving}
            className={`flex h-6 w-12 items-center rounded-full p-1 transition-colors disabled:opacity-60 ${
              hideHiredCandidates ? "bg-green-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                hideHiredCandidates ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
