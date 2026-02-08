import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "./microjobs/contexts/AuthContext";
import { LandingPage } from "./microjobs/components/LandingPage";
import { LogoShowcase } from "./microjobs/components/LogoShowcase";
import { SignIn } from "./microjobs/components/SignIn";
import { AdminSignIn } from "./microjobs/components/AdminSignIn";
import { SignUp } from "./microjobs/components/SignUp";
import { ForgotPassword } from "./microjobs/components/ForgotPassword";
import { ResetPassword } from "./microjobs/components/ResetPassword";
import { TermsAndConditions } from "./microjobs/components/TermsAndConditions";
import { PrivacyPolicy } from "./microjobs/components/PrivacyPolicy";
import { CookiePolicy } from "./microjobs/components/CookiePolicy";
import { ProtectedDashboardLayout } from "./microjobs/components/ProtectedDashboardLayout";
import { Dashboard } from "./microjobs/components/Dashboard";
import { EmployerDashboard } from "./microjobs/components/EmployerDashboard";
import { ApplicationsManagement } from "./microjobs/components/ApplicationsManagement";
import { JobsManagement } from "./microjobs/components/JobsManagement";
import { JobPosting } from "./microjobs/components/JobPosting";
import { Profile } from "./microjobs/components/Profile";
import { ProfileNew } from "./microjobs/components/ProfileNew";
import { FindJobs } from "./microjobs/components/FindJobs";
import { JobDetails } from "./microjobs/components/JobDetails";
import { JobDetailsNew } from "./microjobs/components/JobDetailsNew";
import { AppliedJobs } from "./microjobs/components/AppliedJobs";
import { Messages } from "./microjobs/components/Messages";
import { SavedJobs } from "./microjobs/components/SavedJobs";
import { EWallet } from "./microjobs/components/EWallet";
import { Notifications } from "./microjobs/components/Notifications";
import { Settings } from "./microjobs/components/Settings";
import { Support } from "./microjobs/components/Support";
import { AdminDashboard } from "./microjobs/components/AdminDashboard";
import { AdminAnalytics } from "./microjobs/components/AdminAnalytics";
import { AdminEWalletMonitoring } from "./microjobs/components/AdminEWalletMonitoring";
import { AdminJobMonitoring } from "./microjobs/components/AdminJobMonitoring";
import { AdminSecurity } from "./microjobs/components/AdminSecurity";
import { AdminUserManagement } from "./microjobs/components/AdminUserManagement";
import { AdminReports } from "./microjobs/components/AdminReports";
import PhoneVerification from "./pages/phoneVerification";
import { Toaster } from "./microjobs/lib/toast";

const LegacyJobDetailsRedirect: React.FC = () => {
  const { jobId } = useParams();
  return <Navigate to={`/dashboard/job-details/${jobId ?? ""}`} replace />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/logo-showcase" element={<LogoShowcase />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/admin-sign-in" element={<AdminSignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/phone-verification" element={<PhoneVerification />} />

          {/* Legacy routes -> new dashboard paths */}
          <Route path="/find-jobs" element={<Navigate to="/dashboard/find-jobs" replace />} />
          <Route path="/job-details/:jobId" element={<LegacyJobDetailsRedirect />} />
          <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
          <Route path="/e-wallet" element={<Navigate to="/dashboard/e-wallet" replace />} />
          <Route path="/messages" element={<Navigate to="/dashboard/messages" replace />} />
          <Route path="/notifications" element={<Navigate to="/dashboard/notifications" replace />} />
          <Route path="/support" element={<Navigate to="/dashboard/support" replace />} />
          <Route path="/profile" element={<Navigate to="/dashboard/profile" replace />} />
          <Route path="/worker/applied-jobs" element={<Navigate to="/dashboard/applied-jobs" replace />} />
          <Route path="/worker/saved-jobs" element={<Navigate to="/dashboard/saved-jobs" replace />} />
          <Route path="/employer/post-job" element={<Navigate to="/dashboard/employer/post-job" replace />} />
          <Route path="/employer/applications" element={<Navigate to="/dashboard/employer/applications" replace />} />
          <Route path="/employer/job-posts" element={<Navigate to="/dashboard/employer/jobs" replace />} />
          <Route path="/admin-dashboard" element={<Navigate to="/dashboard/admin-dashboard" replace />} />
          <Route path="/admin/job-posting-monitoring" element={<Navigate to="/dashboard/admin-dashboard/jobs" replace />} />
          <Route path="/admin/e-wallet-monitoring" element={<Navigate to="/dashboard/admin-dashboard/e-wallet" replace />} />
          <Route path="/admin/users" element={<Navigate to="/dashboard/admin-dashboard/user-management" replace />} />
          <Route path="/admin/administrator" element={<Navigate to="/dashboard/admin-dashboard/user-management" replace />} />
          <Route path="/admin/system-admin" element={<Navigate to="/dashboard/admin-dashboard/user-management" replace />} />

          {/* Dashboard Routes */}
          <Route path="/dashboard" element={<ProtectedDashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="employer" element={<EmployerDashboard />} />
            <Route path="employer/applications" element={<ApplicationsManagement />} />
            <Route path="employer/jobs" element={<JobsManagement />} />
            <Route path="employer/post-job" element={<JobPosting />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile-new" element={<ProfileNew />} />
            <Route path="find-jobs" element={<FindJobs />} />
            <Route path="job-details/:jobId" element={<JobDetails />} />
            <Route path="job-details-new/:jobId" element={<JobDetailsNew />} />
            <Route path="applied-jobs" element={<AppliedJobs />} />
            <Route path="messages" element={<Messages />} />
            <Route path="saved-jobs" element={<SavedJobs />} />
            <Route path="e-wallet" element={<EWallet />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="support" element={<Support />} />
            <Route path="admin-dashboard" element={<AdminDashboard />} />
            <Route path="admin-dashboard/analytics" element={<AdminAnalytics />} />
            <Route path="admin-dashboard/e-wallet" element={<AdminEWalletMonitoring />} />
            <Route path="admin-dashboard/jobs" element={<AdminJobMonitoring />} />
            <Route path="admin-dashboard/reports" element={<AdminReports />} />
            <Route path="admin-dashboard/security" element={<AdminSecurity />} />
            <Route path="admin-dashboard/user-management" element={<AdminUserManagement />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
