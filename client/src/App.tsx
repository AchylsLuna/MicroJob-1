import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import SidebarLayout from "./components/layout/SidebarLayout";
import { RoleRoute } from "./components/routing/RoleRoute";
import { useAuth } from "./hooks/useAuth";
import { Toaster } from "./lib/toast";
import { ACTIVITY_EVENT, markActivity } from "./utils/activityTracker";
import { getDefaultDashboardPath } from "./utils/dashboardRoutes";
import { ROUTES } from "./utils/routes";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_DURATION_MS = 30 * 1000;

const CookiePolicy = lazy(() => import("./components/CookiePolicy").then((module) => ({ default: module.CookiePolicy })));
const ForgotPassword = lazy(() => import("./components/ForgotPassword").then((module) => ({ default: module.ForgotPassword })));
const JobDetails = lazy(() => import("./components/JobDetails").then((module) => ({ default: module.JobDetails })));
const InitialPasswordChange = lazy(() => import("./components/InitialPasswordChange").then((module) => ({ default: module.InitialPasswordChange })));
const LandingPage = lazy(() => import("./components/LandingPage").then((module) => ({ default: module.LandingPage })));
const PrivacyPolicy = lazy(() => import("./components/PrivacyPolicy").then((module) => ({ default: module.PrivacyPolicy })));
const Settings = lazy(() => import("./components/Settings").then((module) => ({ default: module.Settings })));
const SignIn = lazy(() => import("./components/SignIn").then((module) => ({ default: module.SignIn })));
const SignUp = lazy(() => import("./components/SignUp").then((module) => ({ default: module.SignUp })));
const TermsAndConditions = lazy(() => import("./components/TermsAndConditions").then((module) => ({ default: module.TermsAndConditions })));
const EmailVerification = lazy(() => import("./pages/emailVerification"));
const TopUpSuccess = lazy(() => import("./pages/TopUpSuccess").then((module) => ({ default: module.TopUpSuccess })));
const PublicProfile = lazy(() => import("./pages/shared/PublicProfile").then((module) => ({ default: module.PublicProfile })));
const NotificationsRouter = lazy(() => import("./pages/NotificationsRouter"));
const SupportRouter = lazy(() => import("./pages/SupportRouter"));

const WorkerDashboard = lazy(() => import("./pages/worker/Dashboard").then((module) => ({ default: module.Dashboard })));
const FindJobs = lazy(() => import("./pages/worker/FindJobs").then((module) => ({ default: module.FindJobs })));
const AppliedJobs = lazy(() => import("./pages/worker/AppliedJobs"));
const SavedJobs = lazy(() => import("./pages/worker/SavedJobs").then((module) => ({ default: module.SavedJobs })));
const WorkerMessages = lazy(() => import("./pages/worker/Messages").then((module) => ({ default: module.Messages })));
const WorkerEWallet = lazy(() => import("./pages/worker/EWallet").then((module) => ({ default: module.EWallet })));
const WorkerNotifications = lazy(() => import("./pages/worker/Notifications"));
const WorkerProfile = lazy(() => import("./pages/worker/Profile").then((module) => ({ default: module.Profile })));
const WorkerSupport = lazy(() => import("./pages/worker/Support").then((module) => ({ default: module.Support })));

const EmployerDashboard = lazy(() => import("./pages/employer/EmployerDashboard").then((module) => ({ default: module.EmployerDashboard })));
const PostJob = lazy(() => import("./pages/employer/PostJob"));
const Applications = lazy(() => import("./pages/employer/ApplicationsManagement").then((module) => ({ default: module.ApplicationsManagement })));
const JobsManagement = lazy(() => import("./pages/employer/JobsManagement").then((module) => ({ default: module.JobsManagement })));

