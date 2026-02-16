import React, { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import SidebarLayout from "./components/layout/SidebarLayout";
import { LandingPage } from "./microjobs/components/LandingPage";
import { SignIn } from "./microjobs/components/SignIn";
import { SignUp } from "./microjobs/components/SignUp";
import { OTPVerification as EmailVerification } from "./microjobs/components/OTPVerification";
import { ACTIVITY_EVENT, markActivity } from "./utils/activityTracker";
import { AppliedJobs, SavedJobs, WorkerDashboard, WorkerNotifications, WorkerProfile, WorkerSupport, WorkerMessages, WorkerEWallet, FindJobs } from "./pages/worker";
import { PostJob, JobPosts, Applications, EmployerDashboard, JobsManagement } from "./pages/employer";
import { AdminDashboard, AdminAnalytics, AdminReports, AdminEWalletMonitoring, AdminJobMonitoring, AdminSecurity, AdminUserManagement, AdminSignIn } from "./pages/admin";
import { JobDetails } from "./microjobs/components/JobDetails";
import { useAuth } from "./hooks/useAuth";
import {
  EMPLOYER_DASHBOARD_PATH,
  ADMIN_DASHBOARD_PATH,
  WORKER_DASHBOARD_PATH,
  getDefaultDashboardPath,
  isAdmin,
  isEmployer,
} from "./utils/dashboardRoutes";

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const WARNING_DURATION_MS = 1 * 1000;

const InactivityHandler: React.FC = () => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const isAuthenticated = useCallback(() => {
    return Boolean(localStorage.getItem("auth_token"));
  }, []);

  const performLogout = useCallback(() => {
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("pending_verification_email");
    window.dispatchEvent(new Event("auth_user_updated"));
    setShowWarning(false);
    navigate("/signin", { replace: true });
  }, [navigate]);

  const scheduleTimers = useCallback(() => {
    clearTimers();
    if (!isAuthenticated()) {
      setShowWarning(false);
      return;
    }

    warningTimerRef.current = window.setTimeout(() => {
      setShowWarning(true);
    }, Math.max(IDLE_TIMEOUT_MS - WARNING_DURATION_MS, 0));

    logoutTimerRef.current = window.setTimeout(() => {
      performLogout();
    }, IDLE_TIMEOUT_MS);
  }, [clearTimers, isAuthenticated, performLogout]);

  const handleActivity = useCallback(
    (force = false) => {
      if (!isAuthenticated()) {
        return;
      }
      if (showWarning && !force) {
        return;
      }
      setShowWarning(false);
      scheduleTimers();
    },
    [isAuthenticated, scheduleTimers, showWarning]
  );

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    const handleEvent = () => handleActivity();

    events.forEach((eventName) => window.addEventListener(eventName, handleEvent, { passive: true }));
    window.addEventListener(ACTIVITY_EVENT, handleEvent);
    window.addEventListener("auth_user_updated", handleEvent);

    scheduleTimers();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleEvent));
      window.removeEventListener(ACTIVITY_EVENT, handleEvent);
      window.removeEventListener("auth_user_updated", handleEvent);
      clearTimers();
    };
  }, [clearTimers, handleActivity, scheduleTimers]);

  if (!showWarning) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Session timeout</h3>
        <p className="text-sm text-gray-900 mb-6">
          Your session will end due to inactivity. Press OK to continue.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              markActivity();
              handleActivity(true);
            }}
            className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-black hover:bg-red-600"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardHomeRoute: React.FC = () => {
  const { user } = useAuth();
  const destination = getDefaultDashboardPath(user);

  // Always redirect to user's role-specific dashboard
  return <Navigate to={destination} replace />;
};

