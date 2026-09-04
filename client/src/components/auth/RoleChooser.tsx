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
            className="group flex flex-col items-center rounded-[16px] border border-slate-200 bg-white p-6 text-center transition-colors hover:border-[#1C4D8D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="flex h-20 w-20 items-center justify-center rounded-[16px] bg-blue-100 text-[#1C4D8D]"
            >
              <Icon className="h-11 w-11" />
            </span>
            <span className="mt-5 text-[17px] font-bold text-slate-950">{title}</span>
            <span className="mt-1 text-[14px] leading-6 text-slate-600">{description}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => onSelect("both")}
          className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-[14px] font-semibold text-[#1C4D8D] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
        >
          {t("signUp.roleChooser.both")}
        </button>
      </div>
    </div>
  );
}
