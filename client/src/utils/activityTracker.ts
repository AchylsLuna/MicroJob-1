export const ACTIVITY_EVENT = "app_user_activity";

export const markActivity = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ACTIVITY_EVENT));
};
