import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MoreHorizontal, Search, ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../hooks/useAdminData";
import { toast } from "../../lib/toast";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/routes";
import { Button, ConfirmDialog, Dialog, Input, Select } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { getPasswordStrength, STRONG_PASSWORD_ERROR } from "../../lib/passwordPolicy";
import { isValidEmail } from "../../lib/authValidation";
import { updateAdminVerification } from "../../services/api";

const toAdminAssetUrl = (value?: string) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const apiBase = import.meta.env.VITE_API_BASE || "/api";
  const origin = apiBase.startsWith("http") ? apiBase.replace(/\/api\/?$/, "") : window.location.origin;
  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
};

const getRoleLabel = (role: string | undefined, t: TFunction<"admin">) => {
  if (role === "superadmin") return t("userManagement.roles.superadmin");
  if (role === "admin") return t("userManagement.roles.admin");
  if (role === "hire") return t("userManagement.roles.employer");
  if (role === "both") return t("userManagement.roles.both");
  return t("userManagement.roles.worker");
};

const getStatusLabel = (status: string | undefined, t: TFunction<"admin">) => {
  if (status === "pending") return t("userManagement.statuses.pending");
  if (status === "disabled" || status === "deleted") return t("userManagement.statuses.disabled");
  return t("userManagement.statuses.active");
};

const getVerificationStatusLabel = (status: string | undefined, t: TFunction<"admin">) => {
  if (status === "in-review") return t("userManagement.details.verification.statusInReview");
  if (status === "complete") return t("userManagement.details.verification.statusComplete");
  if (status === "rejected") return t("userManagement.details.verification.statusRejected");
  return t("userManagement.details.verification.statusPending");
};

