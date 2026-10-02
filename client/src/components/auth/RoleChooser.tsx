import { useTranslation } from "react-i18next";
import { EmployerIcon, WorkerIcon } from "./RoleIcons";

export type SignUpRole = "employer" | "worker" | "both";

/**
 * First step of sign-up: pick what you are here to do. The value feeds the
 * existing `userType` state, which AuthContext.register() already remaps to the
 * wire values hire/work/both — so nothing downstream changes.
 *
 * The icon tiles are flat fills. The reference design uses gradients; the
 * project's design rules forbid them.
 */
export function RoleChooser({ onSelect }: { onSelect: (role: SignUpRole) => void }) {
  const { t } = useTranslation("auth");

  const options = [
    {
      role: "employer" as const,
      Icon: EmployerIcon,
      title: t("signUp.roleChooser.employer.title"),
      description: t("signUp.roleChooser.employer.description"),
    },
    {
      role: "worker" as const,
      Icon: WorkerIcon,
      title: t("signUp.roleChooser.worker.title"),
      description: t("signUp.roleChooser.worker.description"),
    },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map(({ role, Icon, title, description }) => (
          <button
            key={role}
            type="button"
            onClick={() => onSelect(role)}
            className="group flex flex-col items-center rounded-card border border-slate-200 bg-white p-6 text-center transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="flex h-20 w-20 items-center justify-center rounded-card bg-brand-100 text-brand"
            >
              <Icon className="h-11 w-11" />
            </span>
            <span className="mt-5 text-[17px] font-bold text-slate-950">{title}</span>
            <span className="mt-1 text-body leading-6 text-slate-600">{description}</span>
          </button>
        ))}
      </div>

      {/* A third choice, so it has to look like one. As bare brand-coloured
          text under two bordered cards it read as a footnote or a link rather
          than the option it is -- the only selectable thing on the step with
          no visible edge. It takes the cards' border, hover and focus
          treatment; it stays a full-width bar rather than a third card
          because it applies to both of the roles above it. */}
      <button
        type="button"
        onClick={() => onSelect("both")}
        className="mt-4 flex min-h-11 w-full items-center justify-center rounded-card border border-slate-200 bg-white px-4 py-3 text-body font-semibold text-brand transition-colors hover:border-brand hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {t("signUp.roleChooser.both")}
      </button>
    </div>
  );
}
