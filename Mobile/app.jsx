import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Animated, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import "./global.css";
import { API_URL, SOCKET_URL } from './config';
import { apiRequest, asObject } from './lib/api';
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
import EmployerJobPosts from './pages/employer/EmployerJobPosts';
import EmployerPostJob from './pages/employer/EmployerPostJob';
import EmployerApplications from './pages/employer/EmployerApplications';
import EmployerProfile from './pages/employer/EmployerProfile';
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
  const socketRef = useRef(null);
  const [workerNotifications, setWorkerNotifications] = useState([]);
  const [employerNotifications, setEmployerNotifications] = useState([]);
  const [messageEvents, setMessageEvents] = useState([]);
  const [workerUnreadMessageCount, setWorkerUnreadMessageCount] = useState(0);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const transition = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const currentScreenRef = useRef(currentScreen);

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
      const result = await apiRequest(`${API_URL}/auth/profile`, {
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

  // Initialize socket when ready and user is known
  useEffect(() => {
    let mounted = true;
    const initSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (!token || !storedUser) return;
        const parsed = JSON.parse(storedUser);
        const userId = parsed?._id || parsed?.id || parsed?.userId;
        if (!userId) return;

        // avoid reconnecting
        if (socketRef.current) return;

        const socket = io(SOCKET_URL, { transports: ['websocket'], auth: { token } });
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('socket connected', socket.id);
          socket.emit('register', String(userId));
        });
        socket.on('connect_error', (err) => {
          console.log('socket connect_error', err?.message || err);
        });

        socket.on('new_application', (payload) => {
          console.log('received new_application', payload);
          // employer receives when a worker applies
          setEmployerNotifications((prev) => [payload, ...prev]);
        });

        socket.on('application_status_updated', (payload) => {
          console.log('received application_status_updated', payload);
          // worker receives when employer updates status
          setWorkerNotifications((prev) => [payload, ...prev]);
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
        // ignore
      }
    };

    if (isReady) initSocket();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isReady]);

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
    setActiveTab('Home');
    const role = await fetchUserRole();
    setUserRole(role);
    setViewMode('worker');
    setExplicitEmployerView(false);
    if (role === 'employer') {
      setActiveEmployerTab('Home');
      setCurrentScreen(SCREEN.EmployerJobPosts);
    } else {
      setCurrentScreen(SCREEN.Dashboard);
    }
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
    setCurrentScreen(SCREEN.Messages);
  };

  const handleGoToNotifications = () => {
    setViewMode('worker');
    setExplicitEmployerView(false);
    setCurrentScreen(SCREEN.Notifications);
  };

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
    setCurrentScreen(SCREEN.Settings);
  };

  const handleBackFromSettings = () => {
    setActiveTab('Profile');
    setCurrentScreen(SCREEN.Profile);
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
          handleGoToDashboard();
        }
        break;
      case 'Jobs':
        handleGoToJobs();
        break;
      case 'EWallet':
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
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
    await AsyncStorage.removeItem('pending_verification_email');
    setActiveTab('Home');
    setWorkerUnreadMessageCount(0);
    setCurrentScreen(SCREEN.SignIn); // Always go to login
  };

  const handleLogoutConfirm = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: handleLogout },
    ]);
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

  const screens = [
    <Screen1 onNext={handleNext} />,
    <Screen2 onNext={handleNext} />,
    <Screen3 onNext={handleNext} />,
    <Screen4 onNext={handleGoToSignUp} />,
    <SignUp onBack={handleBack} onNavigateToSignIn={handleGoToSignIn} onNavigateToVerify={handleGoToVerify} />,
    <SignIn onBack={handleBack} onNavigateToSignUp={handleGoToSignUp} onNavigateToForgot={handleGoToForgot} onNavigateToVerify={handleGoToVerify} />,
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
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <Jobs
      onBack={handleGoToDashboard}
      onViewDetails={handleGoToJobDetails}
      onToggleSave={handleToggleSaveJob}
      savedJobIds={savedJobIds}
      onOpenSavedJobs={handleGoToSaved}
      onOpenAppliedJobs={handleGoToApplied}
      activeTab={activeTab}
      onTabPress={handleTabPress}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <EWallet
      onBack={handleGoToJobs}
      activeTab={activeTab}
      onTabPress={handleTabPress}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <JobDetails
      job={selectedJob}
      onSaveJob={handleToggleSaveJob}
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
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <WorkerInbox
      activeTab={activeTab}
      onTabPress={handleTabPress}
      liveMessages={messageEvents}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <NotificationsInbox
      activeTab={activeTab}
      onTabPress={handleTabPress}
      liveNotifications={workerNotifications}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <Profile
      activeTab={activeTab}
      onTabPress={handleTabPress}
      onOpenSettings={handleGoToSettings}
      currentRole={isEmployerRole ? 'employer' : 'worker'}
      onSwitchRole={handleSwitchRole}
      messageBadgeCount={workerUnreadMessageCount}
    />,
    <Settings
      onBack={handleBackFromSettings}
      onLogout={handleLogoutConfirm}
      onNavigateNotifications={handleGoToNotifications}
      onNavigateEWallet={handleGoToEWallet}
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
      currentRole={isEmployerRole ? 'employer' : 'worker'}
      onSwitchRole={handleSwitchRole}
    />,
    <EmployerNotifications
      activeTab={activeEmployerTab}
      onTabPress={handleEmployerTabPress}
      liveNotifications={employerNotifications}
    />,
    <EmployerInbox activeTab={activeEmployerTab} onTabPress={handleEmployerTabPress} liveMessages={messageEvents} />,
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
    return <View style={{ flex: 1, backgroundColor: '#0a2847' }} />;
  }

  return (
    <View
      style={{ flex: 1, overflow: 'hidden', backgroundColor: '#0a2847' }}
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
