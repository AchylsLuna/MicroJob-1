import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search, UserPlus } from "lucide-react";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../hooks/useAdminData";
import { toast } from "../../lib/toast";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/routes";
import { Button, Dialog, Input, Select } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";

function AdminUserManagementContent() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const {
    isLoading,
    loadError,
    users,
    getStatusColor,
    handleApproveUser,
    handleToggleUserStatus,
    handleInviteUser,
    handleEditUser,
  } = useAdminData();

  const [searchTerm, setSearchTerm] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formMode, setFormMode] = useState<"invite" | "edit" | null>(null);
  const [formUserId, setFormUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "work", status: "active" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const pageSize = 5;

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
      const phone = user.phoneNumber ? String(user.phoneNumber).toLowerCase() : "";
      return (
        !normalizedSearch ||
        name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        phone.includes(normalizedSearch)
      );
    });
  }, [users, searchTerm]);

  const getUserName = (user: typeof users[number]) =>
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

  const getInitials = (user: typeof users[number]) => {
    const name = getUserName(user);
    const letters = name.split(/\s+/).filter(Boolean).map((part) => part[0]);
    return letters.slice(0, 2).join("").toUpperCase() || "U";
  };

  const getShortId = (id: string) => `${id.slice(0, 6)}...`;

  const formatJoinedDate = (id?: string) => {
    if (!id || id.length < 8) return "—";
    const timestamp = parseInt(id.slice(0, 8), 16) * 1000;
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const selectedUser = selectedUserId ? users.find((user) => user._id === selectedUserId) : null;
  const totalUsers = users.length;
  const newThisWeek = users.filter((user) => {
    if (!user._id || user._id.length < 8) return false;
    const timestamp = parseInt(user._id.slice(0, 8), 16) * 1000;
    const createdAt = new Date(timestamp);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return createdAt >= weekAgo;
  }).length;
  const activeToday = users.filter((user) => user.status === "active").length;

  useEffect(() => {
    if (!openMenuId) return;
    const handleWindowClick = () => setOpenMenuId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [openMenuId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filteredUsers.length);
  const paginatedUsers = filteredUsers.slice(pageStart, pageStart + pageSize);
  const canManagePrivilegedRoles = currentUser?.systemRole === "superadmin";

  const openInvite = () => {
    setForm({ firstName: "", lastName: "", email: "", role: "work", status: "active" });
    setFormErrors({});
    setFormUserId(null);
    setFormMode("invite");
  };

  const openEdit = (user: typeof users[number]) => {
    setForm({ firstName: user.firstName || "", lastName: user.lastName || "", email: user.email, role: user.role || "work", status: user.status === "deleted" ? "disabled" : user.status || "active" });
    setFormErrors({});
    setFormUserId(user._id);
    setFormMode("edit");
  };

  const submitUserForm = async () => {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = "First name is required.";
    if (!form.lastName.trim()) errors.lastName = "Last name is required.";
    if (formMode === "invite" && !/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setIsSaving(true);
    try {
      if (formMode === "invite") {
        await handleInviteUser({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim().toLowerCase(), role: form.role as 'work' | 'hire' | 'both' | 'admin' | 'superadmin' });
        toast.success("Invitation sent successfully.");
      } else if (formUserId) {
        await handleEditUser(formUserId, { firstName: form.firstName.trim(), lastName: form.lastName.trim(), role: form.role, status: form.status as 'active' | 'pending' | 'disabled' });
        toast.success("User updated successfully.");
      }
      setFormMode(null);
    } catch (error: any) {
      setFormErrors({ form: error?.message || "Unable to save the user." });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {loadError && (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
          {loadError}
        </div>
      )}

      <section className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5">
            <p className="text-[13px] text-[#6B7280]">Total Users</p>
            <p className="text-[28px] font-semibold text-[#111827] mt-2">{isLoading ? "—" : totalUsers}</p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5">
            <p className="text-[13px] text-[#6B7280]">New This Week</p>
            <p className="text-[28px] font-semibold text-[#111827] mt-2">{isLoading ? "—" : newThisWeek}</p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5">
            <p className="text-[13px] text-[#6B7280]">Active Today</p>
            <p className="text-[28px] font-semibold text-[#111827] mt-2">
              {isLoading ? "—" : activeToday || "—"}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h4 className="text-[18px] font-semibold text-[#111827]">All Users</h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  aria-label="Search users"
                  placeholder="Search users..."
                  className="w-full h-10 rounded-[12px] border border-[#E5E7EB] pl-9 pr-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                />
              </div>
              <button
                type="button"
                onClick={openInvite}
                className="inline-flex items-center gap-2 rounded-[12px] bg-[#2563EB] text-white px-4 py-2 text-[13px] font-semibold shadow-sm hover:bg-[#1D4ED8]"
              >
                <UserPlus className="w-4 h-4" />
                Invite User
              </button>
            </div>
          </div>

          <div className="space-y-3 md:hidden" aria-label="Users">
            {isLoading && <p className="py-6 text-center text-sm text-slate-500">Loading users…</p>}
            {!isLoading && paginatedUsers.map((user) => (
              <article key={user._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-semibold text-slate-900">{getUserName(user)}</p><p className="truncate text-xs text-slate-600">{user.email}</p></div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(user.status)}`}>{user.status || "active"}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">Role</dt><dd className="mt-1 capitalize text-slate-900">{user.role || "work"}</dd></div><div><dt className="text-slate-500">Joined</dt><dd className="mt-1 text-slate-900">{formatJoinedDate(user._id)}</dd></div></dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-100" onClick={() => { setSelectedUserId(user._id); }}>View</Button>
                  <Button onClick={() => openEdit(user)}>Edit</Button>
                </div>
              </article>
            ))}
            {!isLoading && paginatedUsers.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No users found.</p>}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                  <th className="py-3 pr-4 font-medium">User</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Joined</th>
                  <th className="py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#9CA3AF]">
                      Loading users...
                    </td>
                  </tr>
                )}

                {!isLoading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#9CA3AF]">
                      No users found for the selected filters.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  paginatedUsers.map((user) => (
                    <tr key={user._id} className="border-b border-[#F3F4F6]">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#EEF2FF] text-[#2563EB] flex items-center justify-center font-semibold">
                            {getInitials(user)}
                          </div>
                          <div>
                            <div className="text-[#111827] font-medium">{getUserName(user)}</div>
                            <div className="text-[12px] text-[#6B7280]">
                              {user.email || getShortId(user._id)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
                            getStatusColor(user.status)
                          }`}
                        >
                          {user.status || "active"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[#6B7280]">{formatJoinedDate(user._id)}</td>
                      <td className="py-3 text-right">
                        <div className="relative inline-flex">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuId((prev) => (prev === user._id ? null : user._id));
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#F3F4F6]"
                            aria-label="Open user actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenuId === user._id && (
                            <div
                              className="absolute right-0 mt-2 w-44 bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-10 text-left"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserId(user._id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-[13px] text-[#111827] hover:bg-[#F8FAFC]"
                              >
                                View Profile
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  openEdit(user);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-[13px] text-[#111827] hover:bg-[#F8FAFC]"
                              >
                                Edit User
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigate(ROUTES.admin.messages, {
                                    state: { userId: user._id, name: getUserName(user) },
                                  });
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-[13px] text-[#111827] hover:bg-[#F8FAFC]"
                              >
                                Message User
                              </button>
                              {user.status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleApproveUser(user);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 text-[13px] text-[#111827] hover:bg-[#F8FAFC]"
                                >
                                  Approve User
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  handleToggleUserStatus(user);
                                  setOpenMenuId(null);
                                }}
                                className={`w-full px-3 py-2 text-[13px] ${
                                  user.status === "disabled" ? "text-[#111827]" : "text-[#DC2626]"
                                } hover:bg-[#FEF2F2]`}
                              >
                                {user.status === "disabled" ? "Activate User" : "Suspend User"}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {!isLoading && filteredUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[#E5E7EB] text-[13px] text-[#6B7280]">
              <span>
                Showing {pageStart + 1}-{pageEnd} of {filteredUsers.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#111827] disabled:text-[#9CA3AF] disabled:bg-[#F9FAFB]"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-[8px] text-[13px] ${
                        page === safePage
                          ? "bg-[#1C4D8D] text-white"
                          : "border border-[#E5E7EB] text-[#111827] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage === totalPages}
                  className="px-3 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#111827] disabled:text-[#9CA3AF] disabled:bg-[#F9FAFB]"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          role="presentation"
          onClick={(event) => event.target === event.currentTarget && setSelectedUserId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-details-title"
            className="w-full max-w-[520px] bg-white rounded-[20px] border border-[#E5E7EB] p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 id="admin-user-details-title" className="text-[18px] font-semibold text-[#111827]">User Details</h4>
                <p className="text-[13px] text-[#6B7280] mt-1">Review account information and access.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="text-[#6B7280] hover:text-[#111827] text-[20px]"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-[#EEF2FF] text-[#2563EB] flex items-center justify-center font-semibold text-[18px]">
                {getInitials(selectedUser)}
              </div>
              <div>
                <div className="text-[16px] font-semibold text-[#111827]">{getUserName(selectedUser)}</div>
                <div className="text-[13px] text-[#6B7280]">{selectedUser.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px] text-[#6B7280]">
              <div>
                <p className="text-[12px] uppercase tracking-wide text-[#9CA3AF]">Status</p>
                <p className="mt-1 text-[#111827] capitalize">{selectedUser.status || "active"}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wide text-[#9CA3AF]">Role</p>
                <p className="mt-1 text-[#111827] capitalize">{selectedUser.role || "user"}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wide text-[#9CA3AF]">Phone</p>
                <p className="mt-1 text-[#111827]">{selectedUser.phoneNumber || "—"}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wide text-[#9CA3AF]">Joined</p>
                <p className="mt-1 text-[#111827]">{formatJoinedDate(selectedUser._id)}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="px-4 py-2 rounded-[12px] border border-[#E5E7EB] text-[13px] text-[#111827] hover:bg-[#F9FAFB]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleToggleUserStatus(selectedUser);
                  setSelectedUserId(null);
                }}
                className={`px-4 py-2 rounded-[12px] text-[13px] font-semibold ${
                  selectedUser.status === "disabled"
                    ? "bg-[#E5E7EB] text-[#111827]"
                    : "bg-[#DC2626] text-white"
                }`}
              >
                {selectedUser.status === "disabled" ? "Activate" : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={formMode !== null} title={formMode === "invite" ? "Invite user" : "Edit user"} description={formMode === "invite" ? "A temporary password will be emailed and must be changed after sign-in." : "Email addresses cannot be changed by administrators."} onClose={() => !isSaving && setFormMode(null)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="First name" autoComplete="given-name" value={form.firstName} error={formErrors.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
          <Input label="Last name" autoComplete="family-name" value={form.lastName} error={formErrors.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
        </div>
        <div className="mt-4">
          <Input label="Email" type="email" autoComplete="email" value={form.email} error={formErrors.email} disabled={formMode === "edit"} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Role" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
            <option value="work">Worker</option><option value="hire">Employer</option><option value="both">Worker and employer</option>
            {canManagePrivilegedRoles && <><option value="admin">Admin</option><option value="superadmin">Superadmin</option></>}
          </Select>
          {formMode === "edit" && <Select label="Status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="pending">Pending</option><option value="disabled">Disabled</option></Select>}
        </div>
        {formErrors.form && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formErrors.form}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50" disabled={isSaving} onClick={() => setFormMode(null)}>Cancel</Button>
          <Button disabled={isSaving} onClick={submitUserForm}>{isSaving ? "Saving…" : formMode === "invite" ? "Send invitation" : "Save changes"}</Button>
        </div>
      </Dialog>
    </div>
  );
}

export function AdminUserManagement() {
  return (
    <AdminGate allowedRoles={["admin"]}>
      <AdminUserManagementContent />
    </AdminGate>
  );
}
