import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import { updateProfile } from "../../services/api";
import { Card } from "../ui";

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
    <Card>
      <h3 className="text-base font-semibold text-slate-900">{t("employerPrivacy.title")}</h3>
      <p className="mt-1 text-[13px] text-slate-500">
        {t("employerPrivacy.subtitle")}
      </p>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-[12px] border border-slate-200 px-4 py-4">
        <div>
          <p className="text-[15px] font-semibold text-slate-900">{t("employerPrivacy.hideHiredCandidates.label")}</p>
          <p className="text-[12px] text-slate-500">{t("employerPrivacy.hideHiredCandidates.description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-slate-500">
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
    </Card>
  );
}
