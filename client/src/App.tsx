import React, { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import SidebarLayout from "./components/layout/SidebarLayout";
import Home from "./pages/Home";
import SignIn from "./pages/signIn";
import SignUp from "./pages/signUp";
import Dashboard from "./pages/Dashboard";
import EmailVerification from "./pages/emailVerification";
import FindJobs from "./pages/FindJobs";
import JobDetails from "./pages/JobDetails";
import Settings from "./pages/Settings";
import EWallet from "./pages/EWallet";
import { ACTIVITY_EVENT, markActivity } from "./utils/activityTracker";
import { AppliedJobs, SavedJobs } from "./pages/worker";
import { PostJob, Applications, JobPosts } from "./pages/employer";
import Messages from "./pages/Messages";
import { EmployerDashboard } from "./microjobs/components/EmployerDashboard";
import { JobsManagement } from "./microjobs/components/JobsManagement";
import { Notifications } from "./microjobs/components/Notifications";
import { Support } from "./microjobs/components/Support";
import { Profile } from "./microjobs/components/Profile";
import { AdminDashboard } from "./microjobs/components/AdminDashboard";
import { AdminAnalytics } from "./microjobs/components/AdminAnalytics";
import { AdminReports } from "./microjobs/components/AdminReports";
import { AdminEWalletMonitoring } from "./microjobs/components/AdminEWalletMonitoring";
import { AdminJobMonitoring } from "./microjobs/components/AdminJobMonitoring";
import { AdminSecurity } from "./microjobs/components/AdminSecurity";
import { AdminUserManagement } from "./microjobs/components/AdminUserManagement";
import { AdminSignIn } from "./microjobs/components/AdminSignIn";

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

const App: React.FC = () => {
  return (
    <Router>
      <InactivityHandler />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/email-verification" element={<EmailVerification />} />
        <Route path="/admin-sign-in" element={<AdminSignIn />} />

        <Route element={<SidebarLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/find-jobs" element={<FindJobs />} />
          <Route path="/dashboard/job-details/:jobId" element={<JobDetails />} />
          <Route path="/dashboard/job-details-new/:jobId" element={<JobDetails />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route path="/dashboard/e-wallet" element={<EWallet />} />
          <Route path="/dashboard/messages" element={<Messages />} />
          <Route path="/dashboard/applied-jobs" element={<AppliedJobs />} />
          <Route path="/dashboard/saved-jobs" element={<SavedJobs />} />
          <Route path="/dashboard/notifications" element={<Notifications />} />
          <Route path="/dashboard/support" element={<Support />} />
          <Route path="/dashboard/profile" element={<Profile />} />

          <Route path="/dashboard/employer" element={<EmployerDashboard />} />
          <Route path="/dashboard/employer/applications" element={<Applications />} />
          <Route path="/dashboard/employer/post-job" element={<PostJob />} />
          <Route path="/dashboard/employer/job-posts" element={<JobPosts />} />
          <Route path="/dashboard/employer/jobs" element={<JobsManagement />} />

          <Route path="/dashboard/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/dashboard/admin-dashboard/analytics" element={<AdminAnalytics />} />
          <Route path="/dashboard/admin-dashboard/reports" element={<AdminReports />} />
          <Route path="/dashboard/admin-dashboard/e-wallet" element={<AdminEWalletMonitoring />} />
          <Route path="/dashboard/admin-dashboard/jobs" element={<AdminJobMonitoring />} />
          <Route path="/dashboard/admin-dashboard/security" element={<AdminSecurity />} />
          <Route path="/dashboard/admin-dashboard/user-management" element={<AdminUserManagement />} />
          <Route path="/find-jobs" element={<FindJobs />} />
          <Route path="/job-details/:jobId" element={<JobDetails />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/e-wallet" element={<EWallet />} />

          <Route path="/worker/applied-jobs" element={<AppliedJobs />} />
          <Route path="/worker/saved-jobs" element={<SavedJobs />} />

          <Route path="/employer/post-job" element={<PostJob />} />
          <Route path="/employer/applications" element={<Applications />} />
          <Route path="/employer/job-posts" element={<JobPosts />} />
          <Route path="/messages" element={<Messages />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
