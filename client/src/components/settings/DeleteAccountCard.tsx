import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../lib/toast";
import { requestAccountDeletion } from "../../services/api";

export function DeleteAccountCard() {
  const { t } = useTranslation("worker");
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!currentPassword) {
      toast.error(t("settings.deleteAccount.toast.enterPassword"));
      return;
    }
    if (confirmation.trim().toUpperCase() !== "DELETE") {
      toast.error(t("settings.deleteAccount.toast.typeDeleteConfirm"));
      return;
    }

    setIsDeleting(true);
    try {
      await requestAccountDeletion({
        currentPassword,
        confirm: confirmation.trim(),
      });
      logout({ silent: true });
      toast.success(t("settings.deleteAccount.toast.deleteSuccess"));
      window.location.assign("/sign-in");
    } catch (error: any) {
      toast.error(error?.message || t("settings.deleteAccount.toast.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
      <h3 className="text-[16px] font-semibold text-[#111827]">{t("settings.deleteAccount.title")}</h3>
      <p className="mt-1 text-[13px] text-[#6B7280]">
        {t("settings.deleteAccount.description")}
      </p>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-4 rounded-full border border-[#FCA5A5] px-6 py-3 text-[14px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"
        >
          {t("settings.deleteAccount.deleteButton")}
        </button>
      ) : (
        <div className="mt-5 max-w-lg space-y-4 rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-4">
          <p className="text-[13px] font-semibold text-[#991B1B]">
            {t("settings.deleteAccount.confirmWarning")}
          </p>
          <label className="block text-[13px] font-medium text-[#374151]">
            {t("settings.deleteAccount.currentPasswordLabel")}
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-2 w-full rounded-[10px] border border-[#FCA5A5] bg-white px-4 py-3 text-[14px]"
            />
          </label>
          <label className="block text-[13px] font-medium text-[#374151]">
            {t("settings.deleteAccount.typeDeleteLabel")}
            <input
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              className="mt-2 w-full rounded-[10px] border border-[#FCA5A5] bg-white px-4 py-3 text-[14px]"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setCurrentPassword("");
                setConfirmation("");
              }}
              disabled={isDeleting}
              className="rounded-[10px] border border-[#CBD5E1] bg-white px-4 py-2 text-[13px] font-semibold text-[#475569]"
            >
              {t("settings.deleteAccount.cancelButton")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || confirmation.trim().toUpperCase() !== "DELETE"}
              className="rounded-[10px] bg-[#B91C1C] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {isDeleting ? t("settings.deleteAccount.deletingButton") : t("settings.deleteAccount.confirmButton")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
