import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Animated, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import "./global.css";
import { API_URL, SOCKET_URL } from './config';
import { apiRequest, asObject } from './lib/api';
import { tokens } from './theme/tokens';
import Screen1 from './pages/Screen1';
import Screen2 from './pages/Screen2';
import Screen3 from './pages/Screen3';
import Screen4 from './pages/Screen4';
import SignUp from './pages/signUp';
import SignIn from './pages/signIn';
import SignSuccess from './pages/signSuccess';
import ForgotPass from './pages/forgotPass';
import VerifyEmail from './pages/verifyEmail';
import PassChanged from './pages/passChanged';
import CreatePass from './pages/createPass';
import Dashboard from './pages/pages1/dashboard';
import Jobs from './pages/pages1/Jobs';
import JobDetails from './pages/pages1/JobDetails';
import SavedJobs from './pages/pages1/SavedJobs';
import AppliedJobs from './pages/pages1/AppliedJobs';
import Profile from './pages/pages1/Profile';
import NotificationsInbox from './pages/pages1/NotificationsInbox';
import WorkerInbox from './pages/pages1/WorkerInbox';
import EWallet from './pages/pages1/EWallet';
import Settings from './pages/pages1/Settings';
import LocationServices from './pages/pages1/LocationServices';
import MFA from './pages/pages1/MFA';
import About from './pages/pages1/About';
import DeleteAccount from './pages/pages1/DeleteAccount';
import ChangePassword from './pages/pages1/ChangePassword';
import ContactSupport from './pages/pages1/ContactSupport';
import EmployerJobPosts from './pages/employer/EmployerJobPosts';
import EmployerPostJob from './pages/employer/EmployerPostJob';
import EmployerApplications from './pages/employer/EmployerApplications';
import EmployerProfile from './pages/employer/EmployerProfile';
import EmployerEWallet from './pages/employer/EmployerEWallet';
import EmployerNotifications from './pages/employer/EmployerNotifications';
import EmployerInbox from './pages/employer/EmployerInbox';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [activeTab, setActiveTab] = useState('Home');
  const [activeEmployerTab, setActiveEmployerTab] = useState('Home');
  const [isReady, setIsReady] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const [selectedEmployerJob, setSelectedEmployerJob] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [viewMode, setViewMode] = useState('worker');
  const [explicitEmployerView, setExplicitEmployerView] = useState(false);
  const [settingsFromEmployer, setSettingsFromEmployer] = useState(false);
  const socketRef = useRef(null);
  const [workerNotifications, setWorkerNotifications] = useState([]);
  const [employerNotifications, setEmployerNotifications] = useState([]);
  const [messageEvents, setMessageEvents] = useState([]);
  const [workerUnreadMessageCount, setWorkerUnreadMessageCount] = useState(0);
  const [workerInboxInitialChatTarget, setWorkerInboxInitialChatTarget] = useState(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const transition = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const currentScreenRef = useRef(currentScreen);
  const socketErrorLogRef = useRef({ message: '', at: 0 });
  const socketFailureCountRef = useRef(0);

  const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
  const WARNING_DURATION_MS = 10 * 1000;

  // Toggle for testing onboarding screens
  const FORCE_ONBOARDING = false;

  const SCREEN = {
    Screen1: 0,
    Screen2: 1,
    Screen3: 2,
    Screen4: 3,
    SignUp: 4,
    SignIn: 5,
    SignSuccess: 6,
    ForgotPass: 7,
    VerifyEmail: 8,
    CreatePass: 9,
    PassChanged: 10,
    Dashboard: 11,
    Jobs: 12,
    EWallet: 13,
    JobDetails: 14,
    Saved: 15,
    Applied: 16,
    Messages: 17, // WorkerInbox
    Notifications: 18, // NotificationsInbox
    Profile: 19,
    Settings: 20,
    EmployerJobPosts: 21,
    EmployerPostJob: 22,
    EmployerApplications: 23,
    EmployerProfile: 24,
    EmployerNotifications: 25,
    EmployerMessages: 26, // EmployerInbox / EmployerMessages
    EmployerEWallet: 27,
    SettingsLocationServices: 28,
    SettingsMfa: 29,
    SettingsAbout: 30,
    SettingsDeleteAccount: 31,
    SettingsChangePassword: 32,
    SettingsSupport: 33,
  };

  const isSessionActive = currentScreen >= SCREEN.Dashboard;
  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  const normalizeRole = useCallback((role) => {
    if (!role) return null;
    if (role === 'hire') return 'employer';
    if (role === 'work') return 'worker';
    return role;
  }, []);
  // Treat 'both' as neutral: don't auto-switch to employer unless explicitly employer-only
  const isEmployerRole = userRole === 'employer' || userRole === 'hire';

  const fetchUserRole = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return null;
      const result = await apiRequest(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load profile.');

      if (result.ok) {
        const payload = asObject(result.raw) || {};
        const dataPayload = asObject(result.data) || {};
        const profile = dataPayload?.user || payload?.user || dataPayload?.profile || payload?.profile || dataPayload;
        const role = profile?.role || payload?.role || payload?.user?.role;
        if (profile) {
          await AsyncStorage.setItem('auth_user', JSON.stringify(profile));
        }
        return normalizeRole(role || null);
      }
    } catch (error) {
      console.log('Failed to fetch user role', error);
    }

    try {
      const storedUser = await AsyncStorage.getItem('auth_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        return normalizeRole(parsed?.role || null);
      }
    } catch (error) {
      console.log('Failed to load stored user role', error);
    }

    return null;
  }, [normalizeRole]);

  // Initialize socket only during authenticated sessions.
  useEffect(() => {
    const disconnectSocket = () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      socketFailureCountRef.current = 0;
      socketErrorLogRef.current = { message: '', at: 0 };
    };

    const initSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (!token || !storedUser) {
          disconnectSocket();
          return;
        }
        const parsed = JSON.parse(storedUser);
        const userId = parsed?._id || parsed?.id || parsed?.userId;
        if (!userId) {
          disconnectSocket();
          return;
        }

        // avoid duplicate socket instances
        if (socketRef.current) {
          if (socketRef.current.connected || socketRef.current.active) return;
          disconnectSocket();
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
          console.log('socket connected', socket.id);
          socketFailureCountRef.current = 0;
          socketErrorLogRef.current = { message: '', at: 0 };
          socket.emit('register', String(userId));
        });
        socket.on('connect_error', (err) => {
          // Throttle noisy transport errors so the terminal is readable.
          const message = String(err?.message || err || 'unknown');
          const now = Date.now();
          const shouldLog =
            socketErrorLogRef.current.message !== message ||
            now - socketErrorLogRef.current.at > 15000;

          if (shouldLog) {
            console.warn(`socket connect_error (${SOCKET_URL})`, message);
            socketErrorLogRef.current = { message, at: now };
          }

          socketFailureCountRef.current += 1;
          if (socketFailureCountRef.current >= 3) {
            console.warn('socket disabled after repeated connection failures');
            disconnectSocket();
          }
        });
        socket.io.on('reconnect_failed', () => {
          console.warn('socket reconnect_failed');
          disconnectSocket();
        });

        socket.on('new_application', (payload) => {
          console.log('received new_application', payload);
          // employer receives when a worker applies
          setEmployerNotifications((prev) => {
            const nextId = String(payload?.id || payload?._id || `${payload?.jobId || ''}-${payload?.createdAt || ''}`);
            const exists = prev.some((item) => String(item?.id || item?._id || `${item?.jobId || ''}-${item?.createdAt || ''}`) === nextId);
            if (exists) return prev;
            return [payload, ...prev];
          });
        });

        socket.on('application_status_updated', (payload) => {
          console.log('received application_status_updated', payload);
          // worker receives when employer updates status
          setWorkerNotifications((prev) => {
            const nextId = String(payload?.id || payload?.applicationId || `${payload?.jobId || ''}-${payload?.updatedAt || ''}`);
            const exists = prev.some((item) => String(item?.id || item?.applicationId || `${item?.jobId || ''}-${item?.updatedAt || ''}`) === nextId);
            if (exists) return prev;
            return [payload, ...prev];
          });
        });
        socket.on('new_message', (payload) => {
          console.log('received new_message', payload);
          setMessageEvents((prev) => [payload, ...prev]);
          const isViewingWorkerMessages = currentScreenRef.current === SCREEN.Messages;
          if (!isViewingWorkerMessages) {
            setWorkerUnreadMessageCount((prev) => prev + 1);
          }
        });

        socket.on('new_message_echo', (payload) => {
          console.log('received new_message_echo', payload);
          setMessageEvents((prev) => [payload, ...prev]);
        });
      } catch (error) {
        disconnectSocket();
      }
    };

    if (isReady && isSessionActive) {
      initSocket();
    } else {
      disconnectSocket();
    }

    return disconnectSocket;
  }, [isReady, isSessionActive]);

  const savedJobIds = useMemo(() => savedJobs.map((job) => job._id).filter(Boolean), [savedJobs]);

  const normalizeSavedJob = useCallback((job) => {
    if (!job) return null;
    const company = job.jobPoster?.firstName
      ? `${job.jobPoster.firstName} ${job.jobPoster.lastName || ''}`.trim()
      : job.company || 'Job Poster';

    return {
      _id: job._id || job.id,
      title: job.title || 'Untitled job',
      company,
      location: job.location || 'Unknown location',
      tags: Array.isArray(job.skills) ? job.skills : Array.isArray(job.tags) ? job.tags : [],
      salary: job.salary || '',
      jobType: job.jobType,
      jobPoster: job.jobPoster,
    };
  }, []);

  const handleToggleSaveJob = useCallback((job) => {
    const normalized = normalizeSavedJob(job);
    if (!normalized || !normalized._id) return;
    setSavedJobs((prev) => {
      const exists = prev.some((item) => item._id === normalized._id);
      if (exists) {
        return prev.filter((item) => item._id !== normalized._id);
      }
      return [...prev, normalized];
    });
  }, [normalizeSavedJob]);

  const handleRemoveSavedJob = useCallback((jobId) => {
    setSavedJobs((prev) => prev.filter((item) => item._id !== jobId));
  }, []);

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

  useEffect(() => {
    const init = async () => {
      try {
        if (FORCE_ONBOARDING) {
          setCurrentScreen(SCREEN.Screen1);
          return;
        }
        const token = await AsyncStorage.getItem('auth_token');
        const hasOnboarded = await AsyncStorage.getItem('has_onboarded');

        if (token) {
          setActiveTab('Home');
          const role = await fetchUserRole();
          setUserRole(role);
          if (role === 'employer') {
            setCurrentScreen(SCREEN.EmployerJobPosts);
          } else {
            setCurrentScreen(SCREEN.Dashboard);
          }
        } else if (hasOnboarded === 'true') {
          setCurrentScreen(SCREEN.SignIn);
        } else {
          setCurrentScreen(SCREEN.Screen1);
        }
      } finally {
        setIsReady(true);
      }
    };

    init();
  }, [fetchUserRole]);

  useEffect(() => {
    const loadSaved = async () => {
      try {
        const stored = await AsyncStorage.getItem('saved_jobs');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setSavedJobs(parsed);
          }
        }
      } catch (error) {
        console.log('Failed to load saved jobs', error);
      }
    };

    loadSaved();
  }, []);

  useEffect(() => {
    const persistSaved = async () => {
      try {
        await AsyncStorage.setItem('saved_jobs', JSON.stringify(savedJobs));
      } catch (error) {
        console.log('Failed to persist saved jobs', error);
      }
    };

    persistSaved();
  }, [savedJobs]);

  const transitionTo = (nextScreen) => {
    const isOnboarding = currentScreen <= SCREEN.Screen4;
    if (!isOnboarding) {
      setCurrentScreen(nextScreen);
      return;
    }

    Animated.timing(transition, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setCurrentScreen(nextScreen);
      transition.setValue(1);
      Animated.timing(transition, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    transitionTo(currentScreen + 1);
  };

  const handleGoToSignUp = () => {
    transitionTo(SCREEN.SignUp);
  };

  const handleGoToSignIn = () => {
    setCurrentScreen(SCREEN.SignIn);
  };

  const handleGoToSuccess = () => {
    setCurrentScreen(SCREEN.SignSuccess);
  };

  const handleGoToForgot = () => {
    setCurrentScreen(SCREEN.ForgotPass);
  };

  const handleGoToVerify = () => {
    setCurrentScreen(SCREEN.VerifyEmail);
  };

  const handleGoToCreatePass = () => {
    setCurrentScreen(SCREEN.CreatePass);
  };

  const handleGoToPassChanged = () => {
    setCurrentScreen(SCREEN.PassChanged);
  };

  const handleGoToDashboard = async () => {
    await AsyncStorage.setItem('has_onboarded', 'true');
    const role = await fetchUserRole();
    setUserRole(role);
    if (role === 'employer') {
      setActiveEmployerTab('Home');
      setCurrentScreen(SCREEN.EmployerJobPosts);
    } else {
      setActiveTab('Home');
      setViewMode('worker');
      setExplicitEmployerView(false);
      setCurrentScreen(SCREEN.Dashboard);
    }
  };

  const handleGoToWorkerDashboard = () => {
    setActiveTab('Home');
    setViewMode('worker');
    setExplicitEmployerView(false);
    setCurrentScreen(SCREEN.Dashboard);
  };

  const handleGoToEmployerPosts = () => {
    setActiveEmployerTab('Home');
    setCurrentScreen(SCREEN.EmployerJobPosts);
  };

  const handleGoToEmployerPostJob = (job) => {
    setActiveEmployerTab('Post Job');
    setSelectedEmployerJob(job || null);
    setCurrentScreen(SCREEN.EmployerPostJob);
  };

  const handleGoToEmployerApplications = () => {
    setActiveEmployerTab('Applications');
    setCurrentScreen(SCREEN.EmployerApplications);
  };

  const handleMessageWorker = (workerId, jobId) => {
    setSelectedWorkerId(workerId);
    setSelectedJobId(jobId);
    setCurrentScreen(SCREEN.EmployerMessages);
  };

  const handleMessageEmployer = ({ userId, userName, jobId }) => {
    if (!userId) {
      Alert.alert('Unable to open chat', 'Missing employer information.');
      return;
    }
    setSelectedJobId(jobId || null);
    setActiveTab('Messages');
    setViewMode('worker');
    setExplicitEmployerView(false);
    setWorkerUnreadMessageCount(0);
    setWorkerInboxInitialChatTarget({ id: String(userId), name: userName || 'Employer' });
    setCurrentScreen(SCREEN.Messages);
  };

  const handleGoToEmployerProfile = () => {
    setActiveEmployerTab('Profile');
    setCurrentScreen(SCREEN.EmployerProfile);
  };

  const handleGoToEmployerNotifications = () => {
    setActiveEmployerTab('Notifications');
    setCurrentScreen(SCREEN.EmployerNotifications);
  };

  const handleGoToJobs = () => {
    setActiveTab('Jobs');
    setViewMode('worker');
    setExplicitEmployerView(false);
    setCurrentScreen(SCREEN.Jobs);
  };

  const handleGoToEWallet = () => {
    setActiveTab('EWallet');
    setViewMode('worker');
    setExplicitEmployerView(false);
    setCurrentScreen(SCREEN.EWallet);
  };

  const handleGoToEmployerEWallet = () => {
    setActiveEmployerTab('EWallet');
    setCurrentScreen(SCREEN.EmployerEWallet);
  };

  const handleGoToJobDetails = (job) => {
    setSelectedJob(job);
    setCurrentScreen(SCREEN.JobDetails);
  };

  const handleGoToSaved = () => {
    setActiveTab('Jobs');
    setCurrentScreen(SCREEN.Saved);
  };

  const handleGoToApplied = () => {
    setActiveTab('Jobs');
    setCurrentScreen(SCREEN.Applied);
  };

  const handleGoToMessages = () => {
    setActiveTab('Messages');
    setViewMode('worker');
    setExplicitEmployerView(false);
    setWorkerUnreadMessageCount(0);
    setWorkerInboxInitialChatTarget(null);
    setCurrentScreen(SCREEN.Messages);
  };

  const handleGoToNotifications = () => {
    setViewMode('worker');
    setExplicitEmployerView(false);
    setCurrentScreen(SCREEN.Notifications);
  };

  const handleDismissWorkerNotification = useCallback((notificationId) => {
    const target = String(notificationId || '');
    if (!target) return;
    setWorkerNotifications((prev) =>
      prev.filter(
        (item) => String(item?.id || item?.applicationId || item?._id || '') !== target
      )
    );
  }, []);

  const handleGoToProfile = () => {
    setActiveTab('Profile');
    setViewMode('worker');
    setExplicitEmployerView(false);
    setCurrentScreen(SCREEN.Profile);
  };

  const handleSwitchRole = (nextRole) => {
    const normalizedRole = nextRole === 'employer' ? 'employer' : 'worker';
    Alert.alert(
      'Switch role',
      `Switch to ${normalizedRole === 'employer' ? 'Employer' : 'Worker'} mode?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setUserRole(normalizedRole);
            setViewMode(normalizedRole === 'employer' ? 'employer' : 'worker');
            setExplicitEmployerView(normalizedRole === 'employer');
            try {
              const storedUser = await AsyncStorage.getItem('auth_user');
              if (storedUser) {
                const parsed = JSON.parse(storedUser);
                await AsyncStorage.setItem('auth_user', JSON.stringify({ ...parsed, role: normalizedRole }));
              }
            } catch (error) {
              console.log('Failed to persist role switch', error);
            }

            if (normalizedRole === 'employer') {
              setActiveEmployerTab('Home');
              setCurrentScreen(SCREEN.EmployerJobPosts);
            } else {
              setActiveTab('Home');
              setCurrentScreen(SCREEN.Dashboard);
            }
          },
        },
      ]
    );
  };

  const handleGoToSettings = () => {
    setSettingsFromEmployer(false);
    setCurrentScreen(SCREEN.Settings);
  };

  const handleGoToSettingsFromEmployer = () => {
    setSettingsFromEmployer(true);
    setCurrentScreen(SCREEN.Settings);
  };

  const handleBackFromSettings = () => {
    if (settingsFromEmployer) {
      setActiveEmployerTab('Profile');
      setCurrentScreen(SCREEN.EmployerProfile);
      return;
    }
    setActiveTab('Profile');
    setCurrentScreen(SCREEN.Profile);
  };

  const handleBackToSettings = () => {
    setCurrentScreen(SCREEN.Settings);
  };

  const handleGoToSettingsPersonalDetails = () => {
    setActiveTab('Profile');
    setCurrentScreen(SCREEN.Profile);
  };

  const handleGoToSettingsChangePassword = () => {
    setCurrentScreen(SCREEN.SettingsChangePassword);
  };

  const handleGoToSettingsNotifications = () => {
    if (settingsFromEmployer) {
      handleGoToEmployerNotifications();
      return;
    }
    handleGoToNotifications();
  };

  const handleGoToSettingsEWallet = () => {
    if (settingsFromEmployer) {
      handleGoToEmployerEWallet();
      return;
    }
    handleGoToEWallet();
  };

  const handleGoToSettingsLocation = () => {
    setCurrentScreen(SCREEN.SettingsLocationServices);
  };

  const handleGoToSettingsMfa = () => {
    setCurrentScreen(SCREEN.SettingsMfa);
  };

  const handleGoToSettingsAbout = () => {
    setCurrentScreen(SCREEN.SettingsAbout);
  };

  const handleGoToSettingsDeleteAccount = () => {
    setCurrentScreen(SCREEN.SettingsDeleteAccount);
  };

  const handleGoToSettingsSupport = () => {
    setCurrentScreen(SCREEN.SettingsSupport);
  };

  const handleTabPress = (tab) => {
    switch (tab) {
      case 'Home':
        // Only switch to the employer section if the user explicitly switched
        // to employer view. This prevents auto-switching when a user with
        // employer privileges is using the worker UI.
        if (isEmployerRole && explicitEmployerView) {
          handleGoToEmployerPosts();
        } else {
          handleGoToWorkerDashboard();
        }
        break;
      case 'Jobs':
        handleGoToJobs();
        break;
      case 'EWallet':
      case 'E-Wallet':
        handleGoToEWallet();
        break;
      case 'Messages':
        if (isEmployerRole && explicitEmployerView) {
          setActiveEmployerTab('Messages');
          setCurrentScreen(SCREEN.EmployerMessages);
        } else {
          handleGoToMessages();
        }
        break;
      case 'Profile':
        // Only switch to employer profile if the user explicitly switched
        // to employer view.
        if (isEmployerRole && explicitEmployerView) {
          setActiveEmployerTab('Profile');
          setCurrentScreen(SCREEN.EmployerProfile);
        } else {
          setExplicitEmployerView(false);
          handleGoToProfile();
        }
        break;
      default:
        break;
    }
  };

  const handleEmployerTabPress = (tab) => {
    setActiveEmployerTab(tab);
    if (tab === 'Home') {
      handleGoToEmployerPosts();
    } else if (tab === 'Applications') {
      handleGoToEmployerApplications();
    } else if (tab === 'Post Job') {
      handleGoToEmployerPostJob(null);
    } else if (tab === 'Notifications') {
      handleGoToEmployerNotifications();
    } else if (tab === 'Profile') {
      handleGoToEmployerProfile();
    } else if (tab === 'Messages') {
      setCurrentScreen(SCREEN.EmployerMessages);
    }
  };

  const handleBack = () => {
    setCurrentScreen(Math.max(0, currentScreen - 1));
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        await apiRequest(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to logout.');
      }
    } catch (error) {
      // keep local logout behavior even if API logout fails
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    await AsyncStorage.multiRemove(['auth_token', 'auth_user', 'pending_verification_email']);
    setActiveTab('Home');
    setActiveEmployerTab('Home');
    setWorkerUnreadMessageCount(0);
    setWorkerNotifications([]);
    setEmployerNotifications([]);
    setMessageEvents([]);
    setWorkerInboxInitialChatTarget(null);
    setViewMode('worker');
    setExplicitEmployerView(false);
    setUserRole(null);
    setCurrentScreen(SCREEN.SignIn); // Always go to login
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(true);
  };

  const scheduleIdleTimers = useCallback(() => {
    clearIdleTimers();
    if (!isSessionActive) {
      setShowIdleWarning(false);
      return;
    }

    warningTimerRef.current = setTimeout(() => {
      setShowIdleWarning(true);
    }, Math.max(IDLE_TIMEOUT_MS - WARNING_DURATION_MS, 0));

    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimers, isSessionActive]);

  const handleActivity = useCallback((force = false) => {
    if (!isSessionActive) {
      return;
    }
    if (showIdleWarning && !force) {
      return;
    }
    setShowIdleWarning(false);
    scheduleIdleTimers();
  }, [isSessionActive, scheduleIdleTimers, showIdleWarning]);

  useEffect(() => {
    scheduleIdleTimers();
    return () => {
      clearIdleTimers();
    };
  }, [scheduleIdleTimers, clearIdleTimers]);

  useEffect(() => {
    const originalFetch = global.fetch;
    global.fetch = async (...args) => {
      handleActivity();
      return originalFetch(...args);
    };

    return () => {
      global.fetch = originalFetch;
    };
  }, [handleActivity]);

  const workerNotificationBadgeCount = workerNotifications.length;

  const screens = [
    <Screen1 onNext={handleNext} />,
    <Screen2 onNext={handleNext} />,
    <Screen3 onNext={handleNext} />,
    <Screen4 onNext={handleGoToSignUp} />,
    <SignUp onBack={handleBack} onNavigateToSignIn={handleGoToSignIn} onNavigateToVerify={handleGoToVerify} />,
    <SignIn
      onBack={handleBack}
      onNavigateToSignUp={handleGoToSignUp}
      onNavigateToForgot={handleGoToForgot}
      onNavigateToVerify={handleGoToVerify}
      onLogin={handleGoToDashboard}
    />,
    <SignSuccess onBackToLogin={handleGoToSignIn} />,
    <ForgotPass onBack={handleGoToSignIn} onSendReset={handleGoToVerify} />,
    <VerifyEmail onVerified={handleGoToDashboard} onBack={handleGoToSignIn} />,
    <CreatePass onBackToLogin={handleGoToSignIn} onReset={handleGoToPassChanged} />,
    <PassChanged onBackToLogin={handleGoToSignIn} />,
    <Dashboard
      onLogout={handleLogoutConfirm}
      activeTab={activeTab}
      onTabPress={handleTabPress}
      onNavigateToJobs={handleGoToJobs}
      onViewJobDetails={handleGoToJobDetails}
      onSaveJob={handleToggleSaveJob}
      savedJobIds={savedJobIds}
      onOpenNotifications={handleGoToNotifications}
      notificationBadgeCount={workerNotificationBadgeCount}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <Jobs
      onBack={handleGoToDashboard}
      onViewDetails={handleGoToJobDetails}
      onToggleSave={handleToggleSaveJob}
      onMessageEmployer={handleMessageEmployer}
      savedJobIds={savedJobIds}
      onOpenSavedJobs={handleGoToSaved}
      onOpenAppliedJobs={handleGoToApplied}
      onOpenNotifications={handleGoToNotifications}
      notificationBadgeCount={workerNotificationBadgeCount}
      activeTab={activeTab}
      onTabPress={handleTabPress}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <EWallet
      onBack={handleGoToJobs}
      onOpenNotifications={handleGoToNotifications}
      notificationBadgeCount={workerNotificationBadgeCount}
      activeTab={activeTab}
      onTabPress={handleTabPress}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <JobDetails
      job={selectedJob}
      onSaveJob={handleToggleSaveJob}
      onMessageEmployer={handleMessageEmployer}
      isSaved={selectedJob ? savedJobIds.includes(selectedJob._id) : false}
      activeTab={activeTab}
      onTabPress={handleTabPress}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <SavedJobs
      savedJobs={savedJobs}
      onRemoveJob={handleRemoveSavedJob}
      onViewDetails={handleGoToJobDetails}
      activeTab={activeTab}
      onTabPress={handleTabPress}
      onViewAppliedJobs={handleGoToApplied}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <AppliedJobs
      activeTab={activeTab}
      onTabPress={handleTabPress}
      onViewDetails={handleGoToJobDetails}
      onViewSavedJobs={handleGoToSaved}
      onMessageEmployer={handleMessageEmployer}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <WorkerInbox
      activeTab={activeTab}
      onTabPress={handleTabPress}
      liveMessages={messageEvents}
      onOpenNotifications={handleGoToNotifications}
      notificationBadgeCount={workerNotificationBadgeCount}
      messageBadgeCount={workerUnreadMessageCount}
      initialChatTarget={workerInboxInitialChatTarget}
    />,
    <NotificationsInbox
      activeTab={activeTab}
      onTabPress={handleTabPress}
      liveNotifications={workerNotifications}
      messageBadgeCount={workerUnreadMessageCount}
      onDismissLiveNotification={handleDismissWorkerNotification}
    />,
    <Profile
      activeTab={activeTab}
      onTabPress={handleTabPress}
      onOpenSettings={handleGoToSettings}
      currentRole={explicitEmployerView ? 'employer' : 'worker'}
      onSwitchRole={handleSwitchRole}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <Settings
      onBack={handleBackFromSettings}
      onLogout={handleLogoutConfirm}
      onNavigatePersonalDetails={handleGoToSettingsPersonalDetails}
      onNavigateChangePassword={handleGoToSettingsChangePassword}
      onNavigateNotifications={handleGoToSettingsNotifications}
      onNavigateEWallet={handleGoToSettingsEWallet}
      onNavigateLocation={handleGoToSettingsLocation}
      onNavigateMfa={handleGoToSettingsMfa}
      onNavigateAbout={handleGoToSettingsAbout}
      onNavigateDeleteAccount={handleGoToSettingsDeleteAccount}
      onNavigateSupport={handleGoToSettingsSupport}
      currentRole={settingsFromEmployer ? 'employer' : 'worker'}
    />,
    <EmployerJobPosts
      onOpenPostJob={handleGoToEmployerPostJob}
      onOpenApplications={handleGoToEmployerApplications}
      onOpenNotifications={handleGoToEmployerNotifications}
      onOpenProfile={handleGoToEmployerProfile}
      onEditJob={handleGoToEmployerPostJob}
      activeTab={activeEmployerTab}
      onTabPress={handleEmployerTabPress}
    />,
    <EmployerPostJob
      onPosted={() => {
        setSelectedEmployerJob(null);
        handleGoToEmployerPosts();
      }}
      jobToEdit={selectedEmployerJob}
      activeTab={activeEmployerTab}
      onTabPress={handleEmployerTabPress}
    />,
    <EmployerApplications
      activeTab={activeEmployerTab}
      onTabPress={handleEmployerTabPress}
      onMessageWorker={handleMessageWorker}
    />,
    <EmployerProfile
      activeTab={activeEmployerTab}
      onTabPress={handleEmployerTabPress}
      onLogout={handleLogoutConfirm}
      onOpenSettings={handleGoToSettingsFromEmployer}
      onOpenWallet={handleGoToEmployerEWallet}
      currentRole="employer"
      onSwitchRole={handleSwitchRole}
    />,
    <EmployerNotifications
      activeTab={activeEmployerTab}
      onTabPress={handleEmployerTabPress}
      liveNotifications={employerNotifications}
    />,
    <EmployerInbox activeTab={activeEmployerTab} onTabPress={handleEmployerTabPress} liveMessages={messageEvents} />,
    <EmployerEWallet
      onBack={handleGoToEmployerProfile}
      activeTab={activeEmployerTab}
      onTabPress={handleEmployerTabPress}
    />,
    <LocationServices onBack={handleBackToSettings} />,
    <MFA onBack={handleBackToSettings} />,
    <About onBack={handleBackToSettings} />,
    <DeleteAccount onBack={handleBackToSettings} />,
    <ChangePassword onBack={handleBackToSettings} />,
    <ContactSupport onBack={handleBackToSettings} />,
  ];
  const currentView = screens[currentScreen] ?? screens[SCREEN.SignIn] ?? null;

  const translateX = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0],
  });

  const opacity = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1],
  });

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: tokens.colors.brand }} />;
  }

  return (
    <View
      style={{ flex: 1, overflow: 'hidden', backgroundColor: tokens.colors.brand }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={handleActivity}
      onTouchStart={handleActivity}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity,
          transform: [{ translateX }],
        }}
      >
        {currentView}
      </Animated.View>
      {showLogoutModal && (
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutCard}>
            <TouchableOpacity style={styles.logoutClose} onPress={() => setShowLogoutModal(false)}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>

            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={36} color="#6B7280" />
            </View>

            <Text style={styles.logoutTitle}>Sign Out?</Text>
            <Text style={styles.logoutSubtitle}>Are you sure you want to exit?</Text>

            <View style={styles.logoutActions}>
              <TouchableOpacity style={styles.logoutSecondary} onPress={() => setShowLogoutModal(false)}>
                <Text style={styles.logoutSecondaryText}>NO</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutPrimary} onPress={handleLogout}>
                <Text style={styles.logoutPrimaryText}>SIGN OUT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {showIdleWarning && (
        <View style={styles.idleOverlay}>
          <View style={styles.idleCard}>
            <Text style={styles.idleTitle}>Session timeout</Text>
            <Text style={styles.idleSubtitle}>Your session will end due to inactivity. Press OK to continue.</Text>
            <View style={styles.idleActions}>
              <TouchableOpacity style={styles.idlePrimary} onPress={() => handleActivity(true)}>
                <Text style={styles.idlePrimaryText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  logoutCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  logoutClose: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIconWrap: {
    width: 86,
    height: 86,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  logoutTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  logoutSubtitle: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  logoutActions: {
    marginTop: 22,
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  logoutSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutSecondaryText: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  logoutPrimary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0B1C44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutPrimaryText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  idleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  idleCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  idleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
    textAlign: 'center',
  },
  idleSubtitle: {
    fontSize: 13,
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  idleActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  idlePrimary: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  idlePrimaryText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
  },
});
