import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { CookiePolicy } from "./components/CookiePolicy";
import { ForgotPassword } from "./components/ForgotPassword";
import { JobDetails } from "./components/JobDetails";
import { LandingPage } from "./components/LandingPage";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { ResetPassword } from "./components/ResetPassword";
import { Settings } from "./components/Settings";
import { SignIn } from "./components/SignIn";
import { SignUp } from "./components/SignUp";
import { TermsAndConditions } from "./components/TermsAndConditions";
import SidebarLayout from "./components/layout/SidebarLayout";
import { RoleRoute } from "./components/routing/RoleRoute";
import { useAuth } from "./hooks/useAuth";
import EmailVerification from "./pages/emailVerification";
import { TopUpSuccess } from "./pages/TopUpSuccess";
import { PublicProfile } from "./pages/shared/PublicProfile";
import {
  AdminAnalytics,
  AdminDashboard,
  AdminEWalletMonitoring,
  AdminJobMonitoring,
  AdminReports,
  AdminSecurity,
  AdminSignIn,
  AdminUserManagement,
} from "./pages/admin";
import { ApplicationsManagement as Applications } from "./pages/employer/ApplicationsManagement";
import { EmployerDashboard } from "./pages/employer/EmployerDashboard";
import JobPosts from "./pages/employer/JobPosts";
import { JobsManagement } from "./pages/employer/JobsManagement";
import PostJob from "./pages/employer/PostJob";
import NotificationsRouter from "./pages/NotificationsRouter";
import SupportRouter from "./pages/SupportRouter";
import {
  AppliedJobs,
  FindJobs,
  SavedJobs,
  WorkerDashboard,
  WorkerEWallet,
  WorkerMessages,
  WorkerNotifications,
  WorkerProfile,
  WorkerSupport,
} from "./pages/worker";
import { Toaster } from "./lib/toast";
import { ACTIVITY_EVENT, markActivity } from "./utils/activityTracker";
import { getDefaultDashboardPath } from "./utils/dashboardRoutes";
import { ROUTES } from "./utils/routes";

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const WARNING_DURATION_MS = 30 * 1000;

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
    navigate(ROUTES.signInLegacy, { replace: true });
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

    events.forEach((eventName) =>
      window.addEventListener(eventName, handleEvent, { passive: true })
    );
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
  const storedUserRaw = localStorage.getItem("auth_user") || localStorage.getItem("current_user");
  let storedUser: unknown = null;
  if (storedUserRaw) {
    try {
      storedUser = JSON.parse(storedUserRaw);
    } catch {
      storedUser = null;
    }
  }
  const fallbackUser =
    storedUser && typeof storedUser === "object"
      ? (storedUser as { role?: string | null; user_type?: string | null; accountType?: string | null })
      : null;
  const destination = getDefaultDashboardPath(user || fallbackUser);

  return <Navigate to={destination} replace />;
};

const PreserveRedirect: React.FC<{ to: string }> = ({ to }) => {
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: to, search: location.search, hash: location.hash }}
      state={location.state}
      replace
    />
  );
};

