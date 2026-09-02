import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

export type FilterOption = { value: string; label: string };

type CommonProps = { label: string; className?: string };

type RadioProps = CommonProps & { mode: "radio"; options: FilterOption[]; value: string; onApply: (value: string) => void };
type CheckboxProps = CommonProps & { mode: "checkbox"; options: FilterOption[]; value: string[]; onApply: (value: string[]) => void };
type ToggleProps = CommonProps & { mode: "toggle"; value: boolean; onApply: (value: boolean) => void };

type Props = RadioProps | CheckboxProps | ToggleProps;

const pillClass = (isActive: boolean, className?: string) =>
  `inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
    isActive ? "border-[#1C4D8D] bg-[#EAF2FC] text-[#1C4D8D]" : "border-slate-300 text-slate-700 hover:border-slate-400"
  } ${className || ""}`;

/**
 * A single filter chip, matching the LinkedIn job-search filter bar: a plain
 * toggle pill for a boolean filter, or a pill that opens a popover with
 * Reset / Show results for a radio (single-select) or checkbox (multi-select)
 * filter. The popover holds its own draft state — nothing the user clicks
 * inside it takes effect until "Show results", exactly like the reference.
 */
export function FilterPill(props: Props) {
  if (props.mode === "toggle") {
    const { label, value, onApply, className } = props;
    return (
      <button
        type="button"
        onClick={() => onApply(!value)}
        aria-pressed={value}
        className={pillClass(value, className)}
      >
        {label}
      </button>
    );
  }

  return <PopoverFilterPill {...props} />;
}

function PopoverFilterPill(props: RadioProps | CheckboxProps) {
  const { t } = useTranslation("worker");
  const { label, options, value, onApply, className } = props;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | string[]>(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isActive = props.mode === "radio" ? Boolean(value) : value.length > 0;
  const draftIsEmpty = props.mode === "radio" ? !draft : (draft as string[]).length === 0;

  // Re-seed the draft from the last applied value every time the popover
  // opens, so a close-without-applying (Escape, outside click) never leaks a
  // half-picked selection into the next time it's opened.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const toggleDraftOption = (optionValue: string) => {
    if (props.mode === "radio") {
      setDraft((current) => (current === optionValue ? "" : optionValue));
    } else {
      setDraft((current) => {
        const list = Array.isArray(current) ? current : [];
        return list.includes(optionValue) ? list.filter((item) => item !== optionValue) : [...list, optionValue];
      });
    }
  };

  const handleReset = () => setDraft(props.mode === "radio" ? "" : []);

  const handleShowResults = () => {
    onApply(draft as never);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={pillClass(isActive, className)}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="fixed left-4 right-4 top-[auto] z-50 mt-2 w-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.16)] sm:absolute sm:left-0 sm:right-auto sm:top-full sm:w-72"
        >
          <div className="max-h-72 overflow-y-auto p-2">
            {options.map((option) => {
              const checked = props.mode === "radio" ? draft === option.value : (draft as string[]).includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleDraftOption(option.value)}
                  role={props.mode === "radio" ? "menuitemradio" : "menuitemcheckbox"}
                  aria-checked={checked}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] text-slate-700 transition hover:bg-slate-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                      props.mode === "radio" ? "rounded-full" : "rounded"
                    } ${checked ? "border-[#1C4D8D] bg-[#1C4D8D]" : "border-slate-300"}`}
                    aria-hidden="true"
                  >
                    {checked ? (
                      <span className={props.mode === "radio" ? "h-1.5 w-1.5 rounded-full bg-white" : "h-2 w-2 rounded-[2px] bg-white"} />
                    ) : null}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2.5">
            <button
              type="button"
              onClick={handleReset}
              disabled={draftIsEmpty}
              className="min-h-9 rounded-lg px-3 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
            >
              {t("findJobs.filters.reset")}
            </button>
            <button
              type="button"
              onClick={handleShowResults}
              className="min-h-9 rounded-full bg-[#1C4D8D] px-4 text-[13px] font-bold text-white transition hover:bg-[#163F75]"
            >
              {t("findJobs.filters.showResults")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
