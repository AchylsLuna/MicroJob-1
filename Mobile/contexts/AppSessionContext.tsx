import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '../lib/storage';
import io from 'socket.io-client';
import { API_DIAGNOSTICS, API_URL, SOCKET_PATH, SOCKET_URL } from '../config';
import { apiRequest, asList, asObject, classifyApiFailure, setInvalidSessionHandler } from '../lib/api';
import { useToast } from './ToastContext';
import { subscribeDataRefresh } from '../lib/dataRefresh';
import { getUserInitials } from '../lib/userIdentity';
import { registerPushDevice, subscribeNotificationResponses, takeInitialNotificationData, unregisterPushDevice } from '../lib/pushNotifications';

type ViewMode = 'worker' | 'employer';
type BootstrapIssue = {
  kind: 'unreachable' | 'server' | 'environment-mismatch';
  title: string;
  message: string;
  apiUrl: string;
  expectedEnvironment?: string;
  actualEnvironment?: string;
};
type ChatTarget = { id: string; name?: string; jobId?: string } | null;
type SavedJobItem = {
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

type AppSessionContextValue = {
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

const AppSessionContext = createContext<AppSessionContextValue | undefined>(undefined);

const HAS_ONBOARDED_KEY = 'has_onboarded';
const ACTIVE_VIEW_MODE_KEY = 'active_view_mode';
const SAVED_JOBS_CACHE_KEY = 'saved_jobs_server_cache';
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const AUTH_USER_KEY = 'auth_user';
const API_IDENTITY_KEY = 'api_environment_identity';
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_DURATION_MS = 5 * 60 * 1000;

const normalizeRole = (value: unknown): string | null => {
  const role = String(value || '').toLowerCase();
  if (!role) return null;
  if (role === 'doctor' || role === 'hire') return 'employer';
  if (role === 'work' || role === 'user') return 'worker';
  if (role === 'both') return 'both';
  return role;
};

const normalizeAccountOptions = (value: unknown): ViewMode[] => {
  if (!Array.isArray(value)) return [];
  const next = value
    .map((item) => String(item || '').toLowerCase())
    .map((item) => (item === 'doctor' || item === 'hire' || item === 'employer' ? 'employer' : item === 'worker' || item === 'user' || item === 'work' ? 'worker' : null))
    .filter((item): item is ViewMode => Boolean(item));
  return Array.from(new Set(next));
};

const getSavedJobId = (job: any) => String(job?._id || job?.id || '');

const getNotificationItemId = (item: any): string =>
  String(
    item?.id ||
      item?.notification?._id ||
      item?._id ||
      item?.applicationId ||
      item?.entityId ||
      `${item?.jobId || item?.payoutRequestId || item?.ticketId || 'notification'}-${item?.updatedAt || item?.createdAt || ''}`,
  );

const normalizeSavedJob = (job: any): SavedJobItem | null => {
  if (!job) return null;
  const nestedJob = job.job || job.raw?.job || null;
  const source = nestedJob || job;
  const id = getSavedJobId(source);
  if (!id) return null;
  const poster = source?.jobPoster;
  const company = source?.company || source?.companyName || (poster ? `${poster.firstName || ''} ${poster.lastName || ''}`.trim() : '') || poster?.email || 'Job Poster';
  const tags = Array.isArray(source?.skills)
    ? source.skills
    : Array.isArray(source?.requirements)
      ? source.requirements
      : Array.isArray(job?.tags)
        ? job.tags
        : [];

  return {
    _id: id,
    title: source?.title || 'Untitled job',
    company,
    location: source?.location || 'Unknown location',
    tags,
    salary: source?.salary || '',
    jobType: source?.jobType,
    jobPoster: source?.jobPoster,
    raw: source,
  };
};

const readSavedJobsCache = async (): Promise<SavedJobItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(SAVED_JOBS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [navigationProfileInitials, setNavigationProfileInitials] = useState('U');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('worker');
  const [savedJobs, setSavedJobs] = useState<SavedJobItem[]>([]);
  const [workerNotifications, setWorkerNotifications] = useState<any[]>([]);
  const [employerNotifications, setEmployerNotifications] = useState<any[]>([]);
  const [workerNotificationUnreadCount, setWorkerNotificationUnreadCount] = useState(0);
  const [employerNotificationUnreadCount, setEmployerNotificationUnreadCount] = useState(0);
  const [pendingNotificationData, setPendingNotificationData] = useState<Record<string, unknown> | null>(null);
  const [messageEvents, setMessageEvents] = useState<any[]>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [initialWorkerChatTarget, setInitialWorkerChatTarget] = useState<ChatTarget>(null);
  const [initialEmployerChatTarget, setInitialEmployerChatTarget] = useState<ChatTarget>(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSwitchingViewMode, setIsSwitchingViewMode] = useState(false);
  const [bootstrapIssue, setBootstrapIssue] = useState<BootstrapIssue | null>(null);
  const [apiIdentity, setApiIdentity] = useState<{ environmentId?: string; databaseId?: string; revision?: string }>({});

  const lastActiveAtRef = useRef<number>(Date.now());
  const socketRef = useRef<any>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutRef = useRef<() => Promise<void>>(async () => undefined);
  const socketFailureCountRef = useRef(0);
  const socketErrorLogRef = useRef({ message: '', at: 0 });
  const currentUserIdRef = useRef<string | null>(null);
  const switchingViewModeRef = useRef(false);
  const loggingOutRef = useRef(false);

  const canAccessEmployer = useMemo(() => {
    const role = normalizeRole(userRole);
    return role === 'employer' || role === 'both';
  }, [userRole]);
  const canSwitchAccountMode = normalizeRole(userRole) === 'both';

  const savedJobIds = useMemo(() => savedJobs.map((item) => item._id).filter(Boolean), [savedJobs]);

  const clearIdleTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const scheduleIdleTimers = useCallback(() => {
    clearIdleTimers();
    if (!isAuthenticated) {
      setShowIdleWarning(false);
      return;
    }
    const elapsed = Date.now() - lastActiveAtRef.current;
    const remainingToWarning = Math.max(IDLE_TIMEOUT_MS - WARNING_DURATION_MS - elapsed, 0);
    const remainingToLogout = Math.max(IDLE_TIMEOUT_MS - elapsed, 0);

    if (remainingToLogout <= 0) {
      void logoutRef.current();
      return;
    }

    if (remainingToWarning <= 0) {
      setShowIdleWarning(true);
    } else {
      warningTimerRef.current = setTimeout(() => setShowIdleWarning(true), remainingToWarning);
    }

    logoutTimerRef.current = setTimeout(() => {
      void logoutRef.current();
    }, remainingToLogout);
  }, [clearIdleTimers, isAuthenticated]);

  const registerActivity = useCallback((force = false) => {
    if (!isAuthenticated) return;
    if (showIdleWarning && !force) return;
    lastActiveAtRef.current = Date.now();
    setShowIdleWarning(false);
    scheduleIdleTimers();
  }, [isAuthenticated, scheduleIdleTimers, showIdleWarning]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isAuthenticated) {
        const elapsed = Date.now() - lastActiveAtRef.current;
        if (elapsed >= IDLE_TIMEOUT_MS) {
          void logoutRef.current();
        } else if (elapsed >= IDLE_TIMEOUT_MS - WARNING_DURATION_MS) {
          setShowIdleWarning(true);
          scheduleIdleTimers();
        } else {
          scheduleIdleTimers();
        }
      }
    });
    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, scheduleIdleTimers]);

  const refreshSavedJobs = useCallback(async () => {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setSavedJobs([]);
      return;
    }

    try {
      const result = await apiRequest(`${API_URL}/saved-jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load saved jobs.');
      if (!result.ok) {
        throw new Error(result.message || 'Failed to load saved jobs.');
      }

      const items = asList<any>(result.raw, ['savedJobs'])
        .map((record) => normalizeSavedJob(record))
        .filter((item): item is SavedJobItem => Boolean(item));
      setSavedJobs(items);
      await AsyncStorage.setItem(SAVED_JOBS_CACHE_KEY, JSON.stringify(items));
    } catch (error) {
      const cached = await readSavedJobsCache();
      setSavedJobs(cached);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setWorkerNotifications([]);
      setEmployerNotifications([]);
      setWorkerNotificationUnreadCount(0);
      setEmployerNotificationUnreadCount(0);
      return;
    }

    try {
      const modes: ViewMode[] = canAccessEmployer ? ['worker', 'employer'] : [viewMode];
      const results = await Promise.all(modes.map(async (mode) => {
        const result = await apiRequest(`${API_URL}/notifications?mode=${mode}&limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load notifications.');
        if (!result.ok) throw new Error(result.message || 'Failed to load notifications.');
        const payload = asObject<any>(result.raw) || {};
        return { mode, items: asList<any>(payload, ['notifications']), unreadCount: Math.max(0, Number(payload.unreadCount || 0)) };
      }));
      results.forEach(({ mode, items, unreadCount }) => {
        if (mode === 'employer') {
          setEmployerNotifications(items);
          setEmployerNotificationUnreadCount(unreadCount);
        } else {
          setWorkerNotifications(items);
          setWorkerNotificationUnreadCount(unreadCount);
        }
      });
    } catch (error) {
      console.warn('Failed to refresh notifications', error);
    }
  }, [canAccessEmployer, viewMode]);

  const refreshUnreadMessages = useCallback(async () => {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setUnreadMessageCount(0);
      return;
    }
    try {
      const result = await apiRequest(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load unread messages.');
      if (!result.ok) throw new Error(result.message || 'Failed to load unread messages.');
      const conversations = asList<any>(result.raw, ['conversations']);
      const nextCount = conversations.reduce((total, conversation) => {
        const unread = Number(conversation?.unreadCount || conversation?.unread || 0);
        return total + (Number.isFinite(unread) && unread > 0 ? unread : 0);
      }, 0);
      setUnreadMessageCount(nextCount);
    } catch (error) {
      console.warn('Failed to refresh unread messages', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setUser(null);
      setNavigationProfileInitials('U');
      setUserRole(null);
      currentUserIdRef.current = null;
      setIsAuthenticated(false);
      return false;
    }

    try {
      const result = await apiRequest(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load profile.');
      if (!result.ok) {
        if (classifyApiFailure(result) === 'unreachable' || classifyApiFailure(result) === 'server') {
          throw Object.assign(new Error(result.message || 'Failed to load profile.'), { preserveSession: true });
        }
        throw new Error(result.message || 'Failed to load profile.');
      }

      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      const profile = payload?.user || payload?.profile || payload;
      const role = normalizeRole(profile?.role || payload?.role) || 'worker';
      const accountOptions = normalizeAccountOptions(profile?.accountOptions || []);
      const normalizedOptions = accountOptions.length > 0 ? accountOptions : role === 'both' ? ['worker', 'employer'] : role === 'employer' ? ['employer'] : ['worker'];
      const storedViewMode = (await AsyncStorage.getItem(ACTIVE_VIEW_MODE_KEY)) as ViewMode | null;
      const nextViewMode: ViewMode = role === 'employer'
        ? 'employer'
        : role === 'both' && storedViewMode === 'employer'
          ? 'employer'
          : 'worker';

      const nextUser = { ...profile, accountOptions: normalizedOptions };
      const nextUserId = String(nextUser?._id || nextUser?.id || '').trim();
      if (!nextUserId) {
        throw new Error('Authenticated profile is missing its user ID.');
      }

      const currentToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (currentToken !== token) {
        return false;
      }

      const authenticatedUserId = currentUserIdRef.current;
      if (authenticatedUserId && authenticatedUserId !== nextUserId) {
        throw Object.assign(new Error('Profile response does not match the authenticated user.'), {
          preserveSession: true,
        });
      }

      if (!authenticatedUserId) {
        setNavigationProfileInitials(getUserInitials(nextUser));
      }
      currentUserIdRef.current = nextUserId;
      setUser(nextUser);
      setUserRole(role);
      setViewMode(nextViewMode);
      setIsAuthenticated(true);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
      await AsyncStorage.setItem(ACTIVE_VIEW_MODE_KEY, nextViewMode);
      return true;
    } catch (error: any) {
      if (error?.preserveSession) return false;
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, AUTH_USER_KEY]);
      setUser(null);
      setNavigationProfileInitials('U');
      setUserRole(null);
      currentUserIdRef.current = null;
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    socketFailureCountRef.current = 0;
    socketErrorLogRef.current = { message: '', at: 0 };
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const [onboardedFlag] = await Promise.all([
        AsyncStorage.getItem(HAS_ONBOARDED_KEY),
      ]);
      setHasOnboarded(onboardedFlag === 'true');

      const cachedSavedJobs = await readSavedJobsCache();
      if (cachedSavedJobs.length > 0) {
        setSavedJobs(cachedSavedJobs);
      }

      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const health = await apiRequest<any>(`${API_URL}/health`, undefined, 'Unable to reach the MicroJobs API.');
      if (!health.ok) {
        const kind = classifyApiFailure(health) === 'server' ? 'server' : 'unreachable';
        setBootstrapIssue({
          kind,
          title: kind === 'server' ? 'MicroJobs server is unavailable' : 'Cannot connect to MicroJobs',
          message: kind === 'server'
            ? 'The API responded but could not complete startup. Your saved session and data were not removed.'
            : 'Expo Go cannot reach the same API used by the web app. Check that both devices are on the same network and the API is running.',
          apiUrl: API_DIAGNOSTICS.apiUrl,
        });
        setIsReady(true);
        return;
      }
      const healthPayload = asObject<any>(health.raw) || {};
      const actualIdentity = `${healthPayload.environment || 'unknown'}:${healthPayload.databaseId || 'unknown'}`;
      setApiIdentity({ environmentId: healthPayload.environment, databaseId: healthPayload.databaseId, revision: healthPayload.revision });
      const expectedIdentity = await AsyncStorage.getItem(API_IDENTITY_KEY);
      if (token && expectedIdentity && expectedIdentity !== actualIdentity) {
        setBootstrapIssue({
          kind: 'environment-mismatch',
          title: 'Different MicroJobs database detected',
          message: 'This Expo session points to a different server/database than the one previously used. Sign in again only after confirming the API address.',
          apiUrl: API_DIAGNOSTICS.apiUrl,
          expectedEnvironment: expectedIdentity,
          actualEnvironment: actualIdentity,
        });
        setIsReady(true);
        return;
      }

      const authenticated = await refreshProfile();
      if (token && !authenticated && (await AsyncStorage.getItem(AUTH_TOKEN_KEY))) {
        setBootstrapIssue({
          kind: 'server',
          title: 'Unable to verify your session',
          message: 'The server was reached, but your saved session could not be verified. Your local session was preserved so you can retry.',
          apiUrl: API_DIAGNOSTICS.apiUrl,
        });
        setIsReady(true);
        return;
      }
      if (authenticated) await AsyncStorage.setItem(API_IDENTITY_KEY, actualIdentity);
      setBootstrapIssue(null);
      setIsReady(true);

      if (token) {
        void refreshSavedJobs();
        void refreshNotifications();
        void refreshUnreadMessages();
      }
    } catch (error) {
      console.warn('Session bootstrap failed', error);
      setIsReady(true);
    }
  }, [refreshNotifications, refreshProfile, refreshSavedJobs, refreshUnreadMessages]);

  const retryBootstrap = useCallback(async () => {
    setIsReady(false);
    setBootstrapIssue(null);
    await loadSession();
  }, [loadSession]);

  const resetSessionForCurrentApi = useCallback(async () => {
    disconnectSocket();
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, AUTH_USER_KEY, ACTIVE_VIEW_MODE_KEY, API_IDENTITY_KEY]);
    currentUserIdRef.current = null;
    setUser(null);
    setNavigationProfileInitials('U');
    setUserRole(null);
    setViewMode('worker');
    setSavedJobs([]);
    setWorkerNotifications([]);
    setEmployerNotifications([]);
    setWorkerNotificationUnreadCount(0);
    setEmployerNotificationUnreadCount(0);
    setMessageEvents([]);
    setUnreadMessageCount(0);
    setIsAuthenticated(false);
    setBootstrapIssue(null);
    setIsReady(true);
  }, [disconnectSocket]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!bootstrapIssue || !['unreachable', 'server'].includes(bootstrapIssue.kind)) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void retryBootstrap();
    });
    return () => subscription.remove();
  }, [bootstrapIssue, retryBootstrap]);

  useEffect(() => {
    setInvalidSessionHandler((result) => {
      if (result.status !== 401 || !isAuthenticated || loggingOutRef.current) return;
      void logoutRef.current();
    });
    return () => setInvalidSessionHandler(null);
  }, [isAuthenticated]);

  useEffect(() => subscribeDataRefresh((event) => {
    if (!isAuthenticated) return;
    // Authentication transitions have explicit ordered bootstrap/logout flows.
    // Refreshing /auth/me from a login/logout mutation can race local cleanup
    // and restore a session that the user just ended.
    if (event.domains.includes('profile')) void refreshProfile();
    if (event.domains.includes('savedJobs') || event.domains.includes('jobs')) void refreshSavedJobs();
    if (event.domains.includes('notifications') || event.domains.includes('applications') || event.domains.includes('wallet')) void refreshNotifications();
    if (event.domains.includes('messages')) void refreshUnreadMessages();
  }), [isAuthenticated, refreshNotifications, refreshProfile, refreshSavedJobs, refreshUnreadMessages]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearIdleTimers();
      setShowIdleWarning(false);
      return;
    }
    // Do not inherit idle time accrued before a user signed in.
    lastActiveAtRef.current = Date.now();
    scheduleIdleTimers();
    return () => {
      clearIdleTimers();
    };
  }, [clearIdleTimers, isAuthenticated, scheduleIdleTimers]);

  useEffect(() => {
    const originalFetch = globalThis.fetch;
    const trackedFetch: typeof globalThis.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      registerActivity();
      return originalFetch(input, init);
    };
    globalThis.fetch = trackedFetch;

    return () => {
      globalThis.fetch = originalFetch;
    };
  }, [registerActivity]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserIdRef.current) {
      disconnectSocket();
      return;
    }

    const tokenPromise = AsyncStorage.getItem(AUTH_TOKEN_KEY);

    void tokenPromise.then((token) => {
      if (!token || !currentUserIdRef.current) {
        disconnectSocket();
        return;
      }

      const socket = io(SOCKET_URL, {
        path: SOCKET_PATH,
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 10000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socketFailureCountRef.current = 0;
        socketErrorLogRef.current = { message: '', at: 0 };
        socket.emit('register', String(currentUserIdRef.current));
        void refreshUnreadMessages();
        void refreshNotifications();
      });

      socket.on('connect_error', (err: any) => {
        const message = String(err?.message || err || 'unknown');
        const now = Date.now();
        const shouldLog = socketErrorLogRef.current.message !== message || now - socketErrorLogRef.current.at > 15000;
        if (shouldLog) {
          console.warn(`socket connect_error (${SOCKET_URL})`, message);
          socketErrorLogRef.current = { message, at: now };
        }
        socketFailureCountRef.current += 1;
        if (socketFailureCountRef.current >= 3) {
          disconnectSocket();
        }
      });

      socket.io.on('reconnect_failed', () => {
        disconnectSocket();
      });

      socket.on('new_application', () => {
        void refreshNotifications();
      });

      socket.on('application_status_updated', () => {
        void refreshNotifications();
      });

      socket.on('notification_created', (payload: any) => {
        const notification = payload?.notification || payload;
        const nextId = getNotificationItemId(notification);
        if (!notification || !nextId) return;
        const append = (prev: any[]) => {
          if (prev.some((item) => getNotificationItemId(item) === nextId)) {
            return prev;
          }
          return [notification, ...prev];
        };
        const audience = String(notification?.audience || 'shared').toLowerCase();
        if (audience === 'worker' || audience === 'shared') {
          setWorkerNotifications(append);
          if (!notification.readAt) setWorkerNotificationUnreadCount((count) => count + 1);
        }
        if (audience === 'employer' || audience === 'shared') {
          setEmployerNotifications(append);
          if (!notification.readAt) setEmployerNotificationUnreadCount((count) => count + 1);
        }
        // If this notification is about a payment/payout, refresh profile to update balances
        try {
          const nType = String(notification?.type || '').toLowerCase();
          const hasTx = Boolean(notification?.socketPayload?.transactionId || notification?.transactionId || notification?.payload?.transactionId);
          if (nType === 'payment' || nType === 'payout' || hasTx) {
            void refreshProfile();
            void refreshNotifications();
          }
        } catch (e) {}
      });

      socket.on('notification_changed', () => {
        void refreshNotifications();
      });

      socket.on('new_message', (payload: any) => {
        setMessageEvents((prev) => [payload, ...prev]);
        setUnreadMessageCount((prev) => prev + 1);
      });

      socket.on('new_message_echo', (payload: any) => {
        setMessageEvents((prev) => [payload, ...prev]);
      });
    });

    return disconnectSocket;
  }, [disconnectSocket, isAuthenticated, refreshNotifications, refreshProfile, refreshUnreadMessages]);

  const handleAuthSuccess = useCallback(async () => {
    await AsyncStorage.setItem(HAS_ONBOARDED_KEY, 'true');
    setHasOnboarded(true);
    const authenticated = await refreshProfile();
    if (!authenticated) return;
    await refreshSavedJobs();
    await refreshNotifications();
    await refreshUnreadMessages();
    setMessageEvents([]);
  }, [refreshNotifications, refreshProfile, refreshSavedJobs, refreshUnreadMessages]);

  useEffect(() => {
    if (!isAuthenticated || !isReady) return;
    let active = true;
    void registerPushDevice().catch((error) => {
      console.warn('Push registration unavailable:', error?.name || 'registration_error');
    });
    void takeInitialNotificationData().then((data) => {
      if (active && data) setPendingNotificationData(data);
    });
    let unsubscribe: () => void = () => undefined;
    void subscribeNotificationResponses(
      (data) => { if (active) setPendingNotificationData(data); },
      () => { if (active) void refreshNotifications(); },
    ).then((nextUnsubscribe) => {
      if (active) unsubscribe = nextUnsubscribe;
      else nextUnsubscribe();
    });
    return () => { active = false; unsubscribe(); };
  }, [isAuthenticated, isReady, refreshNotifications]);

  const logout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setShowLogoutModal(false);
    switchingViewModeRef.current = false;
    setIsSwitchingViewMode(false);
    try {
      await unregisterPushDevice();
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        await apiRequest(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to logout.');
      }
    } catch {
      // local logout still proceeds
    }

    disconnectSocket();
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, AUTH_USER_KEY, ACTIVE_VIEW_MODE_KEY]);
    currentUserIdRef.current = null;
    setUser(null);
    setNavigationProfileInitials('U');
    setUserRole(null);
    setViewMode('worker');
    setSavedJobs([]);
    setWorkerNotifications([]);
    setEmployerNotifications([]);
    setWorkerNotificationUnreadCount(0);
    setEmployerNotificationUnreadCount(0);
    setPendingNotificationData(null);
    setMessageEvents([]);
    setUnreadMessageCount(0);
    setInitialWorkerChatTarget(null);
    setInitialEmployerChatTarget(null);
    setIsAuthenticated(false);
    loggingOutRef.current = false;
  }, [disconnectSocket]);
  logoutRef.current = logout;

  const switchViewMode = useCallback(async (nextView: ViewMode) => {
    if (nextView === viewMode) return true;
    if (switchingViewModeRef.current) return false;
    if (!canSwitchAccountMode) {
      toast.info('Only Both accounts can switch account modes.');
      return false;
    }
    switchingViewModeRef.current = true;
    setIsSwitchingViewMode(true);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const result = await apiRequest(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Unable to verify your account mode.');
      if (!result.ok) throw new Error(result.message || 'Unable to verify your account mode.');
      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      const profile = payload?.user || payload?.profile || payload;
      if (normalizeRole(profile?.role || payload?.role) !== 'both') {
        throw new Error('Only Both accounts can switch account modes.');
      }
      await AsyncStorage.setItem(ACTIVE_VIEW_MODE_KEY, nextView);
      setViewMode(nextView);
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'Unable to switch account mode.');
      return false;
    } finally {
      switchingViewModeRef.current = false;
      setIsSwitchingViewMode(false);
    }
  }, [canSwitchAccountMode, toast, viewMode]);

  const toggleSavedJob = useCallback(async (job: any) => {
    const normalized = normalizeSavedJob(job);
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!normalized?._id || !token) return;

    const exists = savedJobs.some((item) => item._id === normalized._id);
    if (exists) {
      await apiRequest(`${API_URL}/saved-jobs/${normalized._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to remove saved job.');
      const nextSavedJobs = savedJobs.filter((item) => item._id !== normalized._id);
      setSavedJobs(nextSavedJobs);
      await AsyncStorage.setItem(SAVED_JOBS_CACHE_KEY, JSON.stringify(nextSavedJobs));
      return;
    }

    const result = await apiRequest(`${API_URL}/saved-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jobId: normalized._id }),
    }, 'Failed to save job.');

    if (!result.ok) {
      throw new Error(result.message || 'Failed to save job.');
    }

    await refreshSavedJobs();
  }, [refreshSavedJobs, savedJobs]);

  const removeSavedJob = useCallback(async (jobId: string) => {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;
    await apiRequest(`${API_URL}/saved-jobs/${jobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }, 'Failed to remove saved job.');
    const nextSavedJobs = savedJobs.filter((item) => item._id !== jobId);
    setSavedJobs(nextSavedJobs);
    await AsyncStorage.setItem(SAVED_JOBS_CACHE_KEY, JSON.stringify(nextSavedJobs));
  }, [savedJobs]);

  const dismissWorkerNotification = useCallback((notificationId: string) => {
    const target = String(notificationId || '');
    if (!target) return;
    const remove = (prev: any[]) => prev.filter((item) => getNotificationItemId(item) !== target);
    setWorkerNotifications((prev) => {
      const removed = prev.find((item) => getNotificationItemId(item) === target);
      if (removed && !removed.readAt) setWorkerNotificationUnreadCount((count) => Math.max(0, count - 1));
      return remove(prev);
    });
  }, []);

  const value = useMemo<AppSessionContextValue>(() => ({
    isReady,
    isAuthenticated,
    hasOnboarded,
    user,
    navigationProfileInitials,
    userRole,
    viewMode,
    canAccessEmployer,
    canSwitchAccountMode,
    isSwitchingViewMode,
    bootstrapIssue,
    apiDiagnostics: { ...API_DIAGNOSTICS, ...apiIdentity },
    savedJobs,
    savedJobIds,
    workerNotifications,
    employerNotifications,
    workerNotificationUnreadCount,
    employerNotificationUnreadCount,
    pendingNotificationData,
    messageEvents,
    unreadMessageCount,
    initialWorkerChatTarget,
    initialEmployerChatTarget,
    showIdleWarning,
    showLogoutModal,
    markOnboarded: async () => {
      await AsyncStorage.setItem(HAS_ONBOARDED_KEY, 'true');
      setHasOnboarded(true);
    },
    registerActivity,
    dismissIdleWarning: () => registerActivity(true),
    openLogoutConfirm: () => setShowLogoutModal(true),
    closeLogoutConfirm: () => setShowLogoutModal(false),
    handleAuthSuccess,
    logout,
    switchViewMode,
    setInitialWorkerChatTarget,
    clearInitialWorkerChatTarget: () => setInitialWorkerChatTarget(null),
    setInitialEmployerChatTarget,
    clearInitialEmployerChatTarget: () => setInitialEmployerChatTarget(null),
    dismissWorkerNotification,
    consumePendingNotification: () => setPendingNotificationData(null),
    toggleSavedJob,
    removeSavedJob,
    refreshSavedJobs,
    refreshNotifications,
    refreshUnreadMessages,
    refreshProfile,
    retryBootstrap,
    resetSessionForCurrentApi,
  }), [
    canAccessEmployer,
    canSwitchAccountMode,
    apiIdentity,
    bootstrapIssue,
    isSwitchingViewMode,
    dismissWorkerNotification,
    handleAuthSuccess,
    hasOnboarded,
    initialEmployerChatTarget,
    initialWorkerChatTarget,
    isAuthenticated,
    isReady,
    logout,
    messageEvents,
    navigationProfileInitials,
    refreshProfile,
    refreshSavedJobs,
    refreshNotifications,
    refreshUnreadMessages,
    retryBootstrap,
    resetSessionForCurrentApi,
    registerActivity,
    savedJobIds,
    savedJobs,
    showIdleWarning,
    showLogoutModal,
    switchViewMode,
    toggleSavedJob,
    unreadMessageCount,
    user,
    userRole,
    viewMode,
    workerNotifications,
    employerNotifications,
    workerNotificationUnreadCount,
    employerNotificationUnreadCount,
    pendingNotificationData,
    removeSavedJob,
  ]);

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) {
    throw new Error('useAppSession must be used within an AppSessionProvider');
  }
  return context;
}
