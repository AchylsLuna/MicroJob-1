import { useEffect, useState } from "react";

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

  const duration = options?.duration ?? 3500;
  window.setTimeout(() => removeToast(id), duration);
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
  error: "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]",
  info: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
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

  const positionClasses = {
    "top-right": "top-6 right-6",
    "top-left": "top-6 left-6",
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
  }[position];

  if (!toasts.length) {
    return null;
  }

  return (
    <div className={`fixed z-50 flex flex-col gap-3 ${positionClasses}`}>
      {toasts.map((toastItem) => (
        <div
          key={toastItem.id}
          className={`w-[320px] border rounded-[12px] px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ${toastStyles[toastItem.type]}`}
        >
          <p className="text-[14px] font-semibold">{toastItem.title}</p>
          {toastItem.description && (
            <p className="text-[12px] mt-1 text-[#475569]">{toastItem.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
