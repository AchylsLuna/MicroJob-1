import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type RefObject,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { X } from "lucide-react";

const join = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={join(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  ({ className, label, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={join(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
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
            error ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-slate-300 focus:border-blue-600 focus:ring-blue-100",
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
        <select ref={ref} id={fieldId} aria-invalid={Boolean(error)} aria-describedby={descriptionId} className={join("min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100", className)} {...props}>{children}</select>
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
        <textarea ref={ref} id={fieldId} aria-invalid={Boolean(error)} aria-describedby={descriptionId} className={join("min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100", className)} {...props} />
        {error ? <span id={descriptionId} className="block text-xs font-medium text-red-700">{error}</span> : null}
        {!error && hint ? <span id={descriptionId} className="block text-xs font-normal text-slate-500">{hint}</span> : null}
      </label>
    );
  },
);
Textarea.displayName = "Textarea";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={join("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6", className)} {...props} />;
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={join("inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700", className)} {...props} />;
}

export function StatusState({ title, description, action, tone = "neutral" }: { title: string; description?: string; action?: ReactNode; tone?: "neutral" | "error" | "loading" }) {
  const colors = tone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={join("rounded-2xl border p-8 text-center", colors)} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      {tone === "loading" ? <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" aria-hidden="true" /> : null}
      <p className="font-semibold">{title}</p>
      {description ? <p className="mt-1 text-sm opacity-80">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Dialog({ open, title, description, children, onClose, initialFocusRef, closeDisabled = false }: { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void; initialFocusRef?: RefObject<HTMLElement | null>; closeDisabled?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (initialFocusRef?.current || closeRef.current)?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
      if (event.key !== "Tab") return;
      const dialog = closeRef.current?.closest('[role="dialog"]');
      const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus();
    };
  }, [closeDisabled, initialFocusRef, open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !closeDisabled && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <IconButton ref={closeRef} label="Close dialog" onClick={onClose} disabled={closeDisabled} className="absolute right-3 top-3"><X className="h-5 w-5" /></IconButton>
        <h2 id={titleId} className="pr-12 text-xl font-bold text-slate-900">{title}</h2>
        {description ? <p id={descriptionId} className="mt-2 text-sm text-slate-600">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive = false, pending = false, error, onConfirm, onClose }: { open: boolean; title: string; description: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; pending?: boolean; error?: string | null; onConfirm: () => unknown; onClose: () => void }) {
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose} closeDisabled={pending}>
      {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50" onClick={onClose} disabled={pending}>{cancelLabel}</Button>
        <Button className={destructive ? "bg-red-700 hover:bg-red-800" : undefined} onClick={() => void onConfirm()} disabled={pending} aria-busy={pending}>{pending ? "Working…" : confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
