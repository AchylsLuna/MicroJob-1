import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  Bell,
  BriefcaseBusiness,
  CirclePlus,
  ClipboardList,
  Home,
  MessageCircle,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getConversations } from "../services/api";
import { useNotifications } from "../contexts/NotificationContext";
import {
  activeNavigationItem,
  navigationForMode,
  type AccountMode,
} from "./roleNavigation";

const icons: Record<string, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  home: Home,
  jobs: BriefcaseBusiness,
  wallet: WalletCards,
  messages: MessageCircle,
  profile: UserRound,
  applications: ClipboardList,
  "post-job": CirclePlus,
  alerts: Bell,
};

const badgeLabel = (count: number) => count > 99 ? "99+" : String(count);

export function ResponsiveBottomNavigation() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mode: AccountMode = user?.accountType === "employer" ? "employer" : "worker";
  const items = navigationForMode(mode);
  const activeItem = activeNavigationItem(location.pathname, items);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { unreadCount: unreadNotifications } = useNotifications();

  const refreshBadges = useCallback(async () => {
    const [conversationsResult] = await Promise.allSettled([getConversations()]);
    if (conversationsResult.status === "fulfilled") {
      const conversations = Array.isArray(conversationsResult.value) ? conversationsResult.value : [];
      setUnreadMessages(conversations.reduce((total, conversation) =>
        total + Number(conversation?.unreadCount || conversation?.unread || 0), 0));
    }
  }, []);

  useEffect(() => {
    void refreshBadges();
    const refresh = () => void refreshBadges();
    window.addEventListener("notification-refresh", refresh);
    window.addEventListener("messages-refresh", refresh);
    return () => {
      window.removeEventListener("notification-refresh", refresh);
      window.removeEventListener("messages-refresh", refresh);
    };
  }, [location.pathname, mode, refreshBadges]);

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() || "U";

  return (
    <nav
      aria-label={`${mode === "employer" ? "Employer" : "Worker"} mobile navigation`}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.09)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex w-full max-w-2xl items-stretch justify-around" role="tablist">
        {items.map((item) => {
          const active = activeItem?.id === item.id;
          const Icon = icons[item.id];
          const badge = item.id === "messages" ? unreadMessages : item.id === "alerts" ? unreadNotifications : 0;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              aria-label={badge > 0 ? `${item.label}, ${badge} unread` : item.label}
              onClick={() => {
                if (!active) navigate(item.path);
              }}
              className={`flex min-h-[66px] min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-0.5 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] sm:text-xs ${active ? "text-[#1C4D8D]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <span className={`relative flex h-10 w-10 items-center justify-center rounded-full ${active ? "bg-[#EAF2FC]" : ""}`}>
                {item.id === "profile" ? (
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-[#1C4D8D] text-white" : "bg-slate-200 text-slate-600"}`}>{initials}</span>
                ) : Icon ? <Icon className="h-5 w-5" aria-hidden /> : null}
                {badge > 0 ? <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white bg-red-500 px-1 text-[9px] font-bold text-white">{badgeLabel(badge)}</span> : null}
              </span>
              <span className="mt-1 w-full truncate text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
