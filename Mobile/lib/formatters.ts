import i18n from '../i18n';
import type { Language } from '../contexts/LanguageContext';

// PHP currency formatting (symbol, grouping) is invariant across the app's
// supported languages, so formatCurrency always resolves against en-PH. Date
// formatting genuinely differs by language (month/weekday names), so it maps
// the active UI language to a real locale tag instead.
const DATE_LOCALE_BY_LANGUAGE: Record<Language, string> = {
  en: 'en-PH',
  fil: 'fil-PH',
};

function activeDateLocale(): string {
  const lang = (i18n.language?.split('-')[0] as Language) || 'en';
  return DATE_LOCALE_BY_LANGUAGE[lang] ?? DATE_LOCALE_BY_LANGUAGE.en;
}

function toAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatCurrency(value: unknown, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', ...options }).format(toAmount(value));
}

export function formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(activeDateLocale(), options ?? { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

export function formatDateTime(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(
    activeDateLocale(),
    options ?? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  ).format(d);
}

/** Used by Mobile/lib/calendarModel.ts to label a calendar month header. */
export function formatMonthLabel(date: Date, locale = activeDateLocale()): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

export { activeDateLocale as getActiveDateLocale };
