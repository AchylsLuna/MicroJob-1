import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../lib/toast";
import { requestAccountDeletion } from "../../services/api";
import { Card, Dialog } from "../ui";

export function DeleteAccountCard() {
  const { t } = useTranslation("worker");
  const { user, logout } = useAuth();
  const isSuperadmin = String(user?.systemRole ?? "").toLowerCase() === "superadmin";
  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (isDeleting) return;
    setIsOpen(false);
    setCurrentPassword("");
    setConfirmation("");
    setDeletionError("");
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    if (isSuperadmin) {
      setDeletionError(t("settings.deleteAccount.toast.superadminProtected"));
      return;
    }
    if (!currentPassword) {
      setDeletionError(t("settings.deleteAccount.toast.enterPassword"));
      return;
    }
    if (confirmation.trim().toUpperCase() !== "DELETE") {
      setDeletionError(t("settings.deleteAccount.toast.typeDeleteConfirm"));
      return;
    }

    setDeletionError("");
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
      const blockers = error?.blockers as Array<{ message?: string; count?: number }> | undefined;
      if (blockers?.length) {
        setDeletionError(
          `${error?.message || t("settings.deleteAccount.toast.deleteFailed")} ${blockers
            .map((blocker) => `${blocker.message || "Unresolved requirement"}${blocker.count ? ` (${blocker.count})` : ""}`)
            .join(" ")}`
        );
      } else {
        setDeletionError(error?.message || t("settings.deleteAccount.toast.deleteFailed"));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isSuperadmin) {
    return (
      <Card>
        <h3 className="text-section font-semibold text-slate-900">{t("settings.deleteAccount.title")}</h3>
        <p className="mt-1 text-body-sm text-slate-500">
          {t("settings.deleteAccount.description")}
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-body-sm font-medium text-slate-600">
          {t("settings.deleteAccount.superadminDisabled")}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-section font-semibold text-slate-900">{t("settings.deleteAccount.title")}</h3>
      <p className="mt-1 text-body-sm text-slate-500">
        {t("settings.deleteAccount.description")}
      </p>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-4 min-h-11 rounded-full border border-red-300 px-6 py-3 text-body font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
      >
        {t("settings.deleteAccount.deleteButton")}
      </button>

      <Dialog
        open={isOpen}
        title={t("settings.deleteAccount.title")}
        description={t("settings.deleteAccount.description")}
        onClose={handleClose}
        initialFocusRef={passwordRef}
        restoreFocusRef={triggerRef}
        closeDisabled={isDeleting}
      >
        <form
          onSubmit={(event) => { event.preventDefault(); void handleDelete(); }}
          className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-4"
          aria-busy={isDeleting}
        >
          <p className="text-body-sm font-semibold text-red-800">
            {t("settings.deleteAccount.confirmWarning")}
          </p>
          {deletionError ? (
            <p role="alert" className="rounded-lg border border-red-300 bg-white p-3 text-body-sm font-semibold text-red-800">
              {deletionError}
            </p>
          ) : null}
          <label className="block text-body-sm font-medium text-slate-700">
            {t("settings.deleteAccount.currentPasswordLabel")}
            <input
              ref={passwordRef}
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="mt-2 w-full rounded-control border border-red-300 bg-white px-4 py-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            />
          </label>
          <label className="block text-body-sm font-medium text-slate-700">
            {t("settings.deleteAccount.typeDeleteLabel")}
            <input
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              required
              className="mt-2 w-full rounded-control border border-red-300 bg-white px-4 py-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            />
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="min-h-11 rounded-control border border-slate-300 bg-white px-4 py-2 text-body-sm font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              {t("settings.deleteAccount.cancelButton")}
            </button>
            <button
              type="submit"
              disabled={isDeleting || !currentPassword || confirmation.trim().toUpperCase() !== "DELETE"}
              aria-busy={isDeleting}
              className="min-h-11 rounded-control bg-red-700 px-4 py-2 text-body-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {isDeleting ? t("settings.deleteAccount.deletingButton") : t("settings.deleteAccount.confirmButton")}
            </button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
