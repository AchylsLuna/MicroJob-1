import { useState } from "react";
import { Calendar } from "lucide-react";
import { CalendarPanel } from "./CalendarPanel";
import type { DateRange } from "../../lib/calendarModel";

type SingleProps = {
  mode?: "single";
  value: Date | null;
  onChange: (next: Date | null) => void;
};

type RangeProps = {
  mode: "range";
  value: DateRange;
  onChange: (next: DateRange) => void;
};

type Props = (SingleProps | RangeProps) & {
  label?: string;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  placeholder?: string;
  className?: string;
  /** Overrides the visible trigger button's classes entirely (does not merge). */
  buttonClassName?: string;
  /** Forwarded to the hidden native <input type="date"> (single mode only) — e.g. "deadline" for validation-scroll targeting. */
  dataField?: string;
  id?: string;
};

function toInputValue(date: Date | null): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplay(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function DateField(props: Props) {
  const { label, minDate, maxDate, required, placeholder = "Select a date", className, buttonClassName, dataField, id } = props;
  const [open, setOpen] = useState(false);

  const isRange = props.mode === "range";
  const displayLabel = isRange
    ? props.value.start && props.value.end
      ? `${formatDisplay(props.value.start)} – ${formatDisplay(props.value.end)}`
      : props.value.start
      ? `${formatDisplay(props.value.start)} – ?`
      : placeholder
    : props.value
    ? formatDisplay(props.value)
    : placeholder;

  return (
    <div className={className}>
      {label ? <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label> : null}
      <button
        type="button"
        id={id}
        onClick={() => setOpen(true)}
        className={
          buttonClassName ||
          "flex h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        }
      >
        <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
        <span className={displayLabel === placeholder ? "text-slate-400" : "font-medium"}>{displayLabel}</span>
      </button>

      {/* Visually hidden but real <input type="date"> so browser `required` validation, autofill,
          and assistive-tech date entry keep working even though the visible UI is CalendarPanel. */}
      {!isRange ? (
        <input
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          required={required}
          data-field={dataField}
          value={toInputValue(props.value)}
          min={minDate ? toInputValue(minDate) : undefined}
          max={maxDate ? toInputValue(maxDate) : undefined}
          onChange={(event) => {
            const raw = event.target.value;
            if (!raw) {
              props.onChange(null);
              return;
            }
            const [year, month, day] = raw.split("-").map(Number);
            props.onChange(new Date(year, month - 1, day));
          }}
        />
      ) : null}

      {props.mode === "range" ? (
        <CalendarPanel
          mode="range"
          open={open}
          onClose={() => setOpen(false)}
          minDate={minDate}
          maxDate={maxDate}
          range={props.value}
          onChange={props.onChange}
          title={label || "Select dates"}
          footer={{
            clearLabel: "Clear all",
            onClear: () => props.onChange({ start: null, end: null }),
            primaryLabel: "Apply",
            onPrimary: () => setOpen(false),
          }}
        />
      ) : (
        <CalendarPanel
          mode="single"
          open={open}
          onClose={() => setOpen(false)}
          minDate={minDate}
          maxDate={maxDate}
          value={props.value}
          onChange={(next) => {
            props.onChange(next);
          }}
          title={label || "Select a date"}
          footer={{
            clearLabel: required ? undefined : "Clear",
            onClear: required ? undefined : () => props.onChange(null),
            primaryLabel: "Done",
            onPrimary: () => setOpen(false),
            primaryDisabled: required && !props.value,
          }}
        />
      )}
    </div>
  );
}