const AdminSignIn = lazy(() => import("./pages/admin/AdminSignIn").then((module) => ({ default: module.AdminSignIn })));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard").then((module) => ({ default: module.AdminDashboard })));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics").then((module) => ({ default: module.AdminAnalytics })));
const AdminReports = lazy(() => import("./pages/admin/AdminReports").then((module) => ({ default: module.AdminReports })));
const AdminEWalletMonitoring = lazy(() => import("./pages/admin/AdminEWalletMonitoring").then((module) => ({ default: module.AdminEWalletMonitoring })));
const AdminPayoutRequests = lazy(() => import("./pages/admin/AdminPayoutRequests").then((module) => ({ default: module.AdminPayoutRequests })));
const AdminJobMonitoring = lazy(() => import("./pages/admin/AdminJobMonitoring").then((module) => ({ default: module.AdminJobMonitoring })));
const AdminSecurity = lazy(() => import("./pages/admin/AdminSecurity").then((module) => ({ default: module.AdminSecurity })));
const AdminSupportTickets = lazy(() => import("./pages/admin/AdminSupportTickets").then((module) => ({ default: module.AdminSupportTickets })));
const AdminUserManagement = lazy(() => import("./pages/admin/AdminUserManagement").then((module) => ({ default: module.AdminUserManagement })));

const RouteLoading = () => <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center text-sm font-medium text-slate-600"><span className="mr-3 h-6 w-6 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" aria-hidden="true" />Loading page…</div>;

