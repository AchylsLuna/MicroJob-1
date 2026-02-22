export const toast = {
  success: (message: string, opts?: any) => {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type: 'success', ...opts } }));
  },
  error: (message: string, opts?: any) => {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type: 'error', ...opts } }));
  },
  info: (message: string, opts?: any) => {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type: 'info', ...opts } }));
  },
};
