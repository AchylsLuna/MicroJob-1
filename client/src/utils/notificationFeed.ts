import { ROUTES } from "./routes";

export type NotificationFeedType = "application" | "message" | "payment" | "update";

export type FeedNotification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  link: string;
  type: NotificationFeedType;
  rawType: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt?: string;
};

type NotificationRecord = {
  _id?: string;
  id?: string;
  type?: string;
  title?: string;
  message?: string;
  link?: string;
  entityType?: string | null;
  entityId?: string | null;
  readAt?: string | null;
  createdAt?: string;
};

type NotificationAudience = "admin" | "employer" | "worker";

export const formatNotificationTime = (
  value?: string,
  mode: "relative" | "full" = "relative",
) => {
  if (!value) return mode === "full" ? "-" : "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return mode === "full" ? "-" : "just now";

  if (mode === "full") {
    return date.toLocaleString();
  }

  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString();
};

export const getNotificationDisplayType = (value?: string): NotificationFeedType => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "application" || normalized === "interview") return "application";
  if (normalized === "message") return "message";
  if (normalized === "payment" || normalized === "payout") return "payment";
  return "update";
};

export const resolveNotificationLink = (item: NotificationRecord, audience: NotificationAudience) => {
  if (item.link && String(item.link).trim()) {
    return String(item.link).trim();
  }

  const isAdminView = audience === "admin";
  const isEmployerView = audience === "employer";

  switch (String(item.type || "").toLowerCase()) {
    case "message":
      if (isAdminView) return ROUTES.admin.messages;
      return isEmployerView ? ROUTES.employer.messages : ROUTES.worker.messages;
    case "payment":
    case "payout":
      if (isAdminView) return ROUTES.admin.eWallet;
      return isEmployerView ? ROUTES.employer.eWallet : ROUTES.worker.eWallet;
    case "support":
      if (isAdminView) return ROUTES.admin.support;
      return isEmployerView ? ROUTES.employer.support : ROUTES.worker.support;
    case "account":
      if (isAdminView) return ROUTES.admin.security;
      return isEmployerView ? ROUTES.employer.settings : ROUTES.settings;
    case "application":
    case "interview":
      if (isAdminView) return ROUTES.admin.dashboard;
      return isEmployerView ? ROUTES.employer.applications : ROUTES.worker.appliedJobs;
    default:
      if (isAdminView) return ROUTES.admin.dashboard;
      return isEmployerView ? ROUTES.employer.notifications : ROUTES.worker.notifications;
  }
};

export const mapNotificationRecord = (
  item: NotificationRecord,
  audience: NotificationAudience,
  mode: "relative" | "full" = "relative",
): FeedNotification => ({
  id: String(item._id || item.id || `${item.type || "notification"}-${item.createdAt || Date.now()}`),
  title: String(item.title || "Notification"),
  message: String(item.message || ""),
  time: formatNotificationTime(item.createdAt, mode),
  read: Boolean(item.readAt),
  link: resolveNotificationLink(item, audience),
  type: getNotificationDisplayType(item.type),
  rawType: String(item.type || "system"),
  entityType: item.entityType || null,
  entityId: item.entityId || null,
  createdAt: item.createdAt,
});
