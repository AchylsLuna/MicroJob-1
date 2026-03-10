import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../utils/routes";
import WorkerNotifications from "./worker/Notifications";

// Router component that picks the notifications page based on role/account mode
export default function NotificationsRouter() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to={ROUTES.signIn} replace />;
  }

  if (user.role === "admin") {
    return <Navigate to={ROUTES.admin.dashboard} replace />;
  }

  return <WorkerNotifications />;
}
