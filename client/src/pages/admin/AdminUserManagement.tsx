import { useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Search, ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../hooks/useAdminData";
import { toast } from "../../lib/toast";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/routes";
import { Button, ConfirmDialog, Dialog, Input, Select } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { getPasswordStrength, STRONG_PASSWORD_ERROR } from "../../lib/passwordPolicy";

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
    handleEditUser,
    handleCreateUser,
    handleDeleteUser,
  } = useAdminData();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "privileged" | "work" | "hire" | "both">("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formUserId, setFormUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "work", status: "active" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const editMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const addAccountButtonRef = useRef<HTMLButtonElement>(null);
  const pageSize = 5;

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
      const phone = user.phoneNumber ? String(user.phoneNumber).toLowerCase() : "";
      const role = String(user.role || "work").toLowerCase();
      const matchesRole = roleFilter === "all"
        || (roleFilter === "privileged" && (role === "admin" || role === "superadmin"))
        || role === roleFilter;
      return matchesRole && (
        !normalizedSearch ||
        name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        phone.includes(normalizedSearch)
      );
    });
  }, [users, searchTerm, roleFilter]);

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
  const deleteTarget = deleteTargetId ? users.find((user) => user._id === deleteTargetId) : null;
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
  const adminCount = users.filter((user) => user.role === "admin" || user.role === "superadmin").length;
  const pendingCount = users.filter((user) => user.status === "pending").length;

  useEffect(() => {
    if (!openMenuId) return;
    const handleWindowClick = () => setOpenMenuId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [openMenuId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filteredUsers.length);
  const paginatedUsers = filteredUsers.slice(pageStart, pageStart + pageSize);
  const canManagePrivilegedRoles = currentUser?.systemRole === "superadmin";
  const canManageUser = (user: typeof users[number]) => {
    const privileged = user.role === "admin" || user.role === "superadmin";
    const isSelf = user._id === currentUser?.id;
    return !isSelf && (!privileged || canManagePrivilegedRoles);
  };

  const openEdit = (user: typeof users[number]) => {
    setForm({ firstName: user.firstName || "", lastName: user.lastName || "", email: user.email, password: "", role: user.role || "work", status: user.status === "deleted" ? "disabled" : user.status || "active" });
    setFormErrors({});
    setFormUserId(user._id);
    setFormMode("edit");
  };

  const openCreate = () => {
    setForm({ firstName: "", lastName: "", email: "", password: "", role: "work", status: "active" });
    setFormErrors({});
    setFormUserId(null);
    setFormMode("create");
  };

  const submitUserForm = async () => {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = "First name is required.";
    if (!form.lastName.trim()) errors.lastName = "Last name is required.";
    if (formMode === "create") {
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
      if (!getPasswordStrength(form.password).isStrong) errors.password = STRONG_PASSWORD_ERROR;
      if (form.role === "admin" && !canManagePrivilegedRoles) errors.role = "Only a superadmin can create an administrator.";
    }
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setIsSaving(true);
    try {
      if (formUserId) {
        await handleEditUser(formUserId, { firstName: form.firstName.trim(), lastName: form.lastName.trim(), role: form.role, status: form.status as 'active' | 'pending' | 'disabled' });
        toast.success("User updated successfully.");
      } else if (formMode === "create") {
        await handleCreateUser({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), password: form.password, role: form.role as 'work' | 'hire' | 'admin' });
        toast.success("Account created. The temporary password must be changed at first sign-in.");
      }
      setFormMode(null);
    } catch (error: any) {
      setFormErrors({ form: error?.message || "Unable to save the user." });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await handleDeleteUser(deleteTarget._id);
      toast.success(`${getUserName(deleteTarget)} deleted successfully.`);
      setDeleteTargetId(null);
    } catch (error: any) {
      setDeleteError(error?.message || "Unable to delete this user.");
    } finally {
      setIsDeleting(false);
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total accounts", value: totalUsers, detail: `${newThisWeek} joined this week`, icon: Users, tone: "bg-blue-50 text-blue-700" },
            { label: "Administrators", value: adminCount, detail: "Admins and superadmins", icon: ShieldCheck, tone: "bg-violet-50 text-violet-700" },
            { label: "Active accounts", value: activeToday, detail: "Currently enabled", icon: UserCheck, tone: "bg-emerald-50 text-emerald-700" },
            { label: "Pending review", value: pendingCount, detail: "Awaiting approval", icon: UserPlus, tone: "bg-amber-50 text-amber-700" },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
                <p className="mt-4 text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{isLoading ? "—" : card.value}</p>
                <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
              </article>
            );
          })}
        </div>

        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Manage accounts</h2>
              <p className="mt-1 text-sm text-slate-500">Review users, administrators, roles, and account access.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button ref={addAccountButtonRef} onClick={openCreate} className="shrink-0">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add account
              </Button>
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
              <label className="sr-only" htmlFor="admin-role-filter">Filter accounts by role</label>
              <select
                id="admin-role-filter"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All roles</option>
                <option value="privileged">Administrators</option>
                <option value="work">Workers</option>
                <option value="hire">Employers</option>
                <option value="both">Worker & employer</option>
              </select>
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
                  <Button disabled={!canManageUser(user)} onClick={() => openEdit(user)}>{canManageUser(user) ? "Edit" : "Restricted"}</Button>
                  {canManageUser(user) && <Button className="col-span-2 !bg-red-700 hover:!bg-red-800" onClick={() => { setDeleteError(null); setDeleteTargetId(user._id); }}>Delete user</Button>}
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
                  <th className="py-3 pr-4 font-medium">Role</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Joined</th>
                  <th className="py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#9CA3AF]">
                      Loading users...
                    </td>
                  </tr>
                )}

                {!isLoading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#9CA3AF]">
                      No users found for the selected filters.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  paginatedUsers.map((user) => (
                    <tr key={user._id} className="border-b border-[#F3F4F6]">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1C4D8D]/[0.06] text-[#1C4D8D] flex items-center justify-center font-semibold">
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
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === "superadmin" ? "bg-violet-100 text-violet-800" : user.role === "admin" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>
                          {user.role === "superadmin" ? "Superadmin" : user.role === "admin" ? "Admin" : user.role === "hire" ? "Employer" : user.role === "both" ? "Both" : "Worker"}
                        </span>
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
                              {canManageUser(user) && <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserId(user._id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-[13px] text-[#111827] hover:bg-[#F8FAFC]"
                              >
                                View Profile
                              </button>}
                              <button
                                type="button"
                                onClick={(event) => {
                                  editMenuTriggerRef.current = event.currentTarget
                                    .closest(".relative")
                                    ?.querySelector<HTMLButtonElement>('[aria-label="Open user actions"]') || null;
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
                              {user.status === "pending" && canManageUser(user) && (
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
                              {canManageUser(user) && <button
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
                              </button>}
                              {canManageUser(user) && <button
                                type="button"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleteTargetId(user._id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-[13px] font-semibold text-red-700 hover:bg-red-50"
                              >
                                Delete User
                              </button>}
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
              <div className="w-14 h-14 rounded-full bg-[#1C4D8D]/[0.06] text-[#1C4D8D] flex items-center justify-center font-semibold text-[18px]">
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
              {canManageUser(selectedUser) && (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleUserStatus(selectedUser);
                    setSelectedUserId(null);
                  }}
                  className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${
                    selectedUser.status === "disabled"
                      ? "bg-slate-200 text-slate-900"
                      : "bg-red-700 text-white"
                  }`}
                >
                  {selectedUser.status === "disabled" ? "Activate" : "Suspend"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete user"
        description={`Delete ${deleteTarget ? getUserName(deleteTarget) : "this user"}? Their account will be anonymized and they will lose access. Accounts with active balances, payouts, jobs, or applications cannot be deleted.`}
        confirmLabel="Delete user"
        destructive
        pending={isDeleting}
        error={deleteError}
        onConfirm={confirmDeleteUser}
        onClose={() => {
          if (isDeleting) return;
          setDeleteTargetId(null);
          setDeleteError(null);
        }}
      />

      <Dialog
        open={formMode !== null}
        title={formMode === "create" ? "Add account" : "Edit user"}
        description={formMode === "create" ? "Create an active account with a temporary password." : "Email addresses cannot be changed by administrators."}
        restoreFocusRef={formMode === "create" ? addAccountButtonRef : editMenuTriggerRef}
        onClose={() => !isSaving && setFormMode(null)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="First name" autoComplete="given-name" value={form.firstName} error={formErrors.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
          <Input label="Last name" autoComplete="family-name" value={form.lastName} error={formErrors.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
        </div>
        <div className="mt-4">
          <Input label="Email" type="email" autoComplete="email" value={form.email} error={formErrors.email} disabled={formMode === "edit"} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
        </div>
        {formMode === "create" && (
          <div className="mt-4">
            <Input label="Temporary password" type="password" autoComplete="new-password" value={form.password} error={formErrors.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
            <p className="mt-2 text-xs text-slate-500">At least 8 characters with uppercase, lowercase, number, and special character. The user must replace it at first sign-in.</p>
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Role" value={form.role} error={formErrors.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
            <option value="work">Worker</option><option value="hire">Employer</option>
            {formMode === "edit" && <option value="both">Worker and employer</option>}
            {canManagePrivilegedRoles && <option value="admin">Admin</option>}
            {formMode === "edit" && canManagePrivilegedRoles && <option value="superadmin">Superadmin</option>}
          </Select>
          {formMode === "edit" && <Select label="Status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="pending">Pending</option><option value="disabled">Disabled</option></Select>}
        </div>
        {formErrors.form && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formErrors.form}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50" disabled={isSaving} onClick={() => setFormMode(null)}>Cancel</Button>
          <Button disabled={isSaving} onClick={submitUserForm}>{isSaving ? "Saving…" : formMode === "create" ? "Create account" : "Save changes"}</Button>
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
