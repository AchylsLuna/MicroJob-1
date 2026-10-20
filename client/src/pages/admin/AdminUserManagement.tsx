import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens, seconds } from "@/constants/motion";
import { AlertTriangle, MoreHorizontal, Search, ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../hooks/useAdminData";
import { toast } from "../../lib/toast";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/routes";
import { Button, ConfirmDialog, Dialog, Input, Select, Textarea } from "../../components/ui";
import { LAYER_Z } from "../../components/ui/layers";
import { useAuth } from "../../hooks/useAuth";
import { useAdminPermissions } from "../../hooks/useAdminPermissions";
import { getPasswordStrength, STRONG_PASSWORD_ERROR } from "../../lib/passwordPolicy";
import { isValidEmail } from "../../lib/authValidation";
import { banAdminUser, requestAdminUserPasswordReset, unlockAdminUser, updateAdminUserSuspiciousFlag, updateAdminVerification } from "../../services/api";

// A portal keeps the row menu outside the table's scrolling/clipping container.
function RowActionsMenu({ anchor, onClose, children }: {
  anchor: HTMLButtonElement;
  onClose: () => void;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const trigger = anchor.getBoundingClientRect();
      const menu = menuRef.current;
      if (!menu) return;
      const gap = 8;
      const top = trigger.bottom + gap + menu.offsetHeight > window.innerHeight
        ? trigger.top - menu.offsetHeight - gap
        : trigger.bottom + gap;
      setPosition({
        top: Math.max(gap, Math.min(top, window.innerHeight - menu.offsetHeight - gap)),
        left: Math.max(gap, Math.min(trigger.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - gap)),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor]);

  const isPlaced = position !== null;
  useEffect(() => {
    if (isPlaced) menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [anchor, isPlaced]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchor.contains(event.target) && !menuRef.current?.contains(event.target)) onClose();
    };
    const dismissHiddenAnchor = () => {
      if (anchor.getClientRects().length === 0) onClose();
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", dismissHiddenAnchor);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", dismissHiddenAnchor);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-label={anchor.getAttribute("aria-label") || undefined}
      className={`fixed ${LAYER_Z.furniture} max-h-[calc(100dvh-16px)] w-56 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg`}
      style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          anchor.focus();
        } else if (event.key === "Tab") {
          anchor.focus();
          onClose();
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') || []);
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

const toAdminAssetUrl = (value?: string) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const apiBase = import.meta.env.VITE_API_BASE || "/api";
  const origin = apiBase.startsWith("http") ? apiBase.replace(/\/api\/?$/, "") : window.location.origin;
  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
};

function StaffOtpTag({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation("admin");
  return <span aria-label={`${t("staffOtp.label")} ${t(enabled ? "staffOtp.on" : "staffOtp.off")}`}
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
    {t(enabled ? "staffOtp.on" : "staffOtp.off")}
  </span>;
}

const getRoleLabel = (role: string | undefined, t: TFunction<"admin">) => {
  if (role === "superadmin") return t("userManagement.roles.superadmin");
  if (role === "admin") return t("userManagement.roles.admin");
  if (role === "hire") return t("userManagement.roles.employer");
  if (role === "both") return t("userManagement.roles.both");
  return t("userManagement.roles.worker");
};

const getAccountRoleLabel = (
  user: { role?: string; staffRole?: string | null },
  t: TFunction<"admin">,
) => {
  if (user.role !== "admin") return getRoleLabel(user.role, t);
  if (user.staffRole === "moderator") return t("userManagement.roles.moderator");
  if (user.staffRole === "finance_team") return t("userManagement.roles.finance");
  if (user.staffRole === "analytics_team") return t("userManagement.roles.analytics");
  if (user.staffRole === "support_staff") return t("userManagement.roles.support");
  return t("userManagement.roles.adminTeam");
};

const getStatusLabel = (status: string | undefined, t: TFunction<"admin">) => {
  if (status === "pending") return t("userManagement.statuses.pending");
  if (status === "banned") return t("userManagement.statuses.banned");
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
  const { can } = useAdminPermissions();
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
  const [activeTab, setActiveTab] = useState<"users" | "admins" | "flagged">("users");
  const [roleFilter, setRoleFilter] = useState<"all" | "privileged" | "work" | "hire" | "both">("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<{ userId: string; anchor: HTMLButtonElement } | null>(null);
  const [banTarget, setBanTarget] = useState<{ userId: string; name: string } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banPending, setBanPending] = useState(false);
  const [banError, setBanError] = useState<string | null>(null);
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
  const [supportAction, setSupportAction] = useState<{ type: "password-reset" | "unlock"; userId: string; name: string } | null>(null);
  const [supportActionPending, setSupportActionPending] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState<"identity" | "address" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [flagTarget, setFlagTarget] = useState<{ userId: string; name: string; flagged: boolean } | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagPending, setFlagPending] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const editMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const addAccountButtonRef = useRef<HTMLButtonElement>(null);
  const pageSize = 10;

  const canViewAdminTab = can("users.staff.view");
  const canViewFlaggedTab = can("users.flags.view");
  const canFlagUsers = can("users.flag");

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
      const phone = user.phoneNumber ? String(user.phoneNumber).toLowerCase() : "";
      const role = String(user.role || "work").toLowerCase();
      const isMarketplaceUser = ["work", "hire", "both"].includes(role);
      // `superadmin` counts as staff everywhere else on this page -- the
      // "Admins" stat tile below tallies `admin || superadmin` -- but this tab
      // used to match `role === "admin"` alone. A superadmin is not a
      // marketplace user either, so the owner account appeared on no tab at
      // all while the stat insisted it existed.
      const isStaffUser = role === "admin" || role === "superadmin";
      // "Privileged" selects exactly the roles the users tab otherwise
      // excludes, so it has to widen what that tab admits rather than narrow
      // within it. Left as a pure narrowing it could never match a row.
      const wantsPrivileged = activeTab === "users" && roleFilter === "privileged";
      const matchesTab = activeTab === "users"
        ? (wantsPrivileged ? isStaffUser : isMarketplaceUser)
        : activeTab === "admins"
          ? isStaffUser
          : isMarketplaceUser && user.suspiciousFlagged === true;
      const matchesRole = activeTab !== "users" || roleFilter === "all"
        || wantsPrivileged
        || role === roleFilter;
      return matchesTab && matchesRole && (
        !normalizedSearch ||
        name.toLowerCase().includes(normalizedSearch) ||
        user.email?.toLowerCase().includes(normalizedSearch) ||
        String(user.staffRole || "").toLowerCase().includes(normalizedSearch) ||
        phone.includes(normalizedSearch)
      );
    });
  }, [users, searchTerm, roleFilter, activeTab]);

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
    setCurrentPage(1);
  }, [searchTerm, roleFilter, activeTab]);

  useEffect(() => {
    setOpenMenu(null);
  }, [searchTerm, roleFilter, activeTab, currentPage]);

  useEffect(() => {
    if (activeTab === "admins" && !canViewAdminTab) setActiveTab("users");
    if (activeTab === "flagged" && !canViewFlaggedTab) setActiveTab("users");
  }, [activeTab, canViewAdminTab, canViewFlaggedTab]);

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
  // RBAC write gate: Support Staff has `users.view` (this page) but not
  // `users.suspend`, so they land here read-only per the spec ("View User
  // profiles (Read-only)"). Combined with the self/privileged check above for
  // every mutating action — viewing and messaging stay ungated by permission.
  const canWriteUsers = can("users.suspend");
  const canResetPasswords = can("users.resetPassword");
  const canUnlockUsers = can("users.unlock");
  const canMutateUser = (user: typeof users[number]) => canWriteUsers && canManageUser(user);
  const canBanUser = (user: typeof users[number]) =>
    can("users.ban") && canManageUser(user) && isMarketplaceUser(user) && user.status !== "banned" && user.status !== "deleted";
  const canSupportUser = (user: typeof users[number]) =>
    canManageUser(user) && ["work", "hire", "both"].includes(String(user.role || "")) && user.status !== "deleted";

  const isMarketplaceUser = (user: typeof users[number]) => ["work", "hire", "both"].includes(String(user.role || ""));

  const openMessageThread = (user: typeof users[number]) => {
    const params = new URLSearchParams({
      startUser: user._id,
      startName: getUserName(user),
      source: "user-management",
    });
    navigate(`${ROUTES.admin.messages}?${params.toString()}`);
  };

  const openFullProfile = (user: typeof users[number]) => {
    const viewAs = user.role === "hire" ? "employer" : "worker";
    navigate(`${ROUTES.publicProfile(user._id)}?viewAs=${viewAs}`);
  };

  const openFlagDialog = (user: typeof users[number]) => {
    setFlagReason(user.suspiciousFlagReason || "");
    setFlagError(null);
    setFlagTarget({ userId: user._id, name: getUserName(user), flagged: Boolean(user.suspiciousFlagged) });
  };

  const submitFlagAction = async () => {
    if (!flagTarget) return;
    const nextFlagged = !flagTarget.flagged;
    const reason = flagReason.trim();
    if (nextFlagged && !reason) {
      setFlagError(t("userManagement.flagDialog.reasonRequired"));
      return;
    }
    setFlagPending(true);
    setFlagError(null);
    try {
      await updateAdminUserSuspiciousFlag(flagTarget.userId, { flagged: nextFlagged, reason: nextFlagged ? reason : undefined });
      toast.success(nextFlagged
        ? t("userManagement.toast.userFlagged", { name: flagTarget.name })
        : t("userManagement.toast.flagCleared", { name: flagTarget.name }));
      setFlagTarget(null);
      setFlagReason("");
      reload();
    } catch (error: any) {
      setFlagError(error?.message || t("userManagement.toast.flagFailed"));
    } finally {
      setFlagPending(false);
    }
  };

  const confirmSupportAction = async () => {
    if (!supportAction) return;
    setSupportActionPending(true);
    try {
      if (supportAction.type === "password-reset") {
        await requestAdminUserPasswordReset(supportAction.userId);
        toast.success(t("userManagement.toast.passwordResetSent", { name: supportAction.name }));
      } else {
        await unlockAdminUser(supportAction.userId);
        toast.success(t("userManagement.toast.accountUnlocked", { name: supportAction.name }));
        reload();
      }
      setSupportAction(null);
    } catch (error: any) {
      toast.error(error?.message || t("userManagement.toast.supportActionFailed"));
    } finally {
      setSupportActionPending(false);
    }
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

  const openBanDialog = (user: typeof users[number]) => {
    setBanReason("");
    setBanError(null);
    setBanTarget({ userId: user._id, name: getUserName(user) });
  };

  const submitBan = async () => {
    if (!banTarget || banPending) return;
    const target = users.find((user) => user._id === banTarget.userId);
    if (!target || !canBanUser(target)) return;
    const reason = banReason.trim();
    if (!reason) {
      setBanError(t("moderationQueue.enforceDialog.reasonRequired"));
      return;
    }
    setBanPending(true);
    setBanError(null);
    try {
      await banAdminUser(banTarget.userId, reason);
      toast.success(t("moderationQueue.toast.banned", { name: banTarget.name }));
      setBanTarget(null);
      reload();
    } catch (error: any) {
      setBanError(error?.message || t("userManagement.toast.saveFailed"));
    } finally {
      setBanPending(false);
    }
  };

  const renderRowActions = (user: typeof users[number]) => {
    const items: Array<{ label: string; action: () => void; tone?: string }> = [
      { label: t("userManagement.table.menu.viewProfile"), action: () => setSelectedUserId(user._id) },
    ];
    if (isMarketplaceUser(user)) items.push({ label: t("userManagement.table.menu.viewFullProfile"), action: () => openFullProfile(user) });
    if (canMutateUser(user)) items.push({ label: t("userManagement.table.menu.editUser"), action: () => {
      editMenuTriggerRef.current = openMenu?.anchor || null;
      openEdit(user);
    } });
    items.push({ label: t("userManagement.table.menu.messageUser"), action: () => openMessageThread(user) });
    if (canFlagUsers && isMarketplaceUser(user)) items.push({
      label: t(user.suspiciousFlagged ? "userManagement.table.menu.clearFlag" : "userManagement.table.menu.flagSuspicious"),
      action: () => openFlagDialog(user), tone: "text-amber-800 hover:bg-amber-50",
    });
    if (canResetPasswords && canSupportUser(user)) items.push({ label: t("userManagement.table.menu.resetPassword"), action: () => setSupportAction({ type: "password-reset", userId: user._id, name: getUserName(user) }) });
    if (canUnlockUsers && canSupportUser(user) && user.loginLocked) items.push({ label: t("userManagement.table.menu.unlockAccount"), action: () => setSupportAction({ type: "unlock", userId: user._id, name: getUserName(user) }) });
    if (user.status === "pending" && canMutateUser(user)) items.push({ label: t("userManagement.table.menu.approveUser"), action: () => void handleApproveUser(user) });
    if (canMutateUser(user) && user.status !== "deleted") items.push({
      label: t(user.status === "disabled" || user.status === "banned" ? "userManagement.table.menu.activateUser" : "userManagement.table.menu.suspendUser"),
      action: () => void handleToggleUserStatus(user), tone: "text-red-700 hover:bg-red-50",
    });
    if (canBanUser(user)) items.push({ label: t("moderationQueue.actions.banned"), action: () => openBanDialog(user), tone: "text-red-700 hover:bg-red-50" });
    if (canMutateUser(user)) items.push({ label: t("userManagement.table.menu.deleteUser"), action: () => {
      setDeleteError(null);
      setDeleteTargetId(user._id);
    }, tone: "font-semibold text-red-700 hover:bg-red-50" });

    return (
      <div className="inline-flex">
        <button
          type="button"
          aria-label={t("userManagement.table.openActionsAriaLabel")}
          aria-haspopup="menu"
          aria-expanded={openMenu?.userId === user._id}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          onClick={(event) => setOpenMenu(openMenu?.userId === user._id ? null : { userId: user._id, anchor: event.currentTarget })}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
        {openMenu?.userId === user._id && (
          <RowActionsMenu anchor={openMenu.anchor} onClose={() => setOpenMenu(null)}>
            {items.map((item) => (
              <button key={item.label} type="button" role="menuitem" className={`min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${item.tone || "text-slate-900 hover:bg-slate-50"}`}
                onClick={() => { item.action(); setOpenMenu(null); }}>
                {item.label}
              </button>
            ))}
          </RowActionsMenu>
        )}
      </div>
    );
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
        await handleEditUser(formUserId, { firstName: form.firstName.trim(), lastName: form.lastName.trim(), role: form.role, status: form.status as 'active' | 'pending' | 'disabled' | 'banned' });
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
      // The server reports exactly what's blocking deletion (balances, open
      // jobs, active applications, pending payouts) as a structured list
      // rather than one generic message — surface it so an admin knows what
      // to resolve instead of just "delete failed".
      if (Array.isArray(error?.blockers) && error.blockers.length > 0) {
        const blockerList = error.blockers
          .map((blocker: { message: string; count: number }) => `${blocker.message} (${blocker.count})`)
          .join(" ");
        setDeleteError(`${t("userManagement.deleteDialog.blockedPrefix")} ${blockerList}`);
      } else {
        setDeleteError(error?.message || t("userManagement.toast.deleteFailed"));
      }
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
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-xl text-body-sm">
          {loadError}
        </div>
      )}

      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t("userManagement.stats.totalAccounts.label"), value: totalUsers, detail: t("userManagement.stats.totalAccounts.detail", { count: newThisWeek }), icon: Users, tone: "bg-brand-50 text-brand-700" },
            { label: t("userManagement.stats.administrators.label"), value: adminCount, detail: t("userManagement.stats.administrators.detail"), icon: ShieldCheck, tone: "bg-violet-50 text-violet-700" },
            { label: t("userManagement.stats.activeAccounts.label"), value: activeToday, detail: t("userManagement.stats.activeAccounts.detail"), icon: UserCheck, tone: "bg-emerald-50 text-emerald-700" },
            { label: t("userManagement.stats.pendingReview.label"), value: pendingCount, detail: t("userManagement.stats.pendingReview.detail"), icon: UserPlus, tone: "bg-amber-50 text-amber-700" },
          ].map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.label}
                className="rounded-card border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: seconds(motionTokens.duration.standard) }}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
                <p className="mt-4 text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{isLoading ? "—" : card.value}</p>
                <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
              </motion.article>
            );
          })}
        </div>

        <div className="space-y-6 rounded-card border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4" role="tablist" aria-label={t("userManagement.tabs.label")}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "users"}
              onClick={() => setActiveTab("users")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === "users" ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {t("userManagement.tabs.users")}
            </button>
            {canViewAdminTab ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "admins"}
                onClick={() => setActiveTab("admins")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === "admins" ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {t("userManagement.tabs.admins")}
              </button>
            ) : null}
            {canViewFlaggedTab ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "flagged"}
                onClick={() => setActiveTab("flagged")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === "flagged" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"}`}
              >
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {t("userManagement.tabs.flagged")}
              </button>
            ) : null}
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-section font-bold text-slate-950">{t("userManagement.manage.title")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("userManagement.manage.subtitle")}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {canWriteUsers ? (
                <Button ref={addAccountButtonRef} onClick={openCreate} className="shrink-0">
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  {t("userManagement.manage.addAccount")}
                </Button>
              ) : null}
              {/* Below `sm` the parent is `flex-col`, so this is already full
                  width and the floor only served to overflow a 280px viewport. */}
              <div className="relative sm:min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  aria-label={t("userManagement.manage.searchAriaLabel")}
                  placeholder={t("userManagement.manage.searchPlaceholder")}
                  className="w-full h-10 rounded-xl border border-[#E5E7EB] pl-9 pr-3 text-body-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              {activeTab === "users" ? (
                <>
                  <label className="sr-only" htmlFor="admin-role-filter">{t("userManagement.manage.roleFilterLabel")}</label>
                  <select
                    id="admin-role-filter"
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-brand-600"
                  >
                    <option value="all">{t("userManagement.manage.roleFilterOptions.all")}</option>
                    {/* The one way to list staff from this tab. The state type,
                        the filter and the translations in both locales all
                        carried `privileged` already -- only the option itself
                        was missing, so admins and the superadmin could not be
                        surfaced here at all. */}
                    <option value="privileged">{t("userManagement.manage.roleFilterOptions.privileged")}</option>
                    <option value="work">{t("userManagement.manage.roleFilterOptions.work")}</option>
                    <option value="hire">{t("userManagement.manage.roleFilterOptions.hire")}</option>
                    <option value="both">{t("userManagement.manage.roleFilterOptions.both")}</option>
                  </select>
                </>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 md:hidden" aria-label="Users">
            {isLoading && <p className="py-6 text-center text-sm text-slate-500">{t("userManagement.mobileList.loading")}</p>}
            {!isLoading && paginatedUsers.map((user, index) => (
              <motion.article
                key={user._id}
                className="rounded-card border border-slate-200 bg-slate-50 p-4"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: seconds(motionTokens.duration.standard) }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="flex items-center gap-2 font-semibold text-slate-900">{getUserName(user)}{user.suspiciousFlagged ? <AlertTriangle className="h-4 w-4 text-amber-600" aria-label={t("userManagement.flaggedBadge")} /> : null}</p><p className="truncate text-xs text-slate-600">{user.email}</p></div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(user.status)}`}>{getStatusLabel(user.status, t)}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">{t("userManagement.mobileList.roleLabel")}</dt><dd className="mt-1 capitalize text-slate-900">{getAccountRoleLabel(user, t)}</dd></div><div><dt className="text-slate-500">{t("userManagement.mobileList.joinedLabel")}</dt><dd className="mt-1 text-slate-900">{formatJoinedDate(user._id)}</dd></div></dl>
                {activeTab === "admins" && <div className="mt-3 flex items-center gap-2 text-xs"><span className="text-slate-500">{t("staffOtp.label")}</span><StaffOtpTag enabled={Boolean(user.otpEnabled)} /></div>}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-100" onClick={() => { setSelectedUserId(user._id); }}>{t("userManagement.mobileList.view")}</Button>
                  <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-100" onClick={() => openMessageThread(user)}>{t("userManagement.table.menu.messageUser")}</Button>
                  {isMarketplaceUser(user) ? <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-100" onClick={() => openFullProfile(user)}>{t("userManagement.table.menu.viewFullProfile")}</Button> : null}
                  {canFlagUsers && isMarketplaceUser(user) ? <Button className="!bg-amber-600 hover:!bg-amber-700" onClick={() => openFlagDialog(user)}>{user.suspiciousFlagged ? t("userManagement.table.menu.clearFlag") : t("userManagement.table.menu.flagSuspicious")}</Button> : null}
                  {/* Read-only roles (no `users.suspend`) never see Edit at all — "Restricted"
                      is reserved for roles that CAN write but are blocked by the self/privileged-
                      target guard below, which is a different, pre-existing reason. */}
                  {canWriteUsers ? (
                    <Button disabled={!canManageUser(user)} onClick={() => openEdit(user)}>{canManageUser(user) ? t("userManagement.mobileList.edit") : t("userManagement.mobileList.restricted")}</Button>
                  ) : null}
                  {canResetPasswords && canSupportUser(user) ? (
                    <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-100" onClick={() => setSupportAction({ type: "password-reset", userId: user._id, name: getUserName(user) })}>{t("userManagement.table.menu.resetPassword")}</Button>
                  ) : null}
                  {canUnlockUsers && canSupportUser(user) && user.loginLocked ? (
                    <Button onClick={() => setSupportAction({ type: "unlock", userId: user._id, name: getUserName(user) })}>{t("userManagement.table.menu.unlockAccount")}</Button>
                  ) : null}
                  {canMutateUser(user) && user.status !== "deleted" ? <Button className="!bg-white !text-red-700 ring-1 ring-red-200 hover:!bg-red-50" onClick={() => void handleToggleUserStatus(user)}>{t(user.status === "disabled" || user.status === "banned" ? "userManagement.table.menu.activateUser" : "userManagement.table.menu.suspendUser")}</Button> : null}
                  {canBanUser(user) ? <Button className="!bg-red-700 hover:!bg-red-800" onClick={() => openBanDialog(user)}>{t("moderationQueue.actions.banned")}</Button> : null}
                  {canMutateUser(user) && <Button className="col-span-2 !bg-red-700 hover:!bg-red-800" onClick={() => { setDeleteError(null); setDeleteTargetId(user._id); }}>{t("userManagement.mobileList.delete")}</Button>}
                </div>
              </motion.article>
            ))}
            {!isLoading && paginatedUsers.length === 0 && <p className="py-6 text-center text-sm text-slate-500">{t("userManagement.mobileList.empty")}</p>}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                  <th className="py-3 pr-4 font-medium">{t("userManagement.table.headers.user")}</th>
                  <th className="py-3 pr-4 font-medium">{t("userManagement.table.headers.role")}</th>
                  <th className="py-3 pr-4 font-medium">{t("userManagement.table.headers.status")}</th>
                  {activeTab === "admins" && <th className="py-3 pr-4 font-medium">{t("staffOtp.label")}</th>}
                  <th className="py-3 pr-4 font-medium">{t("userManagement.table.headers.joined")}</th>
                  <th className="py-3 text-right font-medium">{t("userManagement.table.headers.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={activeTab === "admins" ? 6 : 5} className="py-6 text-center text-[#9CA3AF]">
                      {t("userManagement.table.loading")}
                    </td>
                  </tr>
                )}

                {!isLoading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === "admins" ? 6 : 5} className="py-6 text-center text-[#9CA3AF]">
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
                      transition={{ delay: index * 0.03, duration: seconds(motionTokens.duration.enter) }}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand/[0.06] text-brand flex items-center justify-center font-semibold">
                            {getInitials(user)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 text-[#111827] font-medium">{getUserName(user)}{user.suspiciousFlagged ? <AlertTriangle className="h-4 w-4 text-amber-600" aria-label={t("userManagement.flaggedBadge")} /> : null}</div>
                            <div className="text-caption text-[#6B7280]">
                              {user.email || getShortId(user._id)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === "superadmin" ? "bg-violet-100 text-violet-800" : user.role === "admin" ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-700"}`}>
                          {getAccountRoleLabel(user, t)}
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
                      {activeTab === "admins" && <td className="py-3 pr-4"><StaffOtpTag enabled={Boolean(user.otpEnabled)} /></td>}
                      <td className="py-3 pr-4 text-[#6B7280]">{formatJoinedDate(user._id)}</td>
                      <td className="py-3 text-right">{renderRowActions(user)}</td>
                    </motion.tr>
                  ))}
              </tbody>
            </table>
          </div>

          {!isLoading && filteredUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[#E5E7EB] text-body-sm text-[#6B7280]">
              <span>
                {t("userManagement.table.pagination.showing", { start: pageStart + 1, end: pageEnd, total: filteredUsers.length })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 rounded-control border border-[#E5E7EB] text-[#111827] disabled:text-[#9CA3AF] disabled:bg-[#F9FAFB]"
                >
                  {t("userManagement.table.pagination.previous")}
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-[8px] text-body-sm ${
                        page === safePage
                          ? "bg-brand text-white"
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
                  className="px-3 py-1.5 rounded-control border border-[#E5E7EB] text-[#111827] disabled:text-[#9CA3AF] disabled:bg-[#F9FAFB]"
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
          className={`fixed inset-0 ${LAYER_Z.modal} flex items-center justify-center bg-black/30 p-4`}
          role="presentation"
          onClick={(event) => event.target === event.currentTarget && setSelectedUserId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-details-title"
            className="max-h-[90dvh] w-full max-w-[520px] overflow-y-auto bg-white rounded-[20px] border border-[#E5E7EB] p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 id="admin-user-details-title" className="text-[18px] font-semibold text-[#111827]">{t("userManagement.details.title")}</h4>
                <p className="text-body-sm text-[#6B7280] mt-1">{t("userManagement.details.subtitle")}</p>
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
              <div className="w-14 h-14 rounded-full bg-brand/[0.06] text-brand flex items-center justify-center font-semibold text-[18px]">
                {getInitials(selectedUser)}
              </div>
              <div>
                <div className="text-[16px] font-semibold text-[#111827]">{getUserName(selectedUser)}</div>
                <div className="text-body-sm text-[#6B7280]">{selectedUser.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-body-sm text-[#6B7280]">
              <div>
                <p className="text-caption uppercase tracking-wide text-[#9CA3AF]">{t("userManagement.details.statusLabel")}</p>
                <p className="mt-1 text-[#111827] capitalize">{getStatusLabel(selectedUser.status, t)}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-wide text-[#9CA3AF]">{t("userManagement.details.roleLabel")}</p>
                <p className="mt-1 text-[#111827] capitalize">{getAccountRoleLabel(selectedUser, t)}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-wide text-[#9CA3AF]">{t("userManagement.details.phoneLabel")}</p>
                <p className="mt-1 text-[#111827]">{selectedUser.phoneNumber || "—"}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-wide text-[#9CA3AF]">{t("userManagement.details.joinedLabel")}</p>
                <p className="mt-1 text-[#111827]">{formatJoinedDate(selectedUser._id)}</p>
              </div>
            </div>

            {selectedUser.suspiciousFlagged ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  {t("userManagement.details.suspiciousTitle")}
                </div>
                <p className="mt-2">{selectedUser.suspiciousFlagReason || t("userManagement.details.suspiciousNoReason")}</p>
              </div>
            ) : null}

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
                            className="text-xs font-semibold text-brand-700 hover:underline"
                          >
                            {t("userManagement.details.verification.viewDocument")}
                          </a>
                        ) : null}
                      </div>
                      {document?.rejectionReason ? (
                        <p className="mt-2 text-xs text-red-700">{t("userManagement.details.verification.reasonPrefix", { reason: document.rejectionReason })}</p>
                      ) : null}
                      {document?.status === "in-review" && can("verification.review") ? (
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

            <div className="flex flex-wrap items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => openMessageThread(selectedUser)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-body-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t("userManagement.table.menu.messageUser")}
              </button>
              {isMarketplaceUser(selectedUser) ? (
                <button
                  type="button"
                  onClick={() => openFullProfile(selectedUser)}
                  className="px-4 py-2 rounded-xl border border-brand-300 text-body-sm font-semibold text-brand-800 hover:bg-brand-50"
                >
                  {t("userManagement.table.menu.viewFullProfile")}
                </button>
              ) : null}
              {canFlagUsers && isMarketplaceUser(selectedUser) ? (
                <button
                  type="button"
                  onClick={() => openFlagDialog(selectedUser)}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-body-sm font-semibold text-white hover:bg-amber-700"
                >
                  {selectedUser.suspiciousFlagged ? t("userManagement.table.menu.clearFlag") : t("userManagement.table.menu.flagSuspicious")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="px-4 py-2 rounded-xl border border-[#E5E7EB] text-body-sm text-[#111827] hover:bg-[#F9FAFB]"
              >
                {t("userManagement.details.close")}
              </button>
              {canMutateUser(selectedUser) && (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleUserStatus(selectedUser);
                    setSelectedUserId(null);
                  }}
                  className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${
                    selectedUser.status === "disabled" || selectedUser.status === "banned"
                      ? "bg-slate-200 text-slate-900"
                      : "bg-red-700 text-white"
                  }`}
                >
                  {selectedUser.status === "disabled" || selectedUser.status === "banned" ? t("userManagement.details.activate") : t("userManagement.details.suspend")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(banTarget)}
        closeDisabled={banPending}
        title={t("moderationQueue.enforceDialog.titleBan")}
        description={banTarget ? t("moderationQueue.enforceDialog.description", { name: banTarget.name }) : ""}
        onClose={() => { if (!banPending) setBanTarget(null); }}
      >
        <Textarea label={t("moderationQueue.enforceDialog.reasonLabel")} value={banReason} maxLength={2000} error={banError || undefined}
          onChange={(event) => { setBanReason(event.target.value); setBanError(null); }} />
        <div className="mt-6 flex justify-end gap-3">
          <Button disabled={banPending} onClick={() => setBanTarget(null)} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">{t("moderationQueue.enforceDialog.cancel")}</Button>
          <Button disabled={banPending || !banReason.trim()} onClick={() => void submitBan()} className="!bg-red-700 hover:!bg-red-800">{t("moderationQueue.actions.banned")}</Button>
        </div>
      </Dialog>

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

      <ConfirmDialog
        open={Boolean(supportAction)}
        title={supportAction?.type === "unlock" ? t("userManagement.supportActionDialog.unlockTitle") : t("userManagement.supportActionDialog.resetTitle")}
        description={supportAction?.type === "unlock"
          ? t("userManagement.supportActionDialog.unlockDescription", { name: supportAction?.name })
          : t("userManagement.supportActionDialog.resetDescription", { name: supportAction?.name })}
        confirmLabel={supportAction?.type === "unlock" ? t("userManagement.table.menu.unlockAccount") : t("userManagement.table.menu.resetPassword")}
        pending={supportActionPending}
        onConfirm={confirmSupportAction}
        onClose={() => {
          if (!supportActionPending) setSupportAction(null);
        }}
      />

      <Dialog
        open={flagTarget !== null}
        title={flagTarget?.flagged ? t("userManagement.flagDialog.clearTitle") : t("userManagement.flagDialog.flagTitle")}
        description={flagTarget?.flagged
          ? t("userManagement.flagDialog.clearDescription", { name: flagTarget?.name })
          : t("userManagement.flagDialog.flagDescription", { name: flagTarget?.name })}
        onClose={() => {
          if (flagPending) return;
          setFlagTarget(null);
          setFlagReason("");
          setFlagError(null);
        }}
      >
        {!flagTarget?.flagged ? (
          <>
            <label htmlFor="suspicious-flag-reason" className="text-sm font-medium text-slate-700">
              {t("userManagement.flagDialog.reasonLabel")}
            </label>
            <textarea
              id="suspicious-flag-reason"
              value={flagReason}
              onChange={(event) => setFlagReason(event.target.value)}
              maxLength={1000}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-600"
              placeholder={t("userManagement.flagDialog.reasonPlaceholder")}
            />
          </>
        ) : null}
        {flagError ? <p role="alert" className="mt-3 text-sm text-red-700">{flagError}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <Button
            className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50"
            disabled={flagPending}
            onClick={() => {
              setFlagTarget(null);
              setFlagReason("");
              setFlagError(null);
            }}
          >
            {t("userManagement.flagDialog.cancel")}
          </Button>
          <Button
            className={flagTarget?.flagged ? "!bg-slate-800 hover:!bg-slate-900" : "!bg-amber-600 hover:!bg-amber-700"}
            disabled={flagPending || (!flagTarget?.flagged && !flagReason.trim())}
            onClick={() => void submitFlagAction()}
          >
            {flagPending
              ? t("userManagement.flagDialog.saving")
              : flagTarget?.flagged
                ? t("userManagement.flagDialog.clearConfirm")
                : t("userManagement.flagDialog.flagConfirm")}
          </Button>
        </div>
      </Dialog>

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
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-700"
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
          {formMode === "edit" && <Select label={t("userManagement.form.statusLabel")} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">{t("userManagement.form.statusOptions.active")}</option><option value="pending">{t("userManagement.form.statusOptions.pending")}</option><option value="disabled">{t("userManagement.form.statusOptions.disabled")}</option>{form.status === "banned" ? <option value="banned" disabled>{t("userManagement.statuses.banned")}</option> : null}</Select>}
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
    <AdminGate permission="users.view">
      <AdminUserManagementContent />
    </AdminGate>
  );
}