const InactivityHandler: React.FC = () => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showWarning) continueButtonRef.current?.focus();
  }, [showWarning]);

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
    return Boolean(localStorage.getItem("auth_user") || localStorage.getItem("current_user"));
  }, []);

  const performLogout = useCallback(() => {
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    localStorage.removeItem("auth_user");
    localStorage.removeItem("current_user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("token");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="session-timeout-title" aria-describedby="session-timeout-description" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 id="session-timeout-title" className="text-lg font-bold text-gray-900 mb-2">Session ending soon</h3>
        <p id="session-timeout-description" className="text-sm text-gray-700 mb-6">
          Your session will end in about 30 seconds because of inactivity. Continue working to keep your session active.
        </p>
        <div className="flex gap-3">
          <button
            ref={continueButtonRef}
            type="button"
            onClick={() => {
              markActivity();
              handleActivity(true);
            }}
            className="flex-1 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Continue working
          </button>
          <button type="button" onClick={performLogout} className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Sign out</button>
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
      <Suspense fallback={<RouteLoading />}>
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
        <Route path={ROUTES.resetPassword} element={<PreserveRedirect to={ROUTES.forgotPassword} />} />
        <Route path={ROUTES.changeInitialPassword} element={<InitialPasswordChange />} />
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
            <Route
              path="/employer/job-posts"
              element={<PreserveRedirect to={ROUTES.employer.postJob} />}
            />
            <Route path={ROUTES.employer.applications} element={<Applications />} />
            <Route path={ROUTES.employer.jobs} element={<JobsManagement />} />
            <Route path={ROUTES.employer.messages} element={<WorkerMessages />} />
            <Route path={ROUTES.employer.eWallet} element={<WorkerEWallet />} />
            <Route path={ROUTES.employer.notifications} element={<NotificationsRouter />} />
            <Route path={ROUTES.employer.support} element={<SupportRouter />} />
            <Route path={ROUTES.employer.settings} element={<Settings />} />

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
              path="/doctor/job-posts"
              element={<PreserveRedirect to={ROUTES.employer.postJob} />}
            />
            <Route
              path={ROUTES.doctor.applications}
              element={<PreserveRedirect to={ROUTES.employer.applications} />}
            />
            <Route
              path={ROUTES.doctor.jobs}
              element={<PreserveRedirect to={ROUTES.employer.jobs} />}
            />
            <Route
              path={ROUTES.doctor.messages}
              element={<PreserveRedirect to={ROUTES.employer.messages} />}
            />
            <Route
              path={ROUTES.doctor.eWallet}
              element={<PreserveRedirect to={ROUTES.employer.eWallet} />}
            />
            <Route
              path={ROUTES.doctor.notifications}
              element={<PreserveRedirect to={ROUTES.employer.notifications} />}
            />
            <Route
              path={ROUTES.doctor.support}
              element={<PreserveRedirect to={ROUTES.employer.support} />}
            />
            <Route
              path={ROUTES.doctor.settings}
              element={<PreserveRedirect to={ROUTES.employer.settings} />}
            />
          </Route>

          <Route element={<RoleRoute requiredRole="admin" />}>
            <Route
              path={ROUTES.admin.root}
              element={<PreserveRedirect to={ROUTES.admin.dashboard} />}
            />
            <Route path={ROUTES.admin.dashboard} element={<AdminDashboard />} />
            <Route path={ROUTES.admin.messages} element={<WorkerMessages />} />
            <Route path={ROUTES.admin.support} element={<AdminSupportTickets />} />
            <Route path={ROUTES.admin.analytics} element={<AdminAnalytics />} />
            <Route path={ROUTES.admin.reports} element={<AdminReports />} />
            <Route path={ROUTES.admin.eWallet} element={<AdminEWalletMonitoring />} />
            <Route path={ROUTES.admin.payouts} element={<AdminPayoutRequests />} />
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
            path="/dashboard/doctor/job-posts"
            element={<PreserveRedirect to={ROUTES.employer.postJob} />}
          />
          <Route
            path={ROUTES.legacyDashboard.doctor.jobs}
            element={<PreserveRedirect to={ROUTES.employer.jobs} />}
          />
          <Route
            path={ROUTES.legacyDashboard.doctor.messages}
            element={<PreserveRedirect to={ROUTES.employer.messages} />}
          />
          <Route
            path={ROUTES.legacyDashboard.doctor.eWallet}
            element={<PreserveRedirect to={ROUTES.employer.eWallet} />}
          />
          <Route
            path={ROUTES.legacyDashboard.doctor.notifications}
            element={<PreserveRedirect to={ROUTES.employer.notifications} />}
          />
          <Route
            path={ROUTES.legacyDashboard.doctor.support}
            element={<PreserveRedirect to={ROUTES.employer.support} />}
          />
          <Route
            path={ROUTES.legacyDashboard.doctor.settings}
            element={<PreserveRedirect to={ROUTES.employer.settings} />}
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
            path="/dashboard/employer/job-posts"
            element={<PreserveRedirect to={ROUTES.employer.postJob} />}
          />
          <Route
            path={ROUTES.legacyDashboard.employer.jobs}
            element={<PreserveRedirect to={ROUTES.employer.jobs} />}
          />
          <Route
            path={ROUTES.legacyDashboard.employer.messages}
            element={<PreserveRedirect to={ROUTES.employer.messages} />}
          />
          <Route
            path={ROUTES.legacyDashboard.employer.eWallet}
            element={<PreserveRedirect to={ROUTES.employer.eWallet} />}
          />
          <Route
            path={ROUTES.legacyDashboard.employer.notifications}
            element={<PreserveRedirect to={ROUTES.employer.notifications} />}
          />
          <Route
            path={ROUTES.legacyDashboard.employer.support}
            element={<PreserveRedirect to={ROUTES.employer.support} />}
          />
          <Route
            path={ROUTES.legacyDashboard.employer.settings}
            element={<PreserveRedirect to={ROUTES.employer.settings} />}
          />

          <Route
            path={ROUTES.legacyDashboard.admin.root}
            element={<PreserveRedirect to={ROUTES.admin.dashboard} />}
          />
          <Route
            path={ROUTES.legacyDashboard.admin.messages}
            element={<PreserveRedirect to={ROUTES.admin.messages} />}
          />
          <Route
            path={ROUTES.legacyDashboard.admin.payouts}
            element={<PreserveRedirect to={ROUTES.admin.payouts} />}
          />
          <Route
            path={ROUTES.legacyDashboard.admin.support}
            element={<PreserveRedirect to={ROUTES.admin.support} />}
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
      </Suspense>
    </Router>
  );
};

export default App;