const LegacyJobDetailsRedirect: React.FC = () => {
  const location = useLocation();
  const { jobId } = useParams();
  if (!jobId) {
    return (
      <Navigate
        to={{
          pathname: ROUTES.worker.findJobs,
          search: location.search,
          hash: location.hash,
        }}
        state={location.state}
        replace
      />
    );
  }

  return (
    <Navigate
      to={{
        pathname: ROUTES.worker.jobDetails(jobId),
        search: location.search,
        hash: location.hash,
      }}
      state={location.state}
      replace
    />
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <InactivityHandler />
      <Toaster position="top-right" />
      <Routes>
        <Route path={ROUTES.home} element={<LandingPage />} />
        <Route path={ROUTES.signInLegacy} element={<SignIn />} />
        <Route path={ROUTES.signIn} element={<SignIn />} />
        <Route path={ROUTES.signUpLegacy} element={<SignUp />} />
        <Route path={ROUTES.signUp} element={<SignUp />} />
        <Route path={ROUTES.adminSignIn} element={<AdminSignIn />} />
        <Route path={ROUTES.doctorSignIn} element={<PreserveRedirect to={ROUTES.signIn} />} />
        <Route path={ROUTES.emailVerification} element={<EmailVerification />} />
        <Route path={ROUTES.topUpSuccess} element={<TopUpSuccess />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPassword />} />
        <Route path={ROUTES.resetPassword} element={<ResetPassword />} />
        <Route path={ROUTES.terms} element={<TermsAndConditions />} />
        <Route path={ROUTES.privacy} element={<PrivacyPolicy />} />
        <Route path={ROUTES.cookiePolicy} element={<CookiePolicy />} />

        <Route element={<SidebarLayout />}>
          <Route element={<RoleRoute requiredRole="patient" />}>
            <Route path={ROUTES.worker.dashboard} element={<WorkerDashboard />} />
            <Route path={ROUTES.worker.findJobs} element={<FindJobs />} />
            <Route path={ROUTES.worker.appliedJobs} element={<AppliedJobs />} />
            <Route path={ROUTES.worker.savedJobs} element={<SavedJobs />} />
            <Route path={ROUTES.worker.jobDetailsPattern} element={<JobDetails />} />
            <Route path={ROUTES.worker.notifications} element={<WorkerNotifications />} />
            <Route path={ROUTES.worker.profile} element={<WorkerProfile />} />
            <Route path={ROUTES.worker.support} element={<WorkerSupport />} />
            <Route path={ROUTES.worker.messages} element={<WorkerMessages />} />
            <Route path={ROUTES.worker.eWallet} element={<WorkerEWallet />} />
          </Route>

          <Route element={<RoleRoute requiredRole="employer" />}>
            <Route
              path={ROUTES.employer.root}
              element={<PreserveRedirect to={ROUTES.employer.dashboard} />}
            />
            <Route path={ROUTES.employer.dashboard} element={<EmployerDashboard />} />
            <Route path={ROUTES.employer.postJob} element={<PostJob />} />
            <Route path={ROUTES.employer.jobPosts} element={<JobPosts />} />
            <Route path={ROUTES.employer.applications} element={<Applications />} />
            <Route path={ROUTES.employer.jobs} element={<JobsManagement />} />

            <Route
              path={ROUTES.doctor.root}
              element={<PreserveRedirect to={ROUTES.employer.dashboard} />}
            />
            <Route
              path={ROUTES.doctor.dashboard}
              element={<PreserveRedirect to={ROUTES.employer.dashboard} />}
            />
            <Route
              path={ROUTES.doctor.postJob}
              element={<PreserveRedirect to={ROUTES.employer.postJob} />}
            />
            <Route
              path={ROUTES.doctor.jobPosts}
              element={<PreserveRedirect to={ROUTES.employer.jobPosts} />}
            />
            <Route
              path={ROUTES.doctor.applications}
              element={<PreserveRedirect to={ROUTES.employer.applications} />}
            />
            <Route
              path={ROUTES.doctor.jobs}
              element={<PreserveRedirect to={ROUTES.employer.jobs} />}
            />
          </Route>

          <Route element={<RoleRoute requiredRole="admin" />}>
            <Route
              path={ROUTES.admin.root}
              element={<PreserveRedirect to={ROUTES.admin.dashboard} />}
            />
            <Route path={ROUTES.admin.dashboard} element={<AdminDashboard />} />
            <Route path={ROUTES.admin.analytics} element={<AdminAnalytics />} />
            <Route path={ROUTES.admin.reports} element={<AdminReports />} />
            <Route path={ROUTES.admin.eWallet} element={<AdminEWalletMonitoring />} />
            <Route path={ROUTES.admin.jobs} element={<AdminJobMonitoring />} />
            <Route path={ROUTES.admin.security} element={<AdminSecurity />} />
            <Route path={ROUTES.admin.userManagement} element={<AdminUserManagement />} />
          </Route>

          <Route path={ROUTES.settings} element={<Settings />} />
          <Route path={ROUTES.publicProfilePattern} element={<PublicProfile />} />
          <Route path={ROUTES.notifications} element={<NotificationsRouter />} />
          <Route path={ROUTES.support} element={<SupportRouter />} />

          <Route path={ROUTES.legacyDashboard.root} element={<DashboardHomeRoute />} />
          <Route
            path={ROUTES.legacyDashboard.findJobs}
            element={<PreserveRedirect to={ROUTES.worker.findJobs} />}
          />
          <Route path={ROUTES.legacyDashboard.jobDetailsPattern} element={<LegacyJobDetailsRedirect />} />
          <Route path={ROUTES.legacyDashboard.jobDetailsNewPattern} element={<LegacyJobDetailsRedirect />} />
          <Route
            path={ROUTES.legacyDashboard.eWallet}
            element={<PreserveRedirect to={ROUTES.worker.eWallet} />}
          />
          <Route
            path={ROUTES.legacyDashboard.messages}
            element={<PreserveRedirect to={ROUTES.worker.messages} />}
          />
          <Route
            path={ROUTES.legacyDashboard.appliedJobs}
            element={<PreserveRedirect to={ROUTES.worker.appliedJobs} />}
          />
          <Route
            path={ROUTES.legacyDashboard.savedJobs}
            element={<PreserveRedirect to={ROUTES.worker.savedJobs} />}
          />
          <Route
            path={ROUTES.legacyDashboard.notifications}
            element={<PreserveRedirect to={ROUTES.worker.notifications} />}
          />
          <Route
            path={ROUTES.legacyDashboard.support}
            element={<PreserveRedirect to={ROUTES.worker.support} />}
          />
          <Route
            path={ROUTES.legacyDashboard.profile}
            element={<PreserveRedirect to={ROUTES.worker.profile} />}
          />
          <Route
            path={ROUTES.legacyDashboard.settings}
            element={<PreserveRedirect to={ROUTES.settings} />}
          />

          <Route
            path={ROUTES.legacyDashboard.doctor.root}
            element={<PreserveRedirect to={ROUTES.employer.dashboard} />}
          />
          <Route
            path={ROUTES.legacyDashboard.doctor.applications}
            element={<PreserveRedirect to={ROUTES.employer.applications} />}
          />
          <Route
            path={ROUTES.legacyDashboard.doctor.postJob}
            element={<PreserveRedirect to={ROUTES.employer.postJob} />}
          />
          <Route
            path={ROUTES.legacyDashboard.doctor.jobPosts}
            element={<PreserveRedirect to={ROUTES.employer.jobPosts} />}
          />
          <Route
            path={ROUTES.legacyDashboard.doctor.jobs}
            element={<PreserveRedirect to={ROUTES.employer.jobs} />}
          />

          <Route
            path={ROUTES.legacyDashboard.employer.root}
            element={<PreserveRedirect to={ROUTES.employer.dashboard} />}
          />
          <Route
            path={ROUTES.legacyDashboard.employer.applications}
            element={<PreserveRedirect to={ROUTES.employer.applications} />}
          />
          <Route
            path={ROUTES.legacyDashboard.employer.postJob}
            element={<PreserveRedirect to={ROUTES.employer.postJob} />}
          />
          <Route
            path={ROUTES.legacyDashboard.employer.jobPosts}
            element={<PreserveRedirect to={ROUTES.employer.jobPosts} />}
          />
          <Route
            path={ROUTES.legacyDashboard.employer.jobs}
            element={<PreserveRedirect to={ROUTES.employer.jobs} />}
          />

          <Route
            path={ROUTES.legacyDashboard.admin.root}
            element={<PreserveRedirect to={ROUTES.admin.dashboard} />}
          />
          <Route
            path={ROUTES.legacyDashboard.admin.analytics}
            element={<PreserveRedirect to={ROUTES.admin.analytics} />}
          />
          <Route
            path={ROUTES.legacyDashboard.admin.reports}
            element={<PreserveRedirect to={ROUTES.admin.reports} />}
          />
          <Route
            path={ROUTES.legacyDashboard.admin.eWallet}
            element={<PreserveRedirect to={ROUTES.admin.eWallet} />}
          />
          <Route
            path={ROUTES.legacyDashboard.admin.jobs}
            element={<PreserveRedirect to={ROUTES.admin.jobs} />}
          />
          <Route
            path={ROUTES.legacyDashboard.admin.security}
            element={<PreserveRedirect to={ROUTES.admin.security} />}
          />
          <Route
            path={ROUTES.legacyDashboard.admin.userManagement}
            element={<PreserveRedirect to={ROUTES.admin.userManagement} />}
          />

          <Route
            path={ROUTES.legacyShortcuts.findJobs}
            element={<PreserveRedirect to={ROUTES.worker.findJobs} />}
          />
          <Route path={ROUTES.legacyShortcuts.jobDetailsPattern} element={<LegacyJobDetailsRedirect />} />
          <Route
            path={ROUTES.legacyShortcuts.eWallet}
            element={<PreserveRedirect to={ROUTES.worker.eWallet} />}
          />
          <Route
            path={ROUTES.legacyShortcuts.messages}
            element={<PreserveRedirect to={ROUTES.worker.messages} />}
          />
          <Route
            path={ROUTES.legacyShortcuts.appliedJobs}
            element={<PreserveRedirect to={ROUTES.worker.appliedJobs} />}
          />
          <Route
            path={ROUTES.legacyShortcuts.savedJobs}
            element={<PreserveRedirect to={ROUTES.worker.savedJobs} />}
          />
          <Route
            path={ROUTES.legacyShortcuts.profile}
            element={<PreserveRedirect to={ROUTES.worker.profile} />}
          />

        </Route>

        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    </Router>
  );
};

export default App;
