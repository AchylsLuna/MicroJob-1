import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';
import { apiRequest, asList, asObject } from '../lib/api';
import { useToast } from './ToastContext';

type ViewMode = 'worker' | 'employer';
type ChatTarget = { id: string; name?: string } | null;
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
  userRole: string | null;
  viewMode: ViewMode;
  canAccessEmployer: boolean;
  savedJobs: SavedJobItem[];
  savedJobIds: string[];
  workerNotifications: any[];
  employerNotifications: any[];
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
  switchViewMode: (nextView: ViewMode) => Promise<void>;
  setInitialWorkerChatTarget: (target: ChatTarget) => void;
  clearInitialWorkerChatTarget: () => void;
  setInitialEmployerChatTarget: (target: ChatTarget) => void;
  clearInitialEmployerChatTarget: () => void;
  markMessagesViewed: () => void;
  dismissWorkerNotification: (notificationId: string) => void;
  toggleSavedJob: (job: any) => Promise<void>;
  removeSavedJob: (jobId: string) => Promise<void>;
  refreshSavedJobs: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AppSessionContext = createContext<AppSessionContextValue | undefined>(undefined);

const HAS_ONBOARDED_KEY = 'has_onboarded';
const ACTIVE_VIEW_MODE_KEY = 'active_view_mode';
const SAVED_JOBS_CACHE_KEY = 'saved_jobs_server_cache';
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_DURATION_MS = 10 * 1000;

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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('worker');
  const [savedJobs, setSavedJobs] = useState<SavedJobItem[]>([]);
  const [workerNotifications, setWorkerNotifications] = useState<any[]>([]);
  const [employerNotifications, setEmployerNotifications] = useState<any[]>([]);
  const [messageEvents, setMessageEvents] = useState<any[]>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [initialWorkerChatTarget, setInitialWorkerChatTarget] = useState<ChatTarget>(null);
  const [initialEmployerChatTarget, setInitialEmployerChatTarget] = useState<ChatTarget>(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const socketRef = useRef<any>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketFailureCountRef = useRef(0);
  const socketErrorLogRef = useRef({ message: '', at: 0 });
  const currentUserIdRef = useRef<string | null>(null);

  const canAccessEmployer = useMemo(() => {
    const role = normalizeRole(userRole);
    const options = normalizeAccountOptions(user?.accountOptions || []);
    return role === 'employer' || role === 'both' || options.includes('employer');
  }, [user, userRole]);

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
    warningTimerRef.current = setTimeout(() => setShowIdleWarning(true), Math.max(IDLE_TIMEOUT_MS - WARNING_DURATION_MS, 0));
    logoutTimerRef.current = setTimeout(() => {
      void logout();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimers, isAuthenticated]);

  const registerActivity = useCallback((force = false) => {
    if (!isAuthenticated) return;
    if (showIdleWarning && !force) return;
    setShowIdleWarning(false);
    scheduleIdleTimers();
  }, [isAuthenticated, scheduleIdleTimers, showIdleWarning]);

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
      return;
    }

    try {
      const result = await apiRequest(`${API_URL}/notifications?unread=true&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load notifications.');
      if (!result.ok) {
        throw new Error(result.message || 'Failed to load notifications.');
      }

      const items = Array.isArray(result.raw) ? result.raw : asList<any>(result.raw, ['notifications']);
      setWorkerNotifications(items);
      setEmployerNotifications(items);
    } catch (error) {
      console.warn('Failed to refresh notifications', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      return;
    }

    try {
      const result = await apiRequest(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load profile.');
      if (!result.ok) {
        throw new Error(result.message || 'Failed to load profile.');
      }

      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      const profile = payload?.user || payload?.profile || payload;
      const role = normalizeRole(profile?.role || payload?.role) || 'worker';
      const accountOptions = normalizeAccountOptions(profile?.accountOptions || []);
      const normalizedOptions = accountOptions.length > 0 ? accountOptions : role === 'both' ? ['worker', 'employer'] : role === 'employer' ? ['employer'] : ['worker'];
      const storedViewMode = (await AsyncStorage.getItem(ACTIVE_VIEW_MODE_KEY)) as ViewMode | null;
      const nextViewMode = storedViewMode && normalizedOptions.includes(storedViewMode)
        ? storedViewMode
        : normalizedOptions.includes('worker')
          ? 'worker'
          : 'employer';

      const nextUser = { ...profile, accountOptions: normalizedOptions };
      currentUserIdRef.current = String(nextUser?._id || nextUser?.id || '');
      setUser(nextUser);
      setUserRole(role);
      setViewMode(nextViewMode);
      setIsAuthenticated(true);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
      await AsyncStorage.setItem(ACTIVE_VIEW_MODE_KEY, nextViewMode);
    } catch (error) {
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
      setUser(null);
      setUserRole(null);
      currentUserIdRef.current = null;
      setIsAuthenticated(false);
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

      await refreshProfile();
      setIsReady(true);

      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        void refreshSavedJobs();
        void refreshNotifications();
      }
    } catch (error) {
      console.warn('Session bootstrap failed', error);
      setIsReady(true);
    }
  }, [refreshNotifications, refreshProfile, refreshSavedJobs]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    scheduleIdleTimers();
    return () => {
      clearIdleTimers();
    };
  }, [clearIdleTimers, scheduleIdleTimers]);

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

      socket.on('new_application', (payload: any) => {
        const nextId = getNotificationItemId(payload);
        const append = (prev: any[]) => {
          if (!nextId || prev.some((item) => getNotificationItemId(item) === nextId)) {
            return prev;
          }
          return [payload, ...prev];
        };
        setWorkerNotifications(append);
        setEmployerNotifications(append);
      });

      socket.on('application_status_updated', (payload: any) => {
        const nextId = getNotificationItemId(payload);
        const append = (prev: any[]) => {
          if (!nextId || prev.some((item) => getNotificationItemId(item) === nextId)) {
            return prev;
          }
          return [payload, ...prev];
        };
        setWorkerNotifications(append);
        setEmployerNotifications(append);
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
        setWorkerNotifications(append);
        setEmployerNotifications(append);
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

      socket.on('new_message', (payload: any) => {
        setMessageEvents((prev) => [payload, ...prev]);
        setUnreadMessageCount((prev) => prev + 1);
      });

      socket.on('new_message_echo', (payload: any) => {
        setMessageEvents((prev) => [payload, ...prev]);
      });
    });

    return disconnectSocket;
  }, [disconnectSocket, isAuthenticated]);

  const handleAuthSuccess = useCallback(async () => {
    await AsyncStorage.setItem(HAS_ONBOARDED_KEY, 'true');
    setHasOnboarded(true);
    await refreshProfile();
    await refreshSavedJobs();
    await refreshNotifications();
    setMessageEvents([]);
    setUnreadMessageCount(0);
  }, [refreshNotifications, refreshProfile, refreshSavedJobs]);

  const logout = useCallback(async () => {
    setShowLogoutModal(false);
    try {
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
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY, ACTIVE_VIEW_MODE_KEY]);
    currentUserIdRef.current = null;
    setUser(null);
    setUserRole(null);
    setViewMode('worker');
    setSavedJobs([]);
    setWorkerNotifications([]);
    setEmployerNotifications([]);
    setMessageEvents([]);
    setUnreadMessageCount(0);
    setInitialWorkerChatTarget(null);
    setInitialEmployerChatTarget(null);
    setIsAuthenticated(false);
  }, [disconnectSocket]);

  const switchViewMode = useCallback(async (nextView: ViewMode) => {
    if (nextView === 'employer' && !canAccessEmployer) {
      toast.info('This account does not have employer access.');
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Switch role',
        `Switch to ${nextView === 'employer' ? 'Employer' : 'Worker'} mode?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Switch', onPress: () => resolve(true) },
        ],
      );
    });
    if (!confirmed) return;
    setViewMode(nextView);
    await AsyncStorage.setItem(ACTIVE_VIEW_MODE_KEY, nextView);
  }, [canAccessEmployer, toast]);

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
    setWorkerNotifications(remove);
    setEmployerNotifications(remove);
  }, []);

  const value = useMemo<AppSessionContextValue>(() => ({
    isReady,
    isAuthenticated,
    hasOnboarded,
    user,
    userRole,
    viewMode,
    canAccessEmployer,
    savedJobs,
    savedJobIds,
    workerNotifications,
    employerNotifications,
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
    markMessagesViewed: () => setUnreadMessageCount(0),
    dismissWorkerNotification,
    toggleSavedJob,
    removeSavedJob,
    refreshSavedJobs,
    refreshNotifications,
    refreshProfile,
  }), [
    canAccessEmployer,
    dismissWorkerNotification,
    handleAuthSuccess,
    hasOnboarded,
    initialEmployerChatTarget,
    initialWorkerChatTarget,
    isAuthenticated,
    isReady,
    logout,
    messageEvents,
    refreshProfile,
    refreshSavedJobs,
    refreshNotifications,
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
