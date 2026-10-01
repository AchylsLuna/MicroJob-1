import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AlertCard, AlertLayer, ALERT_LAYER_Z } from "../components/ui";

type ToastType = "success" | "error" | "info";

export interface ToastOptions {
  description?: string;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
  type: ToastType;
  title: string;
}

type ToastListener = (toasts: ToastItem[]) => void;

const DEFAULT_DURATION = 3500;

let toastListeners: ToastListener[] = [];
let toastQueue: ToastItem[] = [];

const notifyListeners = () => {
  toastListeners.forEach((listener) => listener(toastQueue));
};

const removeToast = (id: string) => {
  toastQueue = toastQueue.filter((toast) => toast.id !== id);
  notifyListeners();
};

const addToast = (type: ToastType, title: string, options?: ToastOptions) => {
  const existing = toastQueue.find(
    (toast) =>
      toast.type === type &&
      toast.title === title &&
      (toast.description || "") === (options?.description || ""),
  );
  if (existing) {
    return existing.id;
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const toast: ToastItem = {
    id,
    type,
    title,
    description: options?.description,
    duration: options?.duration,
  };

  toastQueue = [...toastQueue, toast];
  notifyListeners();

  // Errors are a centred dialog now, not a notice that slides past: they stay
  // until the user acknowledges them. An explicit `duration` still wins, so a
  // caller can opt one error back into auto-dismiss.
  const duration = options?.duration ?? (type === "error" ? null : DEFAULT_DURATION);
  if (duration !== null) {
    window.setTimeout(() => removeToast(id), duration);
  }
  return id;
};

export const toast = Object.assign(
  (title: string, options?: ToastOptions) => addToast("info", title, options),
  {
    success: (title: string, options?: ToastOptions) => addToast("success", title, options),
    error: (title: string, options?: ToastOptions) => addToast("error", title, options),
    info: (title: string, options?: ToastOptions) => addToast("info", title, options),
  },
);

const toastStyles: Record<ToastType, string> = {
  success: "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]",
  // Unreachable from the corner stack -- errors render through `AlertCard`
  // instead. Kept so the record stays exhaustive over `ToastType`.
  error: "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]",
  info: "border-brand/20 bg-brand/[0.06] text-brand",
};

export function Toaster({ position = "top-right" }: { position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: ToastListener = (nextToasts) => setToasts([...nextToasts]);
    toastListeners.push(listener);
    listener(toastQueue);
    return () => {
      toastListeners = toastListeners.filter((item) => item !== listener);
    };
  }, []);

  // Each entry owns both axes at both sizes. Previously the container hardcoded
  // `left-4 right-4` and these added a conflicting `right-6`, so which gutter
  // applied was down to the generated stylesheet's order rather than intent.
  // The top positions also clear the header on mobile: at z-[9999] a toast sat
  // directly over the navbar and swallowed taps on the menu button.
  const positionClasses = {
    "top-right": "left-4 right-4 top-[calc(var(--navbar-height,4rem)+1rem)] sm:left-auto sm:right-6 sm:top-6",
    "top-left": "left-4 right-4 top-[calc(var(--navbar-height,4rem)+1rem)] sm:right-auto sm:left-6 sm:top-6",
    "bottom-right": "bottom-[calc(var(--mobile-bottom-nav-height,0px)+var(--cookie-banner-height,0px)+1.5rem)] left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6",
    "bottom-left": "bottom-[calc(var(--mobile-bottom-nav-height,0px)+var(--cookie-banner-height,0px)+1.5rem)] left-4 right-4 sm:right-auto sm:left-6 sm:bottom-6",
  }[position];

  // Errors leave the corner entirely. A 3.5s card in the top-right was the
  // weakest surface in the app for the message that matters most -- a user
  // looking at the form they just submitted never saw it. They are now a
  // centred dialog that waits to be acknowledged; success and info keep the
  // corner, so the centre of the screen only ever means something went wrong.
  const errorToasts = toasts.filter((item) => item.type === "error");
  const passiveToasts = toasts.filter((item) => item.type !== "error");

  // One backdrop for however many errors are outstanding: a scrim per error
  // would compound until the page was black. `addToast` already collapses
  // duplicates, so a retrying request contributes one card, not a stack.
  const errorLayer = (
    <AlertLayer
      open={errorToasts.length > 0}
      labelledBy={errorToasts.length ? `${errorToasts[0].id}-title` : undefined}
      describedBy={errorToasts.length && errorToasts[0].description ? `${errorToasts[0].id}-message` : undefined}
      z={ALERT_LAYER_Z.global}
      onDismiss={() => {
        const topmost = errorToasts[errorToasts.length - 1];
        if (topmost) removeToast(topmost.id);
      }}
    >
      {errorToasts.map((toastItem) => (
        <AlertCard
          key={toastItem.id}
          title={toastItem.title}
          titleId={`${toastItem.id}-title`}
          message={toastItem.description}
          messageId={`${toastItem.id}-message`}
          onDismiss={() => removeToast(toastItem.id)}
        />
      ))}
    </AlertLayer>
  );

  if (!passiveToasts.length) {
    return errorLayer;
  }

  return (
    <>
      {errorLayer}
      {/* `aria-live` stays on the corner region only. The error layer is an
          `alertdialog`, which screen readers announce on focus -- inside a live
          region it would be read twice. */}
      <div aria-live="polite" aria-relevant="additions" className={`pointer-events-none fixed z-[9999] flex flex-col gap-3 ${positionClasses}`}>
        {passiveToasts.map((toastItem) => (
          <div
            key={toastItem.id}
            role="status"
            className={`pointer-events-auto relative w-full border rounded-xl px-4 py-3 pr-10 shadow-[0_10px_30px_rgba(15,23,42,0.08)] sm:w-[320px] ${toastStyles[toastItem.type]}`}
          >
            <p className="text-body font-semibold">{toastItem.title}</p>
            {toastItem.description && (
              <p className="text-caption mt-1 text-[#475569]">{toastItem.description}</p>
            )}
            <button type="button" onClick={() => removeToast(toastItem.id)} aria-label="Dismiss notification" className="absolute right-2 top-2 rounded-md p-1 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
