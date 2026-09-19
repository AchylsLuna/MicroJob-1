import type { API_DIAGNOSTICS } from '../../config';

/** Shared session types, extracted from AppSessionContext so the hooks that
 *  own each concern can reference them without importing the provider. */
export type ViewMode = 'worker' | 'employer';
export type BootstrapIssue = {
  kind: 'unreachable' | 'server' | 'environment-mismatch';
  title: string;
  message: string;
  apiUrl: string;
  expectedEnvironment?: string;
  actualEnvironment?: string;
};
export type ChatTarget = { id: string; name?: string; jobId?: string } | null;
export type SavedJobItem = {
  _id: string;
  title: string;
  company: string;
  location: string;
  tags: string[];
  salary: string;
  jobType?: string;
  jobPoster?: any;
  raw?: any;
};

export type AppSessionContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  hasOnboarded: boolean;
  user: any;
  navigationProfileInitials: string;
  userRole: string | null;
  viewMode: ViewMode;
  canAccessEmployer: boolean;
  canSwitchAccountMode: boolean;
  isSwitchingViewMode: boolean;
  bootstrapIssue: BootstrapIssue | null;
  apiDiagnostics: typeof API_DIAGNOSTICS & { environmentId?: string; databaseId?: string; revision?: string };
  savedJobs: SavedJobItem[];
  savedJobIds: string[];
  workerNotifications: any[];
  employerNotifications: any[];
  workerNotificationUnreadCount: number;
  employerNotificationUnreadCount: number;
  pendingNotificationData: Record<string, unknown> | null;
  messageEvents: any[];
  unreadMessageCount: number;
  initialWorkerChatTarget: ChatTarget;
  initialEmployerChatTarget: ChatTarget;
  showIdleWarning: boolean;
  showLogoutModal: boolean;
  markOnboarded: () => Promise<void>;
  registerActivity: (force?: boolean) => void;
  dismissIdleWarning: () => void;
  openLogoutConfirm: () => void;
  closeLogoutConfirm: () => void;
  handleAuthSuccess: () => Promise<void>;
  logout: () => Promise<void>;
  switchViewMode: (nextView: ViewMode) => Promise<boolean>;
  setInitialWorkerChatTarget: (target: ChatTarget) => void;
  clearInitialWorkerChatTarget: () => void;
  setInitialEmployerChatTarget: (target: ChatTarget) => void;
  clearInitialEmployerChatTarget: () => void;
  dismissWorkerNotification: (notificationId: string) => void;
  consumePendingNotification: () => void;
  toggleSavedJob: (job: any) => Promise<void>;
  removeSavedJob: (jobId: string) => Promise<void>;
  refreshSavedJobs: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshUnreadMessages: () => Promise<void>;
  refreshProfile: () => Promise<boolean>;
  retryBootstrap: () => Promise<void>;
  resetSessionForCurrentApi: () => Promise<void>;
};
