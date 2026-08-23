// Pure calendar math shared by CalendarPanel — no React, no platform APIs, so it's
// trivially testable and reused identically by Mobile/lib/calendarModel.ts
// (kept as a separate file: Mobile/ and client/src are separate npm workspaces).

export type MonthModel = {
  year: number;
  month: number; // 0-11
  label: string; // e.g. "March 2026"
  weeks: (Date | null)[][]; // 6 rows x 7 cols, null = padding before/after the month
};

export type DayState = 'idle' | 'selected' | 'range-start' | 'range-end' | 'in-range' | 'disabled' | 'today';

export type DateRange = { start: Date | null; end: Date | null };

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // week starts Sunday

export function getWeekdayLabels(): string[] {
  return WEEKDAY_LABELS;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isBefore(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

export function isAfter(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() > startOfDay(b).getTime();
}

export function isDateDisabled(date: Date, bounds: { minDate?: Date; maxDate?: Date }): boolean {
  if (bounds.minDate && isBefore(date, bounds.minDate)) return true;
  if (bounds.maxDate && isAfter(date, bounds.maxDate)) return true;
  return false;
}

function monthLabel(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
}

/** Builds `count` consecutive months starting from `from`'s month, each as a fixed 6x7 grid. */
export function buildMonths(from: Date, count: number, locale = 'en-US'): MonthModel[] {
  const months: MonthModel[] = [];
  const startYear = from.getFullYear();
  const startMonth = from.getMonth();

  for (let i = 0; i < count; i += 1) {
    const monthIndex = startMonth + i;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12;

    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let pad = 0; pad < firstWeekday; pad += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 42) cells.push(null);

    const weeks: (Date | null)[][] = [];
    for (let w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7));

    months.push({ year, month, label: monthLabel(year, month, locale), weeks });
  }

  return months;
}

type SelectionValue = Date | null;

export function dayState(
  date: Date,
  selection: { mode: 'single'; value: SelectionValue } | { mode: 'range'; range: DateRange },
  bounds: { minDate?: Date; maxDate?: Date },
): DayState {
  if (isDateDisabled(date, bounds)) return 'disabled';

  if (selection.mode === 'single') {
    if (isSameDay(date, selection.value)) return 'selected';
  } else {
    const { start, end } = selection.range;
    if (isSameDay(date, start)) return start && end && isSameDay(start, end) ? 'selected' : 'range-start';
    if (isSameDay(date, end)) return 'range-end';
    if (start && end && isAfter(date, start) && isBefore(date, end)) return 'in-range';
  }

  if (isSameDay(date, new Date())) return 'today';
  return 'idle';
}

/** Range-selection interaction: first tap sets start; second tap sets end; a tap before start restarts. */
export function nextRangeSelection(current: DateRange, tapped: Date): DateRange {
  if (!current.start || (current.start && current.end)) {
    return { start: tapped, end: null };
  }
  if (isBefore(tapped, current.start)) {
    return { start: tapped, end: null };
  }
  return { start: current.start, end: tapped };
}
