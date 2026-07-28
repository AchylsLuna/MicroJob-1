import { useEffect, useState } from "react";
import { toast } from "../../lib/toast";
import { updateProfile } from "../../services/api";

export function EmployerPrivacyCard({ initialValue }: { initialValue: boolean }) {
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
      toast.success("Employer privacy setting saved.");
    } catch (error: any) {
      setHideHiredCandidates(!nextValue);
      toast.error(error?.message || "Failed to save employer privacy setting.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
      <h3 className="text-[16px] font-semibold text-[#111827]">Employer Privacy</h3>
      <p className="mt-1 text-[13px] text-[#6B7280]">
        Control which hiring statistics are visible from your employer profile.
      </p>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-[12px] border border-[#E5E7EB] px-4 py-4">
        <div>
          <p className="text-[15px] font-semibold text-[#111827]">Hide number of hired candidates</p>
          <p className="text-[12px] text-[#6B7280]">Keep your hiring count private.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#6B7280]">
            {isSaving ? "Saving..." : hideHiredCandidates ? "Enabled" : "Disabled"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={hideHiredCandidates}
            aria-label="Hide number of hired candidates"
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
