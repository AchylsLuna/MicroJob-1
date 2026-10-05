import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ComponentPropsWithRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type RefObject,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Pressable, type PressableBaseProps } from "./Pressable";
import { ALERT_LAYER_Z, LAYER_Z } from "./layers";

const join = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

export const Button = forwardRef<HTMLButtonElement, PressableBaseProps>(
  ({ className, type = "button", ...props }, ref) => (
    // Hover is expressed through opacity, not a darker blue: tailwind.config.js
    // flattens brand-500 through brand-950 to the same value, so the previous
    // `hover:bg-brand-800` on a `bg-brand-700` base rendered no change at all.
    <Pressable
      ref={ref}
      type={type}
      className={join(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export const IconButton = forwardRef<HTMLButtonElement, PressableBaseProps & { label: string }>(
  ({ className, label, type = "button", ...props }, ref) => (
    <Pressable
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={join(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";

type FieldProps = { label: string; error?: string; hint?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const fieldId = id || `field-${String(props.name || label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const descriptionId = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
    return (
      <label htmlFor={fieldId} className="block space-y-1.5 text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          className={join(
            "min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:ring-2",
            error ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-slate-300 focus:border-brand-600 focus:ring-brand-100",
            className,
          )}
          {...props}
        />
        {error ? <span id={descriptionId} className="block text-xs font-medium text-red-700">{error}</span> : null}
        {!error && hint ? <span id={descriptionId} className="block text-xs font-normal text-slate-500">{hint}</span> : null}
      </label>
    );
  },
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(
  ({ className, label, error, hint, id, children, ...props }, ref) => {
    const fieldId = id || `field-${String(props.name || label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const descriptionId = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
    return (
      <label htmlFor={fieldId} className="block space-y-1.5 text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <select ref={ref} id={fieldId} aria-invalid={Boolean(error)} aria-describedby={descriptionId} className={join("min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100", className)} {...props}>{children}</select>
        {error ? <span id={descriptionId} className="block text-xs font-medium text-red-700">{error}</span> : null}
        {!error && hint ? <span id={descriptionId} className="block text-xs font-normal text-slate-500">{hint}</span> : null}
      </label>
    );
  },
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const fieldId = id || `field-${String(props.name || label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const descriptionId = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
    return (
      <label htmlFor={fieldId} className="block space-y-1.5 text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <textarea ref={ref} id={fieldId} aria-invalid={Boolean(error)} aria-describedby={descriptionId} className={join("min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100", className)} {...props} />
        {error ? <span id={descriptionId} className="block text-xs font-medium text-red-700">{error}</span> : null}
        {!error && hint ? <span id={descriptionId} className="block text-xs font-normal text-slate-500">{hint}</span> : null}
      </label>
    );
  },
);
Textarea.displayName = "Textarea";

export function Card({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={join("rounded-card border border-slate-200 bg-white p-5 shadow-sm sm:p-6", className)} {...props} />;
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={join("inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700", className)} {...props} />;
}

/**
 * One labelled number in a stat row. Props mirror `Mobile/components/ui/StatTile.tsx`
 * deliberately, so the same stat reads the same way on both platforms.
 *
 * Replaces three byte-identical hand-rolled copies that had drifted into
 * worker/Profile.tsx, employer/Profile.tsx, and shared/PublicProfile.tsx.
 */
export function StatTile({
  label,
  value,
  icon,
  caption,
  className,
}: {
  label: string;
  value: string | number;
  /** Small leading glyph beside the value — pass a sized lucide icon. */
  icon?: ReactNode;
  /** Secondary line under the value, e.g. a review count. */
  caption?: string;
  className?: string;
}) {
  return (
    <div className={join("rounded-card border border-slate-200 bg-white px-4 py-3", className)}>
      <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {icon}
        <p className="truncate text-xl font-bold text-[#0F2954]">{value}</p>
      </div>
      {caption ? <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">{caption}</p> : null}
    </div>
  );
}

export function StatusState({ title, description, action, tone = "neutral" }: { title: string; description?: string; action?: ReactNode; tone?: "neutral" | "error" | "loading" }) {
  const colors = tone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={join("rounded-card border p-8 text-center", colors)} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      {tone === "loading" ? <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" aria-hidden="true" /> : null}
      <p className="font-semibold">{title}</p>
      {description ? <p className="mt-1 text-sm opacity-80">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Width steps. `md` is the default and is exactly what every existing call
 * site already rendered, so adding this prop changed none of them. The wider
 * steps exist so the hand-rolled modals being migrated onto this component can
 * keep their own widths instead of being squeezed into `max-w-lg`.
 */
const DIALOG_WIDTHS = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  full: "max-w-5xl",
} as const;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus capture, focus restore, Escape-to-close and a tab trap for one modal
 * surface. Shared by `Dialog` and `AlertLayer` so the two cannot drift: this
 * logic used to live inline in `Dialog`, and every hand-rolled modal in the app
 * reimplemented whichever parts its author remembered.
 *
 * `containerRef` must point at the element that holds the focusable content --
 * the trap enumerates its descendants, so a ref on the backdrop would let Tab
 * escape through anything else the backdrop renders.
 */
function useDialogBehavior({
  open,
  containerRef,
  initialFocusRef,
  restoreFocusRef,
  closeDisabled = false,
  onClose,
}: {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  closeDisabled?: boolean;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreTarget = restoreFocusRef?.current || previouslyFocused;
    const focusables = () =>
      Array.from(containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || []);
    (initialFocusRef?.current || focusables()[0])?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (closeDisabled) return;
        event.preventDefault();
        // Stopped here rather than allowed to bubble: a surface underneath this
        // one may have its own Escape handler, and closing both at once -- the
        // alert *and* the modal that raised it -- would discard work the user
        // has not been told about.
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusables();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      restoreTarget?.focus();
    };
  }, [closeDisabled, containerRef, initialFocusRef, open, restoreFocusRef]);
}

export function Dialog({ open, title, description, children, onClose, initialFocusRef, restoreFocusRef, closeDisabled = false, size = "md" }: { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void; initialFocusRef?: RefObject<HTMLElement | null>; restoreFocusRef?: RefObject<HTMLElement | null>; closeDisabled?: boolean; size?: keyof typeof DIALOG_WIDTHS }) {
  const { t } = useTranslation("common");
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useDialogBehavior({ open, containerRef: panelRef, initialFocusRef, restoreFocusRef, closeDisabled, onClose });
  if (!open) return null;
  // Portalled to <body>. `position: fixed` is only viewport-relative while no
  // ancestor establishes a containing block for it, and a `transform`,
  // `filter`, `contain` or `will-change` anywhere up the tree silently does --
  // `.page-transition` wrapped every dashboard route and confined this backdrop
  // to the <main> box. Rendering outside the app tree makes that structurally
  // impossible rather than something the next ancestor can break again.
  return createPortal(
    <div className={join("fixed inset-0 flex items-center justify-center bg-slate-950/55 p-4", LAYER_Z.modal)} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !closeDisabled && onClose()}>
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className={join("relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-card bg-white p-6 shadow-2xl", DIALOG_WIDTHS[size])}>
        <IconButton label={t("dialog.closeLabel")} onClick={onClose} disabled={closeDisabled} className="absolute right-3 top-3"><X className="h-5 w-5" /></IconButton>
        <h2 id={titleId} className="pr-12 text-xl font-bold text-slate-900">{title}</h2>
        {description ? <p id={descriptionId} className="mt-2 text-sm text-slate-600">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel, destructive = false, pending = false, error, onConfirm, onClose }: { open: boolean; title: string; description: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; pending?: boolean; error?: string | null; onConfirm: () => unknown; onClose: () => void }) {
  const { t } = useTranslation("common");
  const resolvedConfirmLabel = confirmLabel ?? t("confirmDialog.confirmLabel");
  const resolvedCancelLabel = cancelLabel ?? t("confirmDialog.cancelLabel");
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose} closeDisabled={pending}>
      {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50" onClick={onClose} disabled={pending}>{resolvedCancelLabel}</Button>
        <Button className={destructive ? "!bg-red-700 hover:!bg-red-800" : undefined} onClick={() => void onConfirm()} disabled={pending} aria-busy={pending}>{pending ? t("confirmDialog.pending") : resolvedConfirmLabel}</Button>
      </div>
    </Dialog>
  );
}

/**
 * Backdrop and modal behaviour for an alert, with no opinion on its contents.
 *
 * Split from `AlertCard` because one backdrop has to be able to hold several
 * stacked alerts: the global error layer shows every unacknowledged error at
 * once, and a scrim per error would compound the dimming until the page went
 * black. Callers that show exactly one alert pass a single `AlertCard`.
 *
 * An `alertdialog` must have an accessible name, so pass `labelledBy` (the id
 * of a heading inside) or `label`.
 */
export function AlertLayer({ open, label, labelledBy, describedBy, z = ALERT_LAYER_Z.overModal, onDismiss, children }: { open: boolean; label?: string; labelledBy?: string; describedBy?: string; z?: string; onDismiss: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({ open, containerRef: panelRef, onClose: onDismiss });
  if (!open) return null;
  // Portalled for the reason spelled out on `Dialog` above: an ancestor with a
  // transform silently turns `position: fixed` into something else.
  return createPortal(
    <div
      className={join("fixed inset-0 flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/55 p-4 sm:items-center", z)}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onDismiss()}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className="my-auto flex w-full max-w-md flex-col gap-3"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The alert itself. Deliberately not wrapped in its own backdrop -- see
 * `AlertLayer`. `actions` replaces the default single dismiss button for alerts
 * that offer a way forward as well as a way out.
 */
export function AlertCard({ title, titleId, message, messageId, dismissLabel, actions, onDismiss }: { title: string; titleId?: string; message?: string | null; messageId?: string; dismissLabel?: string; actions?: ReactNode; onDismiss?: () => void }) {
  const { t } = useTranslation("common");
  return (
    <div className="w-full rounded-3xl border border-red-100 bg-white p-6 text-center shadow-2xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-600" aria-hidden="true">
        !
      </div>
      <h2 id={titleId} className="mt-4 text-xl font-bold text-slate-900">{title}</h2>
      {message ? <p id={messageId} className="mt-2 text-sm leading-6 text-slate-600">{message}</p> : null}
      <div className="mt-6">
        {actions ?? (
          <Button className="w-full" onClick={onDismiss}>{dismissLabel ?? t("alert.dismiss")}</Button>
        )}
      </div>
    </div>
  );
}
