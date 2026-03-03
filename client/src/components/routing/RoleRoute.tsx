import { Navigate, Outlet, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getDefaultDashboardPath,
  isAdmin,
  isEmployer,
  isPatient,
} from "../../utils/dashboardRoutes";
import { getSignInRouteForPath } from "../../utils/authRedirects";

export type RouteRole = "patient" | "employer" | "admin";

export function RoleRoute({ requiredRole }: { requiredRole: RouteRole }) {
  const { user: contextUser } = useAuth();
  const location = useLocation();
  const [, setAuthTrigger] = useState(0);
  const hasBothOptionsInContext =
    Array.isArray(contextUser?.accountOptions) &&
    contextUser.accountOptions.includes("worker") &&
    contextUser.accountOptions.includes("employer");

  // Force re-check when auth_user_updated event fires
  useEffect(() => {
    const handleAuthUpdate = () => {
      console.log(`RoleRoute - auth_user_updated event received, forcing re-check`);
      setAuthTrigger(prev => prev + 1);
    };
    
    window.addEventListener("auth_user_updated", handleAuthUpdate);
    return () => window.removeEventListener("auth_user_updated", handleAuthUpdate);
  }, []);

  // For role="both" users, check localStorage to get the ACTUAL current accountType
  // This is necessary because state updates are async and RoleRoute may render 
  // before context updates when a role switch happens
  let user = contextUser;
  if (contextUser?.role === "both" || contextUser?.accountPreference === "both" || hasBothOptionsInContext) {
    try {
      const storedUser = localStorage.getItem("current_user") || localStorage.getItem("auth_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        console.log(`RoleRoute - User has dual account options, using localStorage version:`, parsed);
        user = parsed;
      }
    } catch (e) {
      console.log(`RoleRoute - Error parsing localStorage, using context user`, e);
    }
  }

  console.log(`RoleRoute - Checking ${requiredRole} access, user:`, user);

  if (!user) {
    console.log(`RoleRoute - No user, redirecting to signin`);
    return <Navigate to={getSignInRouteForPath(location.pathname)} replace />;
  }

  const hasAccess =
    requiredRole === "admin"
      ? isAdmin(user)
      : requiredRole === "employer"
      ? isEmployer(user)
      : isPatient(user);

  console.log(`RoleRoute - ${requiredRole} hasAccess:`, hasAccess, `accountType:`, user.accountType);

  if (!hasAccess) {
    const defaultPath = getDefaultDashboardPath(user);
    console.log(`RoleRoute - Access denied, redirecting to ${defaultPath}`);
    return <Navigate to={defaultPath} replace />;
  }

  return <Outlet />;
}