function AdminUserManagementContent() {
  const { t } = useTranslation("admin");
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
    reload,
  } = useAdminData();

  const prefersReducedMotion = useReducedMotion();
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
  const [reviewingDocument, setReviewingDocument] = useState<"identity" | "address" | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<"identity" | "address" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
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

  const handleVerificationReview = async (
    documentType: "identity" | "address",
    status: "complete" | "rejected",
    reason?: string,
  ) => {
    if (!selectedUser) return;
    const normalizedReason = reason?.trim();
    if (status === "rejected" && !normalizedReason) {
      setRejectionReason("");
      setRejectionTarget(documentType);
      return;
    }

    setReviewingDocument(documentType);
    try {
      await updateAdminVerification(selectedUser._id, documentType, {
        status,
        rejectionReason: status === "rejected" ? normalizedReason : undefined,
      });
      toast.success(status === "complete" ? t("userManagement.toast.verificationApproved") : t("userManagement.toast.verificationRejected"));
      setRejectionTarget(null);
      setRejectionReason("");
      reload();
    } catch (error: any) {
      toast.error(error?.message || t("userManagement.toast.verificationReviewFailed"));
    } finally {
      setReviewingDocument(null);
    }
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
    if (!form.firstName.trim()) errors.firstName = t("userManagement.formErrors.firstNameRequired");
    if (!form.lastName.trim()) errors.lastName = t("userManagement.formErrors.lastNameRequired");
    if (formMode === "create") {
      if (!isValidEmail(form.email)) errors.email = t("userManagement.formErrors.emailInvalid");
      if (!getPasswordStrength(form.password).isStrong) errors.password = STRONG_PASSWORD_ERROR;
      if (form.role === "admin" && !canManagePrivilegedRoles) errors.role = t("userManagement.formErrors.roleRestricted");
    }
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setIsSaving(true);
    try {
      if (formUserId) {
        await handleEditUser(formUserId, { firstName: form.firstName.trim(), lastName: form.lastName.trim(), role: form.role, status: form.status as 'active' | 'pending' | 'disabled' });
        toast.success(t("userManagement.toast.userUpdated"));
      } else if (formMode === "create") {
        await handleCreateUser({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), password: form.password, role: form.role as 'work' | 'hire' | 'admin' });
        toast.success(t("userManagement.toast.accountCreated"));
      }
      setFormMode(null);
    } catch (error: any) {
      setFormErrors({ form: error?.message || t("userManagement.toast.saveFailed") });
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
      toast.success(t("userManagement.toast.userDeleted", { name: getUserName(deleteTarget) }));
      setDeleteTargetId(null);
    } catch (error: any) {
      setDeleteError(error?.message || t("userManagement.toast.deleteFailed"));
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
            { label: t("userManagement.stats.totalAccounts.label"), value: totalUsers, detail: t("userManagement.stats.totalAccounts.detail", { count: newThisWeek }), icon: Users, tone: "bg-blue-50 text-blue-700" },
            { label: t("userManagement.stats.administrators.label"), value: adminCount, detail: t("userManagement.stats.administrators.detail"), icon: ShieldCheck, tone: "bg-violet-50 text-violet-700" },
            { label: t("userManagement.stats.activeAccounts.label"), value: activeToday, detail: t("userManagement.stats.activeAccounts.detail"), icon: UserCheck, tone: "bg-emerald-50 text-emerald-700" },
            { label: t("userManagement.stats.pendingReview.label"), value: pendingCount, detail: t("userManagement.stats.pendingReview.detail"), icon: UserPlus, tone: "bg-amber-50 text-amber-700" },
          ].map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
                <p className="mt-4 text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{isLoading ? "—" : card.value}</p>
                <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
              </motion.article>
            );
          })}
        </div>

        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">{t("userManagement.manage.title")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("userManagement.manage.subtitle")}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button ref={addAccountButtonRef} onClick={openCreate} className="shrink-0">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {t("userManagement.manage.addAccount")}
              </Button>
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  aria-label={t("userManagement.manage.searchAriaLabel")}
                  placeholder={t("userManagement.manage.searchPlaceholder")}
                  className="w-full h-10 rounded-[12px] border border-[#E5E7EB] pl-9 pr-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                />
              </div>
              <label className="sr-only" htmlFor="admin-role-filter">{t("userManagement.manage.roleFilterLabel")}</label>
              <select
                id="admin-role-filter"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">{t("userManagement.manage.roleFilterOptions.all")}</option>
                <option value="privileged">{t("userManagement.manage.roleFilterOptions.privileged")}</option>
                <option value="work">{t("userManagement.manage.roleFilterOptions.work")}</option>
                <option value="hire">{t("userManagement.manage.roleFilterOptions.hire")}</option>
                <option value="both">{t("userManagement.manage.roleFilterOptions.both")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 md:hidden" aria-label="Users">
            {isLoading && <p className="py-6 text-center text-sm text-slate-500">{t("userManagement.mobileList.loading")}</p>}
            {!isLoading && paginatedUsers.map((user, index) => (
              <motion.article
                key={user._id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-semibold text-slate-900">{getUserName(user)}</p><p className="truncate text-xs text-slate-600">{user.email}</p></div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(user.status)}`}>{getStatusLabel(user.status, t)}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">{t("userManagement.mobileList.roleLabel")}</dt><dd className="mt-1 capitalize text-slate-900">{getRoleLabel(user.role, t)}</dd></div><div><dt className="text-slate-500">{t("userManagement.mobileList.joinedLabel")}</dt><dd className="mt-1 text-slate-900">{formatJoinedDate(user._id)}</dd></div></dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-100" onClick={() => { setSelectedUserId(user._id); }}>{t("userManagement.mobileList.view")}</Button>
                  <Button disabled={!canManageUser(user)} onClick={() => openEdit(user)}>{canManageUser(user) ? t("userManagement.mobileList.edit") : t("userManagement.mobileList.restricted")}</Button>
                  {canManageUser(user) && <Button className="col-span-2 !bg-red-700 hover:!bg-red-800" onClick={() => { setDeleteError(null); setDeleteTargetId(user._id); }}>{t("userManagement.mobileList.delete")}</Button>}
                </div>
              </motion.article>
            ))}
            {!isLoading && paginatedUsers.length === 0 && <p className="py-6 text-center text-sm text-slate-500">{t("userManagement.mobileList.empty")}</p>}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                  <th className="py-3 pr-4 font-medium">{t("userManagement.table.headers.user")}</th>
                  <th className="py-3 pr-4 font-medium">{t("userManagement.table.headers.role")}</th>
                  <th className="py-3 pr-4 font-medium">{t("userManagement.table.headers.status")}</th>
                  <th className="py-3 pr-4 font-medium">{t("userManagement.table.headers.joined")}</th>
                  <th className="py-3 font-medium text-right">{t("userManagement.table.headers.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#9CA3AF]">
                      {t("userManagement.table.loading")}
                    </td>
                  </tr>
                )}

                {!isLoading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#9CA3AF]">
                      {t("userManagement.table.empty")}
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  paginatedUsers.map((user, index) => (
                    <motion.tr
                      key={user._id}
                      className="border-b border-[#F3F4F6] transition-colors hover:bg-slate-50"
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03, duration: 0.25 }}
                    >
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
                          {getRoleLabel(user.role, t)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
                            getStatusColor(user.status)
                          }`}
                        >
                          {getStatusLabel(user.status, t)}
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
                            aria-label={t("userManagement.table.openActionsAriaLabel")}
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
                                {t("userManagement.table.menu.viewProfile")}
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
                                {t("userManagement.table.menu.editUser")}
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
                                {t("userManagement.table.menu.messageUser")}
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
                                  {t("userManagement.table.menu.approveUser")}
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
                                {user.status === "disabled" ? t("userManagement.table.menu.activateUser") : t("userManagement.table.menu.suspendUser")}
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
                                {t("userManagement.table.menu.deleteUser")}
                              </button>}
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
              </tbody>
            </table>
          </div>

          {!isLoading && filteredUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[#E5E7EB] text-[13px] text-[#6B7280]">
              <span>
                {t("userManagement.table.pagination.showing", { start: pageStart + 1, end: pageEnd, total: filteredUsers.length })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#111827] disabled:text-[#9CA3AF] disabled:bg-[#F9FAFB]"
                >
                  {t("userManagement.table.pagination.previous")}
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
                  {t("userManagement.table.pagination.next")}
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
            className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto bg-white rounded-[20px] border border-[#E5E7EB] p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 id="admin-user-details-title" className="text-[18px] font-semibold text-[#111827]">{t("userManagement.details.title")}</h4>
                <p className="text-[13px] text-[#6B7280] mt-1">{t("userManagement.details.subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="text-[#6B7280] hover:text-[#111827] text-[20px]"
                aria-label={t("userManagement.details.closeAriaLabel")}
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
                <p className="text-[12px] uppercase tracking-wide text-[#9CA3AF]">{t("userManagement.details.statusLabel")}</p>
                <p className="mt-1 text-[#111827] capitalize">{getStatusLabel(selectedUser.status, t)}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wide text-[#9CA3AF]">{t("userManagement.details.roleLabel")}</p>
                <p className="mt-1 text-[#111827] capitalize">{getRoleLabel(selectedUser.role, t)}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wide text-[#9CA3AF]">{t("userManagement.details.phoneLabel")}</p>
                <p className="mt-1 text-[#111827]">{selectedUser.phoneNumber || "—"}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wide text-[#9CA3AF]">{t("userManagement.details.joinedLabel")}</p>
                <p className="mt-1 text-[#111827]">{formatJoinedDate(selectedUser._id)}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h5 className="text-sm font-semibold text-slate-900">{t("userManagement.details.verification.title")}</h5>
              <div className="mt-3 space-y-3">
                {(["identity", "address"] as const).map((documentType) => {
                  const document = selectedUser.verification?.[`${documentType}Document`];
                  const label = documentType === "identity" ? t("userManagement.details.verification.identityLabel") : t("userManagement.details.verification.addressLabel");
                  return (
                    <div key={documentType} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{label}</p>
                          <p className="mt-0.5 text-xs capitalize text-slate-600">{getVerificationStatusLabel(document?.status, t)}</p>
                        </div>
                        {document?.documentUrl ? (
                          <a
                            href={toAdminAssetUrl(document.documentUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            {t("userManagement.details.verification.viewDocument")}
                          </a>
                        ) : null}
                      </div>
                      {document?.rejectionReason ? (
                        <p className="mt-2 text-xs text-red-700">{t("userManagement.details.verification.reasonPrefix", { reason: document.rejectionReason })}</p>
                      ) : null}
                      {document?.status === "in-review" ? (
                        <div className="mt-3 flex gap-2">
                          <Button
                            disabled={reviewingDocument !== null}
                            onClick={() => void handleVerificationReview(documentType, "complete")}
                          >
                            {t("userManagement.details.verification.approve")}
                          </Button>
                          <Button
                            className="!bg-red-700 hover:!bg-red-800"
                            disabled={reviewingDocument !== null}
                            onClick={() => void handleVerificationReview(documentType, "rejected")}
                          >
                            {t("userManagement.details.verification.reject")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="px-4 py-2 rounded-[12px] border border-[#E5E7EB] text-[13px] text-[#111827] hover:bg-[#F9FAFB]"
              >
                {t("userManagement.details.close")}
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
                  {selectedUser.status === "disabled" ? t("userManagement.details.activate") : t("userManagement.details.suspend")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("userManagement.deleteDialog.title")}
        description={t("userManagement.deleteDialog.description", { name: deleteTarget ? getUserName(deleteTarget) : t("userManagement.deleteDialog.fallbackName") })}
        confirmLabel={t("userManagement.deleteDialog.confirmLabel")}
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
        open={rejectionTarget !== null}
        title={t("userManagement.rejectDialog.title")}
        description={t("userManagement.rejectDialog.description")}
        onClose={() => {
          if (reviewingDocument) return;
          setRejectionTarget(null);
          setRejectionReason("");
        }}
      >
        <label htmlFor="verification-rejection-reason" className="text-sm font-medium text-slate-700">
          {t("userManagement.rejectDialog.reasonLabel")}
        </label>
        <textarea
          id="verification-rejection-reason"
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.target.value)}
          maxLength={500}
          rows={4}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-700"
          placeholder={t("userManagement.rejectDialog.reasonPlaceholder")}
        />
        <div className="mt-5 flex justify-end gap-3">
          <Button
            className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50"
            disabled={reviewingDocument !== null}
            onClick={() => {
              setRejectionTarget(null);
              setRejectionReason("");
            }}
          >
            {t("userManagement.rejectDialog.cancel")}
          </Button>
          <Button
            className="!bg-red-700 hover:!bg-red-800"
            disabled={!rejectionReason.trim() || reviewingDocument !== null}
            onClick={() => rejectionTarget && void handleVerificationReview(rejectionTarget, "rejected", rejectionReason)}
          >
            {reviewingDocument ? t("userManagement.rejectDialog.rejecting") : t("userManagement.rejectDialog.reject")}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={formMode !== null}
        title={formMode === "create" ? t("userManagement.form.titleCreate") : t("userManagement.form.titleEdit")}
        description={formMode === "create" ? t("userManagement.form.descriptionCreate") : t("userManagement.form.descriptionEdit")}
        restoreFocusRef={formMode === "create" ? addAccountButtonRef : editMenuTriggerRef}
        onClose={() => !isSaving && setFormMode(null)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t("userManagement.form.firstNameLabel")} autoComplete="given-name" value={form.firstName} error={formErrors.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
          <Input label={t("userManagement.form.lastNameLabel")} autoComplete="family-name" value={form.lastName} error={formErrors.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
        </div>
        <div className="mt-4">
          <Input label={t("userManagement.form.emailLabel")} type="email" autoComplete="email" value={form.email} error={formErrors.email} disabled={formMode === "edit"} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
        </div>
        {formMode === "create" && (
          <div className="mt-4">
            <Input label={t("userManagement.form.passwordLabel")} type="password" autoComplete="new-password" value={form.password} error={formErrors.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
            <p className="mt-2 text-xs text-slate-500">{t("userManagement.form.passwordHint")}</p>
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label={t("userManagement.form.roleLabel")} value={form.role} error={formErrors.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
            <option value="work">{t("userManagement.form.roleOptions.worker")}</option><option value="hire">{t("userManagement.form.roleOptions.employer")}</option>
            {formMode === "edit" && <option value="both">{t("userManagement.form.roleOptions.both")}</option>}
            {canManagePrivilegedRoles && <option value="admin">{t("userManagement.form.roleOptions.admin")}</option>}
            {formMode === "edit" && canManagePrivilegedRoles && <option value="superadmin">{t("userManagement.form.roleOptions.superadmin")}</option>}
          </Select>
          {formMode === "edit" && <Select label={t("userManagement.form.statusLabel")} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">{t("userManagement.form.statusOptions.active")}</option><option value="pending">{t("userManagement.form.statusOptions.pending")}</option><option value="disabled">{t("userManagement.form.statusOptions.disabled")}</option></Select>}
        </div>
        {formErrors.form && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formErrors.form}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50" disabled={isSaving} onClick={() => setFormMode(null)}>{t("userManagement.form.cancel")}</Button>
          <Button disabled={isSaving} onClick={submitUserForm}>{isSaving ? t("userManagement.form.saving") : formMode === "create" ? t("userManagement.form.create") : t("userManagement.form.save")}</Button>
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
