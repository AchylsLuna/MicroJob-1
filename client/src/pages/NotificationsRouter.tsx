import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../utils/routes";
import WorkerNotifications from "./worker/Notifications";

// Router component that picks the notifications page based on role/account mode
export default function NotificationsRouter() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return (
      <Navigate
        to={ROUTES.signIn}
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
        replace
      />
    );
  }

  if (user.role === "admin") {
    return <Navigate to={ROUTES.admin.dashboard} replace />;
  }

  return <WorkerNotifications />;
}
