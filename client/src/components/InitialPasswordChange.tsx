import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { changeInitialPassword } from "../services/api";
import { getPasswordStrength, STRONG_PASSWORD_ERROR } from "../lib/passwordPolicy";
import { useAuth } from "../hooks/useAuth";
import { getDefaultDashboardPath } from "../utils/dashboardRoutes";
import { toast } from "../lib/toast";

export function InitialPasswordChange() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (getPasswordStrength(newPassword).score < 4) return setError(STRONG_PASSWORD_ERROR);
    if (newPassword !== confirmPassword) return setError("New passwords do not match.");
    setIsSubmitting(true);
    try {
      await changeInitialPassword({ currentPassword, newPassword });
      updateProfile({ passwordChangeRequired: false });
      toast.success("Password changed successfully.");
      navigate(getDefaultDashboardPath(user), { replace: true });
    } catch (requestError: any) {
      setError(requestError?.message || "Failed to change password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" noValidate>
        <div className="mb-6">
          <p className="text-sm font-semibold text-blue-700">MicroJobs account security</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Choose a new password</h1>
          <p className="mt-2 text-sm text-slate-600">Your invitation used a temporary password. Replace it before continuing.</p>
        </div>
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Temporary password
            <input autoComplete="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-700" />
          </label>
          <label className="block text-sm font-medium text-slate-700">New password
            <input autoComplete="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required aria-describedby="initial-password-help" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-700" />
          </label>
          <p id="initial-password-help" className="text-xs text-slate-500">Use at least 8 characters with upper- and lowercase letters, a number, and a symbol.</p>
          <label className="block text-sm font-medium text-slate-700">Confirm new password
            <input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-700" />
          </label>
        </div>
        <button type="submit" disabled={isSubmitting} className="mt-6 w-full rounded-xl bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? "Changing password…" : "Change password and continue"}
        </button>
      </form>
    </main>
  );
}
