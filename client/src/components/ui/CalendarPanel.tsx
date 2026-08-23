import { useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import {
  buildMonths,
  dayState,
  getWeekdayLabels,
  nextRangeSelection,
  type DateRange,
  type MonthModel,
} from "../../lib/calendarModel";
import { getActiveDateLocale } from "../../lib/formatters";
import { useLanguage } from "../../hooks/useLanguage";

type FooterConfig = {
  clearLabel?: string;
  onClear?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
};

type SingleProps = {
  mode?: "single";
  value?: Date | null;
  range?: undefined;
  onChange: (next: Date | null) => void;
};

type RangeProps = {
  mode: "range";
  value?: undefined;
  range?: DateRange;
  onChange: (next: DateRange) => void;
};

type Props = (SingleProps | RangeProps) & {
  open: boolean;
  onClose: () => void;
  minDate?: Date;
  maxDate?: Date;
  monthsToRender?: number;
  title?: string;
  footer?: FooterConfig;
};

const WEEKDAYS = getWeekdayLabels();

function formatFullDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
}

export function CalendarPanel(props: Props) {
  const { open, onClose, minDate, maxDate, monthsToRender = 12, title, footer } = props;
  const prefersReducedMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useLanguage(); // subscribes this component to language changes so dateLocale below stays current
  const dateLocale = getActiveDateLocale();

  const months = useMemo(() => buildMonths(minDate || new Date(), monthsToRender, dateLocale), [minDate, monthsToRender, dateLocale]);

  // Focus trap + restore, same pattern as components/ui/index.tsx's Dialog.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const panel = closeRef.current?.closest('[role="dialog"]');
      const focusable = Array.from(
        panel?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])') || [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const handleDayPress = (date: Date) => {
    if (props.mode === "range") {
      props.onChange(nextRangeSelection(props.range || { start: null, end: null }, date));
    } else {
      props.onChange(date);
    }
  };

  const renderMonth = (item: MonthModel) => (
    <div key={`${item.year}-${item.month}`} className="pt-5 first:pt-0">
      <p className="mb-2 text-[15px] font-extrabold text-[#0F2954]">{item.label}</p>
      <div className="flex flex-col gap-0.5">
        {item.weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex">
            {week.map((date, dayIndex) => {
              if (!date) return <div key={dayIndex} className="flex h-11 flex-1 items-center justify-center" />;

              const state =
                props.mode === "range"
                  ? dayState(date, { mode: "range", range: props.range || { start: null, end: null } }, { minDate, maxDate })
                  : dayState(date, { mode: "single", value: props.value ?? null }, { minDate, maxDate });

              const disabled = state === "disabled";
              const selected = state === "selected" || state === "range-start" || state === "range-end";
              const inRange = state === "in-range";
              const isToday = state === "today";

              return (
                <div key={dayIndex} className="relative flex h-11 flex-1 items-center justify-center">
                  {inRange ? (
                    <div
                      className={`absolute inset-y-1 left-0 right-0 bg-[#EAF1FB] ${dayIndex === 0 ? "left-[15%] rounded-l-full" : ""} ${dayIndex === 6 ? "right-[15%] rounded-r-full" : ""}`}
                    />
                  ) : null}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDayPress(date)}
                    aria-label={formatFullDate(date, dateLocale)}
                    aria-pressed={selected}
                    aria-disabled={disabled}
                    className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                      selected
                        ? "bg-[#1C4D8D] text-white"
                        : disabled
                        ? "text-slate-300 line-through"
                        : isToday
                        ? "border border-[#DCE6F7] text-slate-900 hover:bg-slate-50"
                        : "text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {date.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 sm:items-center"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-3xl"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 id={titleId} className="text-lg font-extrabold text-[#0F2954]">
                {title || "Select a date"}
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex border-b border-slate-100 px-6 py-2">
              {WEEKDAYS.map((label, index) => (
                <span key={`${label}-${index}`} className="flex-1 text-center text-xs font-bold text-slate-400">
                  {label}
                </span>
              ))}
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-6 pb-2 sm:max-h-[50vh]">{months.map(renderMonth)}</div>

            {footer ? (
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                {footer.onClear ? (
                  <button type="button" onClick={footer.onClear} className="mr-auto min-h-11 px-2 text-sm font-bold text-slate-500 hover:text-slate-700">
                    {footer.clearLabel || "Clear"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={footer.onPrimary}
                  disabled={footer.primaryDisabled}
                  className="min-h-11 rounded-full bg-[#1C4D8D] px-6 text-sm font-bold text-white transition hover:bg-[#163F75] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {footer.primaryLabel}
                </button>
              </div>
            ) : null}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
