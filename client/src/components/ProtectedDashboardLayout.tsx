import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getSignInRouteForPath } from "../utils/authRedirects";
import { DashboardLayout } from "./DashboardLayout";

export function ProtectedDashboardLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  const getStoredUser = () => {
    try {
      const storedUser = localStorage.getItem("current_user") || localStorage.getItem("auth_user");
      if (!storedUser) return null;
      const parsed = JSON.parse(storedUser);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };

  const storedUser = getStoredUser();
  const hasAuthenticatedSession = Boolean(user || storedUser);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#4988C4] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to role-aware sign-in page if not authenticated
  if (!isAuthenticated && !hasAuthenticatedSession) {
    return <Navigate to={getSignInRouteForPath(location.pathname)} replace />;
  }

  return <DashboardLayout />;
}