const App: React.FC = () => {
  return (
    <Router>
      <InactivityHandler />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/admin-sign-in" element={<AdminSignIn />} />

        <Route element={<SidebarLayout />}>
          {/* ========== WORKER ROUTES ========== */}
          <Route path="/worker/dashboard" element={<WorkerDashboard />} />
          <Route path="/worker/find-jobs" element={<FindJobs />} />
          <Route path="/worker/applied-jobs" element={<AppliedJobs />} />
          <Route path="/worker/saved-jobs" element={<SavedJobs />} />
          <Route path="/worker/job-details/:jobId" element={<JobDetails />} />
          <Route path="/worker/notifications" element={<WorkerNotifications />} />
          <Route path="/worker/profile" element={<WorkerProfile />} />
          <Route path="/worker/support" element={<WorkerSupport />} />
          <Route path="/worker/messages" element={<WorkerMessages />} />
          <Route path="/worker/e-wallet" element={<WorkerEWallet />} />

          {/* ========== EMPLOYER ROUTES ========== */}
          <Route path="/employer/dashboard" element={<EmployerDashboard />} />
          <Route path="/employer/post-job" element={<PostJob />} />
          <Route path="/employer/job-posts" element={<JobPosts />} />
          <Route path="/employer/applications" element={<Applications />} />
          <Route path="/employer/jobs" element={<JobsManagement />} />

          {/* ========== ADMIN ROUTES ========== */}
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/e-wallet" element={<AdminEWalletMonitoring />} />
          <Route path="/admin/jobs" element={<AdminJobMonitoring />} />
          <Route path="/admin/security" element={<AdminSecurity />} />
          <Route path="/admin/user-management" element={<AdminUserManagement />} />

          {/* ========== LEGACY ROUTES (Backward Compatibility) ========== */}
          <Route path="/dashboard" element={<DashboardHomeRoute />} />
          <Route path="/dashboard/find-jobs" element={<Navigate to="/worker/find-jobs" replace />} />
          <Route path="/dashboard/job-details/:jobId" element={<Navigate to="/worker/job-details/:jobId" replace />} />
          <Route path="/dashboard/job-details-new/:jobId" element={<Navigate to="/worker/job-details/:jobId" replace />} />
          <Route path="/dashboard/e-wallet" element={<Navigate to="/worker/e-wallet" replace />} />
          <Route path="/dashboard/messages" element={<Navigate to="/worker/messages" replace />} />
          <Route path="/dashboard/applied-jobs" element={<Navigate to="/worker/applied-jobs" replace />} />
          <Route path="/dashboard/saved-jobs" element={<Navigate to="/worker/saved-jobs" replace />} />
          <Route path="/dashboard/notifications" element={<Navigate to="/worker/notifications" replace />} />
          <Route path="/dashboard/support" element={<Navigate to="/worker/support" replace />} />
          <Route path="/dashboard/profile" element={<Navigate to="/worker/profile" replace />} />

          {/* Legacy Employer Routes */}
          <Route path="/dashboard/employer" element={<Navigate to="/employer/dashboard" replace />} />
          <Route path="/dashboard/employer/applications" element={<Navigate to="/employer/applications" replace />} />
          <Route path="/dashboard/employer/post-job" element={<Navigate to="/employer/post-job" replace />} />
          <Route path="/dashboard/employer/job-posts" element={<Navigate to="/employer/job-posts" replace />} />
          <Route path="/dashboard/employer/jobs" element={<Navigate to="/employer/jobs" replace />} />

          {/* Legacy Admin Routes */}
          <Route path="/dashboard/admin-dashboard" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/dashboard/admin-dashboard/analytics" element={<Navigate to="/admin/analytics" replace />} />
          <Route path="/dashboard/admin-dashboard/reports" element={<Navigate to="/admin/reports" replace />} />
          <Route path="/dashboard/admin-dashboard/e-wallet" element={<Navigate to="/admin/e-wallet" replace />} />
          <Route path="/dashboard/admin-dashboard/jobs" element={<Navigate to="/admin/jobs" replace />} />
          <Route path="/dashboard/admin-dashboard/security" element={<Navigate to="/admin/security" replace />} />
          <Route path="/dashboard/admin-dashboard/user-management" element={<Navigate to="/admin/user-management" replace />} />

          {/* Root-level redirects (old patterns) */}
          <Route path="/find-jobs" element={<Navigate to="/worker/find-jobs" replace />} />
          <Route path="/job-details/:jobId" element={<Navigate to="/worker/job-details/:jobId" replace />} />
          <Route path="/e-wallet" element={<Navigate to="/worker/e-wallet" replace />} />
          <Route path="/messages" element={<Navigate to="/worker/messages" replace />} />

          {/* Catch-all redirects */}
          <Route path="/employer" element={<Navigate to={EMPLOYER_DASHBOARD_PATH} replace />} />
          <Route path="/admin" element={<Navigate to={ADMIN_DASHBOARD_PATH} replace />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
