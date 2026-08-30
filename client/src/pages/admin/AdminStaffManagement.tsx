import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck, UserCog, UserX, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminGate } from "./admin/AdminGate";
import { Button, ConfirmDialog, Dialog, Input, Select, StatusState } from "../../components/ui";
import { toast } from "../../lib/toast";
import { formatDateTime } from "../../lib/formatters";
import { useAuth } from "../../hooks/useAuth";
import { useAdminPermissions } from "../../hooks/useAdminPermissions";
import { createAdminStaff, getAdminStaff, updateAdminStaffRole, updateAdminStaffStatus } from "../../services/api";
import type { StaffAccount } from "../../lib/adminFixtures";
import { ADMIN_STAFF_ROLES, ROLE_BADGE_STYLE, type AdminStaffRole } from "../../lib/adminPermissions";

/**
 * Staff accounts are persisted by the admin staff API. The local array is
 * only the current server snapshot used for filtering and optimistic-free UI.
 */
function AdminStaffManagementContent() {
  const { t } = useTranslation("admin");
  const { user: currentUser } = useAuth();
  const { can } = useAdminPermissions();
  const prefersReducedMotion = useReducedMotion();

  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminStaffRole>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", email: "", staffRole: ADMIN_STAFF_ROLES[0] });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const [roleTarget, setRoleTarget] = useState<StaffAccount | null>(null);
  const [roleDraft, setRoleDraft] = useState<AdminStaffRole>(ADMIN_STAFF_ROLES[0]);

  const [statusTarget, setStatusTarget] = useState<StaffAccount | null>(null);

  useEffect(() => {
    let active = true;
    getAdminStaff()
      .then((accounts) => {
        if (active) setStaff(accounts.map((account) => ({ ...account, staffRole: account.staffRole as AdminStaffRole })));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : t("staffManagement.states.emptyDescription")));
    return () => { active = false; };
  }, [t]);

  const roleLabel = (role: AdminStaffRole) => t(`staffManagement.roles.${role}`);

  const isSelf = (account: StaffAccount) =>
    Boolean(currentUser) && (account.id === currentUser?.id || account.email === currentUser?.email);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((account) => {
      const matchesRole = roleFilter === "all" || account.staffRole === roleFilter;
      const matchesSearch =
        !query ||
        `${account.firstName} ${account.lastName}`.toLowerCase().includes(query) ||
        account.email.toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [staff, search, roleFilter]);

  const counts = useMemo(
    () => ({
      total: staff.length,
      active: staff.filter((account) => account.status === "active").length,
      disabled: staff.filter((account) => account.status === "disabled").length,
    }),
    [staff],
  );

  const openCreate = () => {
    setCreateForm({ firstName: "", lastName: "", email: "", staffRole: ADMIN_STAFF_ROLES[0] });
    setCreateErrors({});
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const errors: Record<string, string> = {};
    if (!createForm.firstName.trim()) errors.firstName = t("staffManagement.formErrors.firstNameRequired");
    if (!createForm.lastName.trim()) errors.lastName = t("staffManagement.formErrors.lastNameRequired");
    if (!/^\S+@\S+\.\S+$/.test(createForm.email.trim())) errors.email = t("staffManagement.formErrors.emailInvalid");
    if (staff.some((account) => account.email.toLowerCase() === createForm.email.trim().toLowerCase())) {
      errors.email = t("staffManagement.formErrors.emailTaken");
    }
    setCreateErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      const { staff: created } = await createAdminStaff({ ...createForm, email: createForm.email.trim() });
      const account = { ...created, staffRole: created.staffRole as AdminStaffRole };
      setStaff((current) => [account, ...current]);
      toast.success(t("staffManagement.toast.created", { name: `${account.firstName} ${account.lastName}` }));
      setCreateOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("staffManagement.formErrors.emailTaken"));
    }
  };

  const openRoleChange = (account: StaffAccount) => {
    setRoleDraft(account.staffRole);
    setRoleTarget(account);
  };

  const submitRoleChange = async () => {
    if (!roleTarget) return;
    try {
      await updateAdminStaffRole(roleTarget.id, roleDraft);
      setStaff((current) => current.map((account) => (account.id === roleTarget.id ? { ...account, staffRole: roleDraft } : account)));
      toast.success(t("staffManagement.toast.roleUpdated", { name: `${roleTarget.firstName} ${roleTarget.lastName}` }));
      setRoleTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("staffManagement.states.emptyDescription"));
    }
  };

  const submitStatusToggle = async () => {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === "active" ? "disabled" : "active";
    try {
      await updateAdminStaffStatus(statusTarget.id, nextStatus);
      setStaff((current) => current.map((account) => (account.id === statusTarget.id ? { ...account, status: nextStatus } : account)));
      toast.success(
        nextStatus === "disabled"
          ? t("staffManagement.toast.disabled", { name: `${statusTarget.firstName} ${statusTarget.lastName}` })
          : t("staffManagement.toast.enabled", { name: `${statusTarget.firstName} ${statusTarget.lastName}` }),
      );
      setStatusTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("staffManagement.states.emptyDescription"));
    }
  };

  return (
    <div className="mx-auto max-w-[1341px] space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: t("staffManagement.cards.total"), value: counts.total, icon: ShieldCheck, tone: "bg-blue-50 text-blue-800" },
          { label: t("staffManagement.cards.active"), value: counts.active, icon: UserCog, tone: "bg-emerald-50 text-emerald-800" },
          { label: t("staffManagement.cards.disabled"), value: counts.disabled, icon: UserX, tone: "bg-slate-100 text-slate-700" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-950">{t("staffManagement.title")}</h1>
            <p className="mt-1 text-sm text-slate-600">{t("staffManagement.subtitle")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block text-sm font-semibold text-slate-700">
              {t("staffManagement.filters.roleLabel")}
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
                className="mt-1 block min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">{t("staffManagement.filters.allRoles")}</option>
                {ADMIN_STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>{roleLabel(role)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              {t("staffManagement.filters.searchLabel")}
              <span className="relative mt-1 block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("staffManagement.filters.searchPlaceholder")}
                  className="min-h-11 w-full rounded-xl border border-slate-300 pl-9 pr-3 font-normal outline-none focus:ring-2 focus:ring-blue-600 sm:w-64"
                />
              </span>
            </label>
            {can("staff.create") ? (
              <Button onClick={openCreate}>{t("staffManagement.actions.createStaff")}</Button>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          {filtered.length === 0 ? (
            <StatusState
              title={t("staffManagement.states.emptyTitle")}
              description={t("staffManagement.states.emptyDescription")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <caption className="sr-only">{t("staffManagement.table.caption")}</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th scope="col" className="px-3 py-3">{t("staffManagement.table.name")}</th>
                    <th scope="col" className="px-3 py-3">{t("staffManagement.table.role")}</th>
                    <th scope="col" className="px-3 py-3">{t("staffManagement.table.status")}</th>
                    <th scope="col" className="px-3 py-3">{t("staffManagement.table.lastActive")}</th>
                    <th scope="col" className="px-3 py-3 text-right">{t("staffManagement.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((account, index) => (
                    <motion.tr
                      key={account.id}
                      className="border-b border-slate-100 align-top"
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03, duration: 0.25 }}
                    >
                      <td className="px-3 py-4">
                        <p className="font-semibold text-slate-950">{account.firstName} {account.lastName}</p>
                        <p className="mt-1 text-xs text-slate-500">{account.email}</p>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_BADGE_STYLE[account.staffRole]}`}>
                          {roleLabel(account.staffRole)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${account.status === "active" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>
                          {t(`staffManagement.statuses.${account.status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-600">{formatDateTime(account.lastActiveAt)}</td>
                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-2">
                          {can("staff.assignRole") && !isSelf(account) ? (
                            <Button onClick={() => openRoleChange(account)} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">
                              {t("staffManagement.actions.changeRole")}
                            </Button>
                          ) : null}
                          {can("staff.toggleStatus") && !isSelf(account) ? (
                            <Button
                              onClick={() => setStatusTarget(account)}
                              className={account.status === "active" ? "!bg-white !text-red-700 ring-1 ring-red-300 hover:!bg-red-50" : "!bg-emerald-700 hover:!bg-emerald-800"}
                            >
                              {account.status === "active" ? t("staffManagement.actions.disable") : t("staffManagement.actions.enable")}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={createOpen}
        title={t("staffManagement.createDialog.title")}
        description={t("staffManagement.createDialog.description")}
        onClose={() => setCreateOpen(false)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("staffManagement.createDialog.firstName")}
            value={createForm.firstName}
            error={createErrors.firstName}
            onChange={(event) => setCreateForm((current) => ({ ...current, firstName: event.target.value }))}
          />
          <Input
            label={t("staffManagement.createDialog.lastName")}
            value={createForm.lastName}
            error={createErrors.lastName}
            onChange={(event) => setCreateForm((current) => ({ ...current, lastName: event.target.value }))}
          />
          <div className="sm:col-span-2">
            <Input
              label={t("staffManagement.createDialog.email")}
              type="email"
              value={createForm.email}
              error={createErrors.email}
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Select
              label={t("staffManagement.createDialog.role")}
              value={createForm.staffRole}
              onChange={(event) => setCreateForm((current) => ({ ...current, staffRole: event.target.value as AdminStaffRole }))}
            >
              {ADMIN_STAFF_ROLES.map((role) => (
                <option key={role} value={role}>{roleLabel(role)}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={() => setCreateOpen(false)} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">
            {t("staffManagement.createDialog.cancel")}
          </Button>
          <Button onClick={submitCreate}>{t("staffManagement.createDialog.confirm")}</Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(roleTarget)}
        title={t("staffManagement.roleDialog.title")}
        description={roleTarget ? t("staffManagement.roleDialog.description", { name: `${roleTarget.firstName} ${roleTarget.lastName}` }) : ""}
        onClose={() => setRoleTarget(null)}
      >
        <Select
          label={t("staffManagement.roleDialog.roleLabel")}
          value={roleDraft}
          onChange={(event) => setRoleDraft(event.target.value as AdminStaffRole)}
        >
          {ADMIN_STAFF_ROLES.map((role) => (
            <option key={role} value={role}>{roleLabel(role)}</option>
          ))}
        </Select>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={() => setRoleTarget(null)} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">
            {t("staffManagement.roleDialog.cancel")}
          </Button>
          <Button onClick={submitRoleChange}>{t("staffManagement.roleDialog.confirm")}</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.status === "active" ? t("staffManagement.statusDialog.disableTitle") : t("staffManagement.statusDialog.enableTitle")}
        description={
          statusTarget
            ? statusTarget.status === "active"
              ? t("staffManagement.statusDialog.disableDescription", { name: `${statusTarget.firstName} ${statusTarget.lastName}` })
              : t("staffManagement.statusDialog.enableDescription", { name: `${statusTarget.firstName} ${statusTarget.lastName}` })
            : ""
        }
        destructive={statusTarget?.status === "active"}
        confirmLabel={statusTarget?.status === "active" ? t("staffManagement.actions.disable") : t("staffManagement.actions.enable")}
        onConfirm={submitStatusToggle}
        onClose={() => setStatusTarget(null)}
      />
    </div>
  );
}

export function AdminStaffManagement() {
  return (
    <AdminGate permission="staff.view">
      <AdminStaffManagementContent />
    </AdminGate>
  );
}
