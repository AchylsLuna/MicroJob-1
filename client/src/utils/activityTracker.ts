export const ACTIVITY_EVENT = "app-activity";

export function markActivity(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(ACTIVITY_EVENT));
}
