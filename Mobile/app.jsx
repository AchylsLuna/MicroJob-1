import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Animated, Dimensions } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import "./global.css";
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
import Settings from './pages/pages1/Settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [activeTab, setActiveTab] = useState('Home');
  const [isReady, setIsReady] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const transition = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  // Toggle for testing onboarding screens
  const FORCE_ONBOARDING = true;

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
    JobDetails: 13,
    Saved: 14,
    Applied: 15,
    Messages: 16,
    Profile: 17,
    Settings: 18,
  };

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
          setCurrentScreen(SCREEN.Dashboard);
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
  }, []);

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
    setCurrentScreen(SCREEN.Dashboard);
  };

  const handleGoToJobs = () => {
    setActiveTab('Jobs');
    setCurrentScreen(SCREEN.Jobs);
  };

  const handleGoToJobDetails = (job) => {
    setSelectedJob(job);
    setCurrentScreen(SCREEN.JobDetails);
  };

  const handleGoToSaved = () => {
    setActiveTab('Saved');
    setCurrentScreen(SCREEN.Saved);
  };

  const handleGoToApplied = () => {
    setActiveTab('Saved');
    setCurrentScreen(SCREEN.Applied);
  };

  const handleGoToMessages = () => {
    setActiveTab('Messages');
    setCurrentScreen(SCREEN.Messages);
  };

  const handleGoToProfile = () => {
    setActiveTab('Profile');
    setCurrentScreen(SCREEN.Profile);
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
        handleGoToDashboard();
        break;
      case 'Jobs':
        handleGoToJobs();
        break;
      case 'Saved':
        handleGoToSaved();
        break;
      case 'Messages':
        handleGoToMessages();
        break;
      case 'Profile':
        handleGoToProfile();
        break;
      default:
        break;
    }
  };

  const handleBack = () => {
    setCurrentScreen(Math.max(0, currentScreen - 1));
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    setActiveTab('Home');
    setCurrentScreen(SCREEN.SignIn); // Always go to login
  };

  const screens = [
    <Screen1 onNext={handleNext} />,
    <Screen2 onNext={handleNext} />,
    <Screen3 onNext={handleNext} />,
    <Screen4 onNext={handleGoToSignUp} />,
    <SignUp onBack={handleBack} onNavigateToSignIn={handleGoToSignIn} onNavigateToVerify={handleGoToVerify} />,
    <SignIn onBack={handleBack} onNavigateToSignUp={handleGoToSignUp} onNavigateToForgot={handleGoToForgot} onLogin={handleGoToDashboard} />,
    <SignSuccess onBackToLogin={handleGoToSignIn} />,
    <ForgotPass onBack={handleGoToSignIn} onSendReset={handleGoToVerify} />,
    <VerifyEmail onVerified={handleGoToDashboard} onBack={handleGoToSignIn} />,
    <CreatePass onBackToLogin={handleGoToSignIn} onReset={handleGoToPassChanged} />,
    <PassChanged onBackToLogin={handleGoToSignIn} />,
    <Dashboard
      onLogout={handleLogout}
      activeTab={activeTab}
      onTabPress={handleTabPress}
      onNavigateToJobs={handleGoToJobs}
      onViewJobDetails={handleGoToJobDetails}
      onOpenNotifications={handleGoToMessages}
    />,
    <Jobs
      onBack={handleGoToDashboard}
      onViewDetails={handleGoToJobDetails}
      activeTab={activeTab}
      onTabPress={handleTabPress}
    />,
    <JobDetails
      job={selectedJob}
      onBack={handleGoToJobs}
      activeTab={activeTab}
      onTabPress={handleTabPress}
    />,
    <SavedJobs
      activeTab={activeTab}
      onTabPress={handleTabPress}
      onViewAppliedJobs={handleGoToApplied}
    />,
    <AppliedJobs
      activeTab={activeTab}
      onTabPress={handleTabPress}
      onViewDetails={handleGoToJobDetails}
      onViewSavedJobs={handleGoToSaved}
    />,
    <NotificationsInbox
      onBack={handleGoToDashboard}
      activeTab={activeTab}
      onTabPress={handleTabPress}
    />,
    <Profile
      activeTab={activeTab}
      onTabPress={handleTabPress}
      onOpenSettings={handleGoToSettings}
    />,
    <Settings
      onBack={handleBackFromSettings}
      onLogout={handleLogout}
    />,
  ];

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
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#0a2847' }}>
      <Animated.View
        style={{
          flex: 1,
          opacity,
          transform: [{ translateX }],
        }}
      >
        {screens[currentScreen]}
      </Animated.View>
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
});
