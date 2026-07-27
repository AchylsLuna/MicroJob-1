import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../lib/toast";
import { requestAccountDeletion } from "../../services/api";

export function DeleteAccountCard() {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!currentPassword) {
      toast.error("Enter your current password.");
      return;
    }
    if (confirmation.trim().toUpperCase() !== "DELETE") {
      toast.error("Type DELETE to confirm account deletion.");
      return;
    }

    setIsDeleting(true);
    try {
      await requestAccountDeletion({
        currentPassword,
        confirm: confirmation.trim(),
      });
      logout({ silent: true });
      toast.success("Your account has been deleted.");
      window.location.assign("/sign-in");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete account.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
      <h3 className="text-[16px] font-semibold text-[#111827]">Delete My Account</h3>
      <p className="mt-1 text-[13px] text-[#6B7280]">
        Permanently remove your account after active jobs, payments, and disputes are resolved.
      </p>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-4 rounded-full border border-[#FCA5A5] px-6 py-3 text-[14px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"
        >
          Delete Account
        </button>
      ) : (
        <div className="mt-5 max-w-lg space-y-4 rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-4">
          <p className="text-[13px] font-semibold text-[#991B1B]">
            This action is permanent. Enter your password and type DELETE to continue.
          </p>
          <label className="block text-[13px] font-medium text-[#374151]">
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-2 w-full rounded-[10px] border border-[#FCA5A5] bg-white px-4 py-3 text-[14px]"
            />
          </label>
          <label className="block text-[13px] font-medium text-[#374151]">
            Type DELETE
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
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || confirmation.trim().toUpperCase() !== "DELETE"}
              className="rounded-[10px] bg-[#B91C1C] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Permanently delete account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
