import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  Filter,
  Briefcase,
  DollarSign,
  AlertCircle,
  MessageSquare,
  Star,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Settings,
  Mail,
  Smartphone,
  BellRing,
  CheckCircle2,
} from "lucide-react";
import { toast } from "../../lib/toast";
import { useNavigate } from "react-router-dom";
import {
  deleteNotification as deleteNotificationApi,
  deleteReadNotifications,
  getNotifications,
  getAlerts,
  updateAlertStatus,
  deleteAlert,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/api";

interface Notification {
  id: string;
  type: "application" | "payment" | "message" | "alert" | "achievement";
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionable?: boolean;
  link?: string;
}

interface AlertItem {
  id: string;
  severity: "critical" | "warning" | "info";
  category: "security" | "payments" | "jobs" | "system";
  title: string;
  description: string;
  time: string;
  status: "open" | "snoozed" | "resolved";
  actionLabel?: string;
}

interface NotificationRule {
  id: string;
  title: string;
  description: string;
  channels: string;
  enabled: boolean;
}

const formatTimeLabel = (value?: string) => {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString();
};

const notificationRulesData: NotificationRule[] = [
  {
    id: "r1",
    title: "High-priority applicants",
    description: "Notify when applicant rating is 4.8 or higher.",
    channels: "In-app • Email",
    enabled: true,
  },
  {
    id: "r2",
    title: "Low budget alerts",
    description: "Alert when project balance drops below ₱5,000.",
    channels: "In-app • SMS",
    enabled: false,
  },
  {
    id: "r3",
    title: "New message from client",
    description: "Immediate notification for direct messages.",
    channels: "In-app • Push",
    enabled: true,
  },
  {
    id: "r4",
    title: "Payout completed",
    description: "Notify when payouts are completed or failed.",
    channels: "Email • In-app",
    enabled: true,
  },
];

export function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "application" | "payment" | "message" | "alert" | "achievement">("all");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<"all" | "open" | "critical" | "snoozed" | "resolved">("all");
  const [deliveryPreferences, setDeliveryPreferences] = useState({
    inApp: true,
    email: true,
    sms: false,
    push: true,
  });
  const [digestSchedule, setDigestSchedule] = useState<"instant" | "daily" | "weekly">("daily");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [rules, setRules] = useState<NotificationRule[]>(notificationRulesData);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    let isMounted = true;
    const loadNotifications = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getNotifications();
        if (!isMounted) return;
        const mapped = (Array.isArray(data) ? data : []).map((item: any) => ({
          id: item._id || item.id,
          type: item.type || "alert",
          title: item.title || "Notification",
          message: item.message || "",
          time: formatTimeLabel(item.createdAt),
          read: Boolean(item.readAt),
          actionable: Boolean(item.link),
          link: item.link || undefined,
        })) as Notification[];
        setNotifications(mapped);
      } catch (error: any) {
        if (!isMounted) return;
        const message = error?.message || "Failed to load notifications.";
        setLoadError(message);
        toast.error(message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadAlerts = async () => {
      setAlertsLoading(true);
      setAlertsError(null);
      try {
        const data = await getAlerts();
        if (!isMounted) return;
        const mapped = (Array.isArray(data) ? data : []).map((item: any) => ({
          id: item._id || item.id,
          severity: item.severity || "info",
          category: item.category || "system",
          title: item.title || "Alert",
          description: item.description || "",
          time: formatTimeLabel(item.createdAt),
          status: item.status || "open",
          actionLabel: item.actionLabel || undefined,
        })) as AlertItem[];
        setAlerts(mapped);
      } catch (error: any) {
        if (!isMounted) return;
        const message = error?.message || "Failed to load alerts.";
        setAlertsError(message);
        toast.error(message);
      } finally {
        if (isMounted) setAlertsLoading(false);
      }
    };
    loadAlerts();
    return () => {
      isMounted = false;
    };
  }, []);

  const markAsRead = async (id: string, options?: { silent?: boolean }) => {
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
    try {
      await markNotificationRead(id);
      if (!options?.silent) {
        toast.success("Marked as read");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark notification.");
    }
  };

  const markAllAsRead = async () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
      toast.success("All notifications marked as read");
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark all as read.");
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
    try {
      await deleteNotificationApi(id);
      toast.success("Notification deleted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete notification.");
    }
  };

  const deleteAllRead = async () => {
    setNotifications(notifications.filter(n => !n.read));
    try {
      await deleteReadNotifications();
      toast.success("All read notifications deleted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete read notifications.");
    }
  };

  const resolveAlert = async (id: string) => {
    setAlerts(alerts.map(alert => (alert.id === id ? { ...alert, status: "resolved" } : alert)));
    try {
      await updateAlertStatus(id, "resolved");
      toast.success("Alert resolved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to resolve alert.");
    }
  };

  const snoozeAlert = async (id: string) => {
    setAlerts(alerts.map(alert => (alert.id === id ? { ...alert, status: "snoozed" } : alert)));
    try {
      await updateAlertStatus(id, "snoozed");
      toast.info("Alert snoozed for 24 hours");
    } catch (error: any) {
      toast.error(error?.message || "Failed to snooze alert.");
    }
  };

  const dismissAlert = async (id: string) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
    try {
      await deleteAlert(id);
      toast.success("Alert dismissed");
    } catch (error: any) {
      toast.error(error?.message || "Failed to dismiss alert.");
    }
  };

  const togglePreference = (key: keyof typeof deliveryPreferences) => {
    setDeliveryPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDigestChange = (value: "instant" | "daily" | "weekly") => {
    setDigestSchedule(value);
  };

  const toggleRule = (id: string) => {
    setRules(rules.map(rule => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)));
  };

  const handleViewDetails = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id, { silent: true });
    }
    if (notification.link) {
      navigate(notification.link);
      return;
    }
    switch (notification.type) {
      case "application":
        navigate("/dashboard/applied-jobs");
        return;
      case "message":
        navigate("/dashboard/messages");
        return;
      case "payment":
        navigate("/dashboard/e-wallet");
        return;
      case "achievement":
        navigate("/dashboard/profile");
        return;
      case "alert":
        navigate("/dashboard/notifications");
        return;
      default:
        navigate("/dashboard");
    }
  };

  const handleAlertAction = (alert: AlertItem) => {
    if (alert.category === "payments") {
      navigate("/dashboard/e-wallet");
      return;
    }
    if (alert.category === "jobs") {
      navigate("/dashboard/employer/jobs");
      return;
    }
    if (alert.category === "security") {
      navigate("/dashboard/settings");
      return;
    }
    navigate("/dashboard/support");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "application":
        return <Briefcase className="w-5 h-5" />;
      case "payment":
        return <DollarSign className="w-5 h-5" />;
      case "message":
        return <MessageSquare className="w-5 h-5" />;
      case "alert":
        return <AlertCircle className="w-5 h-5" />;
      case "achievement":
        return <Star className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case "application":
        return "bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] text-[#3B82F6]";
      case "payment":
        return "bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] text-[#10B981]";
      case "message":
        return "bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] text-[#F59E0B]";
      case "alert":
        return "bg-gradient-to-br from-[#FEE2E2] to-[#FECACA] text-[#EF4444]";
      case "achievement":
        return "bg-gradient-to-br from-[#E9D5FF] to-[#DDD6FE] text-[#8B5CF6]";
      default:
        return "bg-gradient-to-br from-[#E5E7EB] to-[#D1D5DB] text-[#6B7280]";
    }
  };

  const getAlertIcon = (alert: AlertItem) => {
    if (alert.severity === "critical") {
      return <AlertTriangle className="w-5 h-5" />;
    }
    switch (alert.category) {
      case "security":
        return <ShieldCheck className="w-5 h-5" />;
      case "payments":
        return <DollarSign className="w-5 h-5" />;
      case "jobs":
        return <Briefcase className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getAlertIconStyle = (alert: AlertItem) => {
    if (alert.severity === "critical") {
      return "bg-gradient-to-br from-[#FEE2E2] to-[#FECACA] text-[#EF4444]";
    }
    if (alert.severity === "warning") {
      return "bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] text-[#F59E0B]";
    }
    return "bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] text-[#3B82F6]";
  };

  const getAlertSeverityStyle = (severity: AlertItem["severity"]) => {
    switch (severity) {
      case "critical":
        return "bg-[#FEE2E2] text-[#B91C1C]";
      case "warning":
        return "bg-[#FEF3C7] text-[#B45309]";
      default:
        return "bg-[#DBEAFE] text-[#1D4ED8]";
    }
  };

  const getAlertStatusStyle = (status: AlertItem["status"]) => {
    switch (status) {
      case "resolved":
        return "bg-[#DCFCE7] text-[#166534]";
      case "snoozed":
        return "bg-[#E0E7FF] text-[#3730A3]";
      default:
        return "bg-[#E2E8F0] text-[#475569]";
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return n.type === filter;
  });

  const alertStats = {
    open: alerts.filter(alert => alert.status === "open").length,
    critical: alerts.filter(alert => alert.severity === "critical" && alert.status !== "resolved").length,
    snoozed: alerts.filter(alert => alert.status === "snoozed").length,
    resolved: alerts.filter(alert => alert.status === "resolved").length,
  };

  const filteredAlerts = alerts.filter(alert => {
    if (alertFilter === "all") return true;
    if (alertFilter === "critical") return alert.severity === "critical" && alert.status !== "resolved";
    if (alertFilter === "open") return alert.status === "open";
    if (alertFilter === "snoozed") return alert.status === "snoozed";
    return alert.status === "resolved";
  });

  const preferenceItems: Array<{
    key: keyof typeof deliveryPreferences;
    title: string;
    description: string;
    icon: ReactNode;
  }> = [
    {
      key: "inApp",
      title: "In-app",
      description: "Real-time alerts while you are online.",
      icon: <BellRing className="w-5 h-5" />,
    },
    {
      key: "email",
      title: "Email",
      description: "Daily summaries and payment updates.",
      icon: <Mail className="w-5 h-5" />,
    },
    {
      key: "sms",
      title: "SMS",
      description: "Critical alerts sent to your phone.",
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      key: "push",
      title: "Push",
      description: "Fast notifications on mobile devices.",
      icon: <Smartphone className="w-5 h-5" />,
    },
  ];

  const digestOptions: Array<{ value: "instant" | "daily" | "weekly"; label: string; description: string }> = [
    { value: "instant", label: "Instant", description: "Send notifications as they happen." },
    { value: "daily", label: "Daily", description: "Summaries delivered every morning." },
    { value: "weekly", label: "Weekly", description: "One overview every Monday." },
  ];

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] text-[#6B7280]">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-[#1C4D8D] text-white rounded-[12px] hover:bg-[#0F2954] transition-all font-medium text-[14px]"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          )}
          <button
            onClick={deleteAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E7EB] text-[#6B7280] rounded-[12px] hover:bg-gray-50 transition-all font-medium text-[14px]"
          >
            <Trash2 className="w-4 h-4" />
            Clear read
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-2 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
            filter === "all"
              ? "bg-[#1C4D8D] text-white"
              : "bg-transparent text-[#6B7280] hover:bg-gray-50"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
            filter === "unread"
              ? "bg-[#1C4D8D] text-white"
              : "bg-transparent text-[#6B7280] hover:bg-gray-50"
          }`}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          onClick={() => setFilter("application")}
          className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
            filter === "application"
              ? "bg-[#1C4D8D] text-white"
              : "bg-transparent text-[#6B7280] hover:bg-gray-50"
          }`}
        >
          Applications
        </button>
        <button
          onClick={() => setFilter("payment")}
          className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
            filter === "payment"
              ? "bg-[#1C4D8D] text-white"
              : "bg-transparent text-[#6B7280] hover:bg-gray-50"
          }`}
        >
          Payments
        </button>
        <button
          onClick={() => setFilter("message")}
          className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
            filter === "message"
              ? "bg-[#1C4D8D] text-white"
              : "bg-transparent text-[#6B7280] hover:bg-gray-50"
          }`}
        >
          Messages
        </button>
        <button
          onClick={() => setFilter("alert")}
          className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
            filter === "alert"
              ? "bg-[#1C4D8D] text-white"
              : "bg-transparent text-[#6B7280] hover:bg-gray-50"
          }`}
        >
          Alerts
        </button>
        <button
          onClick={() => setFilter("achievement")}
          className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
            filter === "achievement"
              ? "bg-[#1C4D8D] text-white"
              : "bg-transparent text-[#6B7280] hover:bg-gray-50"
          }`}
        >
          Achievements
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 text-center text-[14px] text-[#6B7280]">
            Loading notifications...
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-[16px] border border-[#FECACA] p-6 text-center text-[14px] text-[#B91C1C]">
            {loadError}
          </div>
        ) : filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-[16px] border border-[#E5E7EB] p-5 transition-all hover:shadow-md ${
                !notification.read ? "bg-[#EEF2FF] border-[#C7D2FE]" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 ${getIconColor(notification.type)}`}>
                  {getIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[16px] text-[#111827]">
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-[#3B82F6]"></div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="text-[#9CA3AF] hover:text-[#EF4444] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[14px] text-[#6B7280] mb-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-[#9CA3AF]">{notification.time}</p>
                    <div className="flex items-center gap-2">
                      {notification.actionable && (
                        <button
                          onClick={() => handleViewDetails(notification)}
                          className={`px-3 py-1.5 text-[12px] font-medium rounded-[8px] transition-all ${
                            notification.read
                              ? "bg-[#E2E8F0] text-[#475569] hover:bg-[#CBD5F5]"
                              : "bg-[#1C4D8D] text-white hover:bg-[#0F2954]"
                          }`}
                        >
                          {notification.read ? "Viewed" : "View Details"}
                        </button>
                      )}
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="px-3 py-1.5 bg-white border border-[#E5E7EB] text-[#6B7280] text-[12px] font-medium rounded-[8px] hover:bg-gray-50 transition-all"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-12 text-center">
            <Bell className="w-16 h-16 text-[#D1D5DB] mx-auto mb-4" />
            <h3 className="text-[18px] font-semibold text-[#111827] mb-2">No notifications</h3>
            <p className="text-[14px] text-[#6B7280]">
              {filter === "all" 
                ? "You're all caught up!"
                : `No ${filter} notifications to show`}
            </p>
          </div>
        )}
      </div>

      {/* Alert Center */}
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold text-[#111827]">Alert Center</h2>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Track priority issues and platform alerts that need attention.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#6B7280] bg-[#F8FAFC] border border-[#E5E7EB] rounded-full px-3 py-1">
            <Filter className="w-4 h-4" />
            <span>Filter alerts</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-[14px] border border-[#E5E7EB] p-4 bg-[#F8FAFC]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-[#6B7280]">Open alerts</p>
                <p className="text-[22px] font-semibold text-[#111827]">{alertStats.open}</p>
              </div>
              <div className="w-10 h-10 rounded-[12px] bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center">
                <BellRing className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="rounded-[14px] border border-[#E5E7EB] p-4 bg-[#FEF2F2]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-[#7F1D1D]">Critical alerts</p>
                <p className="text-[22px] font-semibold text-[#7F1D1D]">{alertStats.critical}</p>
              </div>
              <div className="w-10 h-10 rounded-[12px] bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="rounded-[14px] border border-[#E5E7EB] p-4 bg-[#EEF2FF]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-[#3730A3]">Snoozed</p>
                <p className="text-[22px] font-semibold text-[#3730A3]">{alertStats.snoozed}</p>
              </div>
              <div className="w-10 h-10 rounded-[12px] bg-[#E0E7FF] text-[#3730A3] flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="rounded-[14px] border border-[#E5E7EB] p-4 bg-[#F0FDF4]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-[#166534]">Resolved</p>
                <p className="text-[22px] font-semibold text-[#166534]">{alertStats.resolved}</p>
              </div>
              <div className="w-10 h-10 rounded-[12px] bg-[#DCFCE7] text-[#166534] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: "all", label: "All alerts" },
            { value: "open", label: "Open" },
            { value: "critical", label: "Critical" },
            { value: "snoozed", label: "Snoozed" },
            { value: "resolved", label: "Resolved" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setAlertFilter(option.value as typeof alertFilter)}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all ${
                alertFilter === option.value
                  ? "bg-[#1C4D8D] text-white"
                  : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {alertsLoading ? (
            <div className="border border-dashed border-[#E5E7EB] rounded-[16px] p-8 text-center text-[14px] text-[#6B7280]">
              Loading alerts...
            </div>
          ) : alertsError ? (
            <div className="border border-dashed border-[#FECACA] rounded-[16px] p-8 text-center text-[14px] text-[#B91C1C]">
              {alertsError}
            </div>
          ) : filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`border border-[#E5E7EB] rounded-[16px] p-5 transition-all ${
                  alert.status === "resolved" ? "bg-[#F8FAFC]" : "bg-white hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 ${getAlertIconStyle(alert)}`}>
                      {getAlertIcon(alert)}
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="text-[16px] font-semibold text-[#111827]">{alert.title}</h3>
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${getAlertSeverityStyle(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${getAlertStatusStyle(alert.status)}`}>
                          {alert.status === "resolved" && <CheckCircle2 className="w-3.5 h-3.5 inline-block mr-1" />}
                          {alert.status === "snoozed" && <Clock className="w-3.5 h-3.5 inline-block mr-1" />}
                          {alert.status === "open" && <AlertCircle className="w-3.5 h-3.5 inline-block mr-1" />}
                          {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-[14px] text-[#6B7280] mt-2">{alert.description}</p>
                      <div className="flex items-center gap-2 mt-3 text-[12px] text-[#9CA3AF]">
                        <span>{alert.time}</span>
                        <span>•</span>
                        <span>{alert.category.charAt(0).toUpperCase() + alert.category.slice(1)} alert</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.actionLabel && alert.status !== "resolved" && (
                      <button
                        onClick={() => handleAlertAction(alert)}
                        className="px-3 py-1.5 text-[12px] font-medium rounded-[8px] bg-[#1C4D8D] text-white hover:bg-[#0F2954] transition-all"
                      >
                        {alert.actionLabel}
                      </button>
                    )}
                    {alert.status !== "resolved" && (
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="px-3 py-1.5 text-[12px] font-medium rounded-[8px] bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0] transition-all"
                      >
                        Resolve
                      </button>
                    )}
                    {alert.status === "open" && (
                      <button
                        onClick={() => snoozeAlert(alert.id)}
                        className="px-3 py-1.5 text-[12px] font-medium rounded-[8px] bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-gray-50 transition-all"
                      >
                        Snooze
                      </button>
                    )}
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="px-3 py-1.5 text-[12px] font-medium rounded-[8px] text-[#EF4444] hover:bg-[#FEF2F2] transition-all"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="border border-dashed border-[#E5E7EB] rounded-[16px] p-8 text-center">
              <ShieldCheck className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
              <p className="text-[16px] font-semibold text-[#111827]">No alerts to show</p>
              <p className="text-[13px] text-[#6B7280] mt-1">You are cleared for now. Keep an eye on new activity.</p>
            </div>
          )}
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-6 xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-semibold text-[#111827]">Notification Preferences</h2>
              <p className="text-[14px] text-[#6B7280] mt-1">
                Choose how you want to receive updates from Microjob.
              </p>
            </div>
            <div className="w-10 h-10 rounded-[12px] bg-[#EEF2FF] text-[#1C4D8D] flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {preferenceItems.map((preference) => (
              <div key={preference.key} className="border border-[#E5E7EB] rounded-[14px] p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-[#F3F4F6] text-[#1F2937] flex items-center justify-center">
                    {preference.icon}
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[#111827]">{preference.title}</p>
                    <p className="text-[12px] text-[#6B7280] mt-1">{preference.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => togglePreference(preference.key)}
                  className={`px-3 py-1.5 text-[12px] font-semibold rounded-[999px] transition-all ${
                    deliveryPreferences[preference.key]
                      ? "bg-[#1EC19A] text-white"
                      : "bg-[#E5E7EB] text-[#6B7280]"
                  }`}
                  aria-pressed={deliveryPreferences[preference.key]}
                >
                  {deliveryPreferences[preference.key] ? "Enabled" : "Disabled"}
                </button>
              </div>
            ))}
          </div>

          <div className="border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="text-[15px] font-semibold text-[#111827] mb-3">Digest schedule</p>
            <div className="flex flex-wrap gap-3">
              {digestOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleDigestChange(option.value)}
                  className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
                    digestSchedule === option.value
                      ? "bg-[#1C4D8D] text-white"
                      : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-gray-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-[#6B7280] mt-3">
              {digestOptions.find((option) => option.value === digestSchedule)?.description}
            </p>
          </div>

          <div className="border border-[#E5E7EB] rounded-[14px] p-5 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold text-[#111827]">Quiet hours</p>
              <p className="text-[12px] text-[#6B7280] mt-1">Silence non-critical alerts from 10:00 PM to 7:00 AM.</p>
            </div>
            <button
              onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-[999px] transition-all ${
                quietHoursEnabled ? "bg-[#1EC19A] text-white" : "bg-[#E5E7EB] text-[#6B7280]"
              }`}
              aria-pressed={quietHoursEnabled}
            >
              {quietHoursEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-5">
          <div>
            <h2 className="text-[20px] font-semibold text-[#111827]">Alert Rules</h2>
            <p className="text-[13px] text-[#6B7280] mt-1">Control which scenarios create alerts.</p>
          </div>

          <div className="space-y-4">
            {rules.map((rule) => (
              <div key={rule.id} className="border border-[#E5E7EB] rounded-[14px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-[#111827]">{rule.title}</p>
                    <p className="text-[12px] text-[#6B7280] mt-1">{rule.description}</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-2">{rule.channels}</p>
                  </div>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`px-3 py-1.5 text-[12px] font-semibold rounded-[999px] transition-all ${
                      rule.enabled ? "bg-[#1EC19A] text-white" : "bg-[#E5E7EB] text-[#6B7280]"
                    }`}
                    aria-pressed={rule.enabled}
                  >
                    {rule.enabled ? "Active" : "Muted"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
