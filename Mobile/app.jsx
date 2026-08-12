import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DefaultTheme, NavigationContainer, useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from './lib/storage';
import { API_URL } from './config';
import { apiRequest } from './lib/api';
import { tokens } from './theme/tokens';
import OnboardingCarouselScreen from './pages/OnboardingCarouselScreen';
import SignIn from './pages/signIn';
import SignUp from './pages/signUp';
import VerifyEmail from './pages/verifyEmail';
import ForgotPass from './pages/forgotPass';
import CreatePass from './pages/createPass';
import PassChanged from './pages/passChanged';
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
import PersonalInformation from './pages/pages1/PersonalInformation';
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
import EmployerPaymentMethods from './pages/employer/EmployerPaymentMethods';
import { AppSessionProvider, useAppSession } from './contexts/AppSessionContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { StatusBar } from 'expo-status-bar';
import LaunchScreen from './components/LaunchScreen';
import { isRoleTab, navigateToRoleTab } from './components/tabNavigation';

const AuthStack = createNativeStackNavigator();
const WorkerStack = createNativeStackNavigator();
const EmployerStack = createNativeStackNavigator();
const WorkerTab = createBottomTabNavigator();
const EmployerTab = createBottomTabNavigator();

const hiddenTabs = {
  headerShown: false,
  tabBarStyle: { display: 'none' },
  animation: 'fade',
};

const stackMotion = {
  headerShown: false,
  animation: 'slide_from_right',
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
};

function OnboardingScreen() {
  const navigation = useNavigation();
  const { markOnboarded } = useAppSession();
  const [activeIndex, setActiveIndex] = useState(0);

  const goToSignIn = async () => {
    await markOnboarded();
    navigation.navigate('SignIn');
  };

  const goToSignUp = async () => {
    await markOnboarded();
    navigation.navigate('SignUp');
  };

  return (
    <OnboardingCarouselScreen
      activeIndex={activeIndex}
      onIndexChange={setActiveIndex}
      onSkip={goToSignIn}
      onLogin={goToSignIn}
      onComplete={goToSignUp}
    />
  );
}

function SignInScreen() {
  const navigation = useNavigation();
  const { handleAuthSuccess } = useAppSession();
  return (
    <SignIn
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })}
      onNavigateToSignUp={() => navigation.navigate('SignUp')}
      onNavigateToForgot={() => navigation.navigate('ForgotPassword')}
      onNavigateToVerify={(params) => navigation.navigate('VerifyEmail', params || {})}
      onLogin={async () => {
        await handleAuthSuccess();
      }}
    />
  );
}

function SignUpScreen() {
  const navigation = useNavigation();
  return (
    <SignUp
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] })}
      onNavigateToSignIn={() => navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] })}
      onNavigateToVerify={(email) => navigation.navigate('VerifyEmail', { mode: 'emailVerification', email, origin: 'signup' })}
    />
  );
}

function VerifyEmailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { handleAuthSuccess } = useAppSession();
  const routeParams = route?.params || {};
  return (
    <VerifyEmail
      mode={routeParams.mode || 'emailVerification'}
      email={routeParams.email}
      otpToken={routeParams.otpToken}
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] })}
      onVerified={async (code) => {
        if (routeParams.mode === 'passwordReset') {
          navigation.replace('CreatePass', { email: routeParams.email, code });
          return;
        }
        await handleAuthSuccess();
      }}
    />
  );
}

function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const toast = useToast();
  return (
    <ForgotPass
      onBack={async () => {
        await AsyncStorage.multiRemove(['pending_reset_email', 'pending_verification_skip_send']);
        navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
      }}
      onSendReset={async (emailAddress) => {
        const normalizedEmail = String(emailAddress || '').trim().toLowerCase();
        const result = await apiRequest(`${API_URL}/auth/password-reset/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        }, 'Unable to request password reset.');
        if (!result.ok) {
          toast.error(`${result.message || 'Unable to request password reset.'} (HTTP ${result.status})`);
          return;
        }
        await AsyncStorage.setItem('pending_reset_email', normalizedEmail);
        await AsyncStorage.setItem('pending_verification_skip_send', '1');
        toast.info(result.message || 'If the account exists, a reset code was sent to your email.');
        navigation.navigate('VerifyEmail', { mode: 'passwordReset', email: normalizedEmail, origin: 'forgot' });
      }}
    />
  );
}

function CreatePassScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const routeParams = route?.params || {};
  return (
    <CreatePass
      verifiedCode={routeParams.code}
      onBackToLogin={() => navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] })}
      onReset={async ({ code, password, confirm }) => {
        const normalizedCode = String(code || '').replace(/\D/g, '').slice(0, 6);
        if (!/^\d{6}$/.test(normalizedCode)) {
          toast.error('Please enter a valid 6-digit reset code.');
          return;
        }
        if (!password) {
          toast.error('Please enter your new password.');
          return;
        }
        if (password !== confirm) {
          toast.error('Passwords do not match.');
          return;
        }

        const resetEmail = String(routeParams.email || (await AsyncStorage.getItem('pending_reset_email')) || '').trim().toLowerCase();
        const result = await apiRequest(`${API_URL}/auth/password-reset/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: resetEmail,
            code: normalizedCode,
            newPassword: password,
          }),
        }, 'Unable to reset password.');

        if (!result.ok) {
          toast.error(`${result.message || 'Unable to reset password.'} (HTTP ${result.status})`);
          return;
        }

        await AsyncStorage.multiRemove(['pending_reset_email', 'pending_verification_skip_send']);
        toast.success('Password reset successful.');
        navigation.replace('PassChanged');
      }}
    />
  );
}

function PassChangedScreen() {
  const navigation = useNavigation();
  return <PassChanged onBackToLogin={() => navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] })} />;
}

function AuthNavigator() {
  const { hasOnboarded } = useAppSession();
  return (
    <AuthStack.Navigator screenOptions={stackMotion} initialRouteName={hasOnboarded ? 'SignIn' : 'Onboarding'}>
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="CreatePass" component={CreatePassScreen} />
      <AuthStack.Screen name="PassChanged" component={PassChangedScreen} />
    </AuthStack.Navigator>
  );
}

function useWorkerTabNavigation() {
  const navigation = useNavigation();
  return useCallback((tab) => {
    if (isRoleTab('worker', tab)) navigateToRoleTab(navigation, 'worker', tab);
  }, [navigation]);
}

function useEmployerTabNavigation() {
  const navigation = useNavigation();
  return useCallback((tab) => {
    if (isRoleTab('employer', tab)) navigateToRoleTab(navigation, 'employer', tab);
  }, [navigation]);
}

function WorkerHomeScreen() {
  const navigation = useNavigation();
  const workerTabPress = useWorkerTabNavigation();
  const session = useAppSession();
  const toast = useToast();
  const localArea = [session.user?.city, session.user?.province].map((value) => String(value || '').trim()).filter(Boolean).join(', ');
  return (
    <Dashboard
      activeTab="Home"
      onTabPress={workerTabPress}
      onNavigateToJobs={() => navigation.navigate('Jobs')}
      onSelectCategory={(categoryId) => navigation.navigate('Jobs', { initialCategory: categoryId })}
      onUploadResume={() => navigation.navigate('Profile', { initialAction: 'resume', actionNonce: Date.now() })}
      onOpenSettings={() => navigation.navigate('WorkerAccountInformation', { initialSection: 'location' })}
      onViewJobDetails={(job) => navigation.navigate('WorkerJobDetails', { job })}
      onSaveJob={async (job) => {
        try {
          await session.toggleSavedJob(job);
        } catch (error) {
          toast.error(error?.message || 'Failed to update saved jobs.');
        }
      }}
      savedJobIds={session.savedJobIds}
      onOpenNotifications={() => navigation.navigate('WorkerNotifications')}
      notificationBadgeCount={session.workerNotifications.length}
      messageBadgeCount={session.unreadMessageCount}
      headerSubtitle={localArea || 'Set your local area'}
    />
  );
}

function WorkerJobsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const workerTabPress = useWorkerTabNavigation();
  const session = useAppSession();
  const toast = useToast();
  return (
    <Jobs
      onViewDetails={(job) => navigation.navigate('WorkerJobDetails', { job })}
      onToggleSave={async (job) => {
        try {
          await session.toggleSavedJob(job);
        } catch (error) {
          toast.error(error?.message || 'Failed to update saved jobs.');
        }
      }}
      onMessageEmployer={({ userId, userName, jobId }) => {
        if (!userId) return;
        session.setInitialWorkerChatTarget({ id: String(userId), name: userName || 'Employer' });
        navigation.navigate('Messages');
      }}
      savedJobIds={session.savedJobIds}
      onOpenSavedJobs={() => navigation.navigate('WorkerSavedJobs')}
      onOpenAppliedJobs={() => navigation.navigate('WorkerAppliedJobs')}
      onOpenNotifications={() => navigation.navigate('WorkerNotifications')}
      activeTab="Jobs"
      onTabPress={workerTabPress}
      notificationBadgeCount={session.workerNotifications.length}
      messageBadgeCount={session.unreadMessageCount}
      initialCategory={route.params?.initialCategory}
    />
  );
}

function WorkerEWalletScreen() {
  const navigation = useNavigation();
  const workerTabPress = useWorkerTabNavigation();
  const session = useAppSession();
  return (
    <EWallet
      activeTab="EWallet"
      onTabPress={workerTabPress}
      onOpenNotifications={() => navigation.navigate('WorkerNotifications')}
      notificationBadgeCount={session.workerNotifications.length}
      messageBadgeCount={session.unreadMessageCount}
    />
  );
}

function WorkerMessagesScreen() {
  const navigation = useNavigation();
  const workerTabPress = useWorkerTabNavigation();
  const session = useAppSession();

  return (
    <WorkerInbox
      activeTab="Messages"
      onTabPress={workerTabPress}
      liveMessages={session.messageEvents}
      onOpenNotifications={() => navigation.navigate('WorkerNotifications')}
      notificationBadgeCount={session.workerNotifications.length}
      messageBadgeCount={session.unreadMessageCount}
      initialChatTarget={session.initialWorkerChatTarget}
      onConsumeInitialChatTarget={session.clearInitialWorkerChatTarget}
    />
  );
}

function WorkerProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const workerTabPress = useWorkerTabNavigation();
  const session = useAppSession();
  return (
    <Profile
      activeTab="Profile"
      onTabPress={workerTabPress}
      onOpenSettings={() => navigation.navigate('WorkerSettings')}
      messageBadgeCount={session.unreadMessageCount}
      initialAction={route.params?.initialAction}
      actionNonce={route.params?.actionNonce}
    />
  );
}

function WorkerTabsNavigator() {
  return (
    <WorkerTab.Navigator screenOptions={hiddenTabs}>
      <WorkerTab.Screen name="Home" component={WorkerHomeScreen} />
      <WorkerTab.Screen name="Jobs" component={WorkerJobsScreen} />
      <WorkerTab.Screen name="EWallet" component={WorkerEWalletScreen} />
      <WorkerTab.Screen name="Messages" component={WorkerMessagesScreen} />
      <WorkerTab.Screen name="Profile" component={WorkerProfileScreen} />
    </WorkerTab.Navigator>
  );
}

function WorkerJobDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const session = useAppSession();
  const toast = useToast();
  const workerTabPress = useWorkerTabNavigation();
  const job = route.params?.job || null;
  return (
    <JobDetails
      job={job}
      onSaveJob={async (targetJob) => {
        try {
          await session.toggleSavedJob(targetJob || job);
        } catch (error) {
          toast.error(error?.message || 'Failed to update saved jobs.');
        }
      }}
      onMessageEmployer={({ userId, userName }) => {
        if (!userId) return;
        session.setInitialWorkerChatTarget({ id: String(userId), name: userName || 'Employer' });
        workerTabPress('Messages');
      }}
      isSaved={job?._id ? session.savedJobIds.includes(String(job._id)) : false}
      activeTab="Jobs"
      onTabPress={workerTabPress}
      messageBadgeCount={session.unreadMessageCount}
    />
  );
}

function WorkerSavedJobsScreen() {
  const navigation = useNavigation();
  const session = useAppSession();
  const toast = useToast();
  const workerTabPress = useWorkerTabNavigation();
  return (
    <SavedJobs
      savedJobs={session.savedJobs}
      onRemoveJob={async (jobId) => {
        try {
          await session.removeSavedJob(jobId);
        } catch (error) {
          toast.error(error?.message || 'Failed to remove saved job.');
        }
      }}
      onViewDetails={(job) => navigation.navigate('WorkerJobDetails', { job: job.raw || job })}
      activeTab="Jobs"
      onTabPress={workerTabPress}
      onViewAppliedJobs={() => navigation.navigate('WorkerAppliedJobs')}
      messageBadgeCount={session.unreadMessageCount}
    />
  );
}

function WorkerAppliedJobsScreen() {
  const navigation = useNavigation();
  const session = useAppSession();
  const workerTabPress = useWorkerTabNavigation();
  return (
    <AppliedJobs
      activeTab="Jobs"
      onTabPress={workerTabPress}
      onViewDetails={(job) => navigation.navigate('WorkerJobDetails', { job })}
      onViewSavedJobs={() => navigation.navigate('WorkerSavedJobs')}
      onMessageEmployer={({ userId, userName }) => {
        if (!userId) return;
        session.setInitialWorkerChatTarget({ id: String(userId), name: userName || 'Employer' });
        workerTabPress('Messages');
      }}
      messageBadgeCount={session.unreadMessageCount}
    />
  );
}

function WorkerNotificationsScreen() {
  const navigation = useNavigation();
  const session = useAppSession();
  const workerTabPress = useWorkerTabNavigation();
  const openNotification = (item) => {
    const type = String(item?.type || '').toLowerCase();
    if (type === 'application' || type === 'interview') navigation.navigate('WorkerAppliedJobs');
    else if (type === 'message') workerTabPress('Messages');
    else if (type === 'payment' || type === 'payout') workerTabPress('EWallet');
    else if (type === 'support') navigation.navigate('WorkerSupport');
    else if (type === 'account') navigation.navigate('WorkerSettings');
  };
  return (
    <NotificationsInbox
      activeTab="Home"
      onTabPress={workerTabPress}
      liveNotifications={session.workerNotifications}
      messageBadgeCount={session.unreadMessageCount}
      onDismissLiveNotification={session.dismissWorkerNotification}
      onBack={() => navigation.goBack()}
      onOpenNotification={openNotification}
    />
  );
}

function WorkerSettingsScreen() {
  const navigation = useNavigation();
  const session = useAppSession();
  return (
    <Settings
      onBack={() => navigation.goBack()}
      onLogout={session.openLogoutConfirm}
      onNavigatePersonalDetails={() => navigation.navigate('WorkerAccountInformation', { initialSection: 'profile' })}
      onNavigateResumeDocuments={() => navigation.navigate('WorkerTabs', { screen: 'Profile' })}
      onNavigateChangePassword={() => navigation.navigate('WorkerChangePassword')}
      onNavigateNotifications={() => navigation.navigate('WorkerNotifications')}
      onNavigateLocation={() => navigation.navigate('WorkerLocationServices')}
      onNavigateMfa={() => navigation.navigate('WorkerMfa')}
      onNavigateAbout={() => navigation.navigate('WorkerAbout')}
      onNavigateDeleteAccount={() => navigation.navigate('WorkerDeleteAccount')}
      onNavigateSupport={() => navigation.navigate('WorkerSupport')}
      currentRole="worker"
      canSwitchAccountMode={session.canSwitchAccountMode}
      onSwitchAccountMode={session.switchViewMode}
    />
  );
}

function WorkerAccountInformationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const session = useAppSession();
  return (
    <PersonalInformation
      onBack={() => navigation.goBack()}
      currentRole="worker"
      initialSection={route.params?.initialSection || 'profile'}
      onProfileUpdated={session.refreshProfile}
    />
  );
}

function WorkerLocationServicesScreen() {
  const navigation = useNavigation();
  return <LocationServices onBack={() => navigation.goBack()} />;
}

function WorkerMfaScreen() {
  const navigation = useNavigation();
  return <MFA onBack={() => navigation.goBack()} />;
}

function WorkerAboutScreen() {
  const navigation = useNavigation();
  return <About onBack={() => navigation.goBack()} />;
}

function WorkerDeleteAccountScreen() {
  const navigation = useNavigation();
  const session = useAppSession();
  return <DeleteAccount onBack={() => navigation.goBack()} onDeleted={() => void session.logout()} />;
}

function WorkerChangePasswordScreen() {
  const navigation = useNavigation();
  return <ChangePassword onBack={() => navigation.goBack()} />;
}

function WorkerSupportScreen() {
  const navigation = useNavigation();
  return <ContactSupport onBack={() => navigation.goBack()} />;
}

function WorkerStackNavigator() {
  return (
    <WorkerStack.Navigator screenOptions={stackMotion}>
      <WorkerStack.Screen name="WorkerTabs" component={WorkerTabsNavigator} />
      <WorkerStack.Screen name="WorkerJobDetails" component={WorkerJobDetailsScreen} />
      <WorkerStack.Screen name="WorkerSavedJobs" component={WorkerSavedJobsScreen} />
      <WorkerStack.Screen name="WorkerAppliedJobs" component={WorkerAppliedJobsScreen} />
      <WorkerStack.Screen name="WorkerNotifications" component={WorkerNotificationsScreen} />
      <WorkerStack.Screen name="WorkerSettings" component={WorkerSettingsScreen} />
      <WorkerStack.Screen name="WorkerAccountInformation" component={WorkerAccountInformationScreen} />
      <WorkerStack.Screen name="WorkerLocationServices" component={WorkerLocationServicesScreen} />
      <WorkerStack.Screen name="WorkerMfa" component={WorkerMfaScreen} />
      <WorkerStack.Screen name="WorkerAbout" component={WorkerAboutScreen} />
      <WorkerStack.Screen name="WorkerDeleteAccount" component={WorkerDeleteAccountScreen} />
      <WorkerStack.Screen name="WorkerChangePassword" component={WorkerChangePasswordScreen} />
      <WorkerStack.Screen name="WorkerSupport" component={WorkerSupportScreen} />
    </WorkerStack.Navigator>
  );
}

function EmployerHomeScreen() {
  const navigation = useNavigation();
  const employerTabPress = useEmployerTabNavigation();
  const session = useAppSession();
  const localArea = [session.user?.city, session.user?.province].map((value) => String(value || '').trim()).filter(Boolean).join(', ');
  return (
    <EmployerJobPosts
      onEditJob={(job) => navigation.navigate('EmployerPostJobScreen', { jobToEdit: job })}
      onOpenWallet={() => navigation.navigate('EmployerEWallet')}
      activeTab="Home"
      onTabPress={employerTabPress}
      headerSubtitle={localArea || 'Set your local area'}
      onOpenLocation={() => navigation.navigate('EmployerLocationServices')}
    />
  );
}

function EmployerApplicationsScreen() {
  const navigation = useNavigation();
  const employerTabPress = useEmployerTabNavigation();
  const session = useAppSession();
  return (
    <EmployerApplications
      activeTab="Applications"
      onTabPress={employerTabPress}
      onMessageWorker={({ workerId, workerName }) => {
        if (!workerId) return;
        session.setInitialEmployerChatTarget({ id: String(workerId), name: workerName || 'Worker' });
        navigateToEmployerTab(navigation, 'Messages');
      }}
    />
  );
}

function EmployerPostJobScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const employerTabPress = useEmployerTabNavigation();
  return (
    <EmployerPostJob
      onPosted={() => navigateToEmployerTab(navigation, 'Home')}
      onOpenWallet={() => navigation.navigate('EmployerEWallet')}
      jobToEdit={route.params?.jobToEdit || null}
      activeTab="Post Job"
      onTabPress={employerTabPress}
    />
  );
}

function EmployerMessagesScreen() {
  const navigation = useNavigation();
  const employerTabPress = useEmployerTabNavigation();
  const session = useAppSession();
  return (
    <EmployerInbox
      activeTab="Messages"
      onTabPress={employerTabPress}
      liveMessages={session.messageEvents}
      onOpenNotifications={() => navigateToEmployerTab(navigation, 'Notifications')}
      notificationBadgeCount={session.employerNotifications.length}
      initialChatTarget={session.initialEmployerChatTarget}
      onConsumeInitialChatTarget={session.clearInitialEmployerChatTarget}
    />
  );
}

function EmployerNotificationsScreen() {
  const navigation = useNavigation();
  const employerTabPress = useEmployerTabNavigation();
  const session = useAppSession();
  const openNotification = (item) => {
    const type = String(item?.type || '').toLowerCase();
    if (type === 'application' || type === 'interview') employerTabPress('Applications');
    else if (type === 'message') employerTabPress('Messages');
    else if (type === 'payment' || type === 'payout') navigation.navigate('EmployerEWallet');
    else if (type === 'support') navigation.navigate('EmployerSupport');
    else if (type === 'account') navigation.navigate('EmployerSettings');
  };
  return <EmployerNotifications activeTab="Notifications" onTabPress={employerTabPress} liveNotifications={session.employerNotifications} onOpenNotification={openNotification} />;
}

function EmployerProfileScreen() {
  const navigation = useNavigation();
  const employerTabPress = useEmployerTabNavigation();
  const session = useAppSession();
  return (
    <EmployerProfile
      activeTab="Profile"
      onTabPress={employerTabPress}
      onOpenSettings={() => navigation.navigate('EmployerSettings')}
      onEditProfile={() => navigation.navigate('EmployerAccountInformation', { initialSection: 'profile' })}
      onOpenWallet={() => navigation.navigate('EmployerEWallet')}
    />
  );
}

function EmployerTabsNavigator() {
  return (
    <EmployerTab.Navigator screenOptions={hiddenTabs}>
      <EmployerTab.Screen name="Home" component={EmployerHomeScreen} />
      <EmployerTab.Screen name="Applications" component={EmployerApplicationsScreen} />
      <EmployerTab.Screen name="Post Job" component={EmployerPostJobScreen} />
      <EmployerTab.Screen name="Messages" component={EmployerMessagesScreen} />
      <EmployerTab.Screen name="Notifications" component={EmployerNotificationsScreen} />
      <EmployerTab.Screen name="Profile" component={EmployerProfileScreen} />
    </EmployerTab.Navigator>
  );
}

function EmployerSettingsScreen() {
  const navigation = useNavigation();
  const session = useAppSession();
  return (
    <Settings
      onBack={() => navigation.goBack()}
      onLogout={session.openLogoutConfirm}
      onNavigatePersonalDetails={() => navigation.navigate('EmployerAccountInformation', { initialSection: 'profile' })}
      onNavigateChangePassword={() => navigation.navigate('EmployerChangePassword')}
      onNavigateNotifications={() => navigation.navigate('EmployerTabs', { screen: 'Notifications' })}
      onNavigateLocation={() => navigation.navigate('EmployerLocationServices')}
      onNavigateMfa={() => navigation.navigate('EmployerMfa')}
      onNavigateAbout={() => navigation.navigate('EmployerAbout')}
      onNavigateDeleteAccount={() => navigation.navigate('EmployerDeleteAccount')}
      onNavigateSupport={() => navigation.navigate('EmployerSupport')}
      onNavigatePaymentMethods={() => navigation.navigate('EmployerPaymentMethods')}
      currentRole="employer"
      canSwitchAccountMode={session.canSwitchAccountMode}
      onSwitchAccountMode={session.switchViewMode}
    />
  );
}

function EmployerAccountInformationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const session = useAppSession();
  return (
    <PersonalInformation
      onBack={() => navigation.goBack()}
      currentRole="employer"
      initialSection={route.params?.initialSection || 'profile'}
      onProfileUpdated={session.refreshProfile}
    />
  );
}

function EmployerEWalletScreen() {
  const navigation = useNavigation();
  const employerTabPress = useEmployerTabNavigation();
  return (
    <EmployerEWallet
      onBack={() => navigation.goBack()}
      activeTab="Profile"
      onTabPress={employerTabPress}
    />
  );
}

function EmployerPaymentMethodsScreen() {
  const navigation = useNavigation();
  return <EmployerPaymentMethods onBack={() => navigation.goBack()} />;
}

function EmployerLocationServicesScreen() {
  const navigation = useNavigation();
  return <LocationServices onBack={() => navigation.goBack()} />;
}

function EmployerMfaScreen() {
  const navigation = useNavigation();
  return <MFA onBack={() => navigation.goBack()} />;
}

function EmployerAboutScreen() {
  const navigation = useNavigation();
  return <About onBack={() => navigation.goBack()} />;
}

function EmployerDeleteAccountScreen() {
  const navigation = useNavigation();
  const session = useAppSession();
  return <DeleteAccount onBack={() => navigation.goBack()} onDeleted={() => void session.logout()} />;
}

function EmployerChangePasswordScreen() {
  const navigation = useNavigation();
  return <ChangePassword onBack={() => navigation.goBack()} />;
}

function EmployerSupportScreen() {
  const navigation = useNavigation();
  return <ContactSupport onBack={() => navigation.goBack()} />;
}

function EmployerStackNavigator() {
  return (
    <EmployerStack.Navigator screenOptions={stackMotion}>
      <EmployerStack.Screen name="EmployerTabs" component={EmployerTabsNavigator} />
      <EmployerStack.Screen name="EmployerPostJobScreen" component={EmployerPostJobScreen} />
      <EmployerStack.Screen name="EmployerEWallet" component={EmployerEWalletScreen} />
      <EmployerStack.Screen name="EmployerSettings" component={EmployerSettingsScreen} />
      <EmployerStack.Screen name="EmployerAccountInformation" component={EmployerAccountInformationScreen} />
      <EmployerStack.Screen name="EmployerPaymentMethods" component={EmployerPaymentMethodsScreen} />
      <EmployerStack.Screen name="EmployerLocationServices" component={EmployerLocationServicesScreen} />
      <EmployerStack.Screen name="EmployerMfa" component={EmployerMfaScreen} />
      <EmployerStack.Screen name="EmployerAbout" component={EmployerAboutScreen} />
      <EmployerStack.Screen name="EmployerDeleteAccount" component={EmployerDeleteAccountScreen} />
      <EmployerStack.Screen name="EmployerChangePassword" component={EmployerChangePasswordScreen} />
      <EmployerStack.Screen name="EmployerSupport" component={EmployerSupportScreen} />
    </EmployerStack.Navigator>
  );
}

function AppNavigator() {
  const session = useAppSession();

  if (!session.isReady) {
    return <View style={{ flex: 1, backgroundColor: tokens.colors.brand }} />;
  }

  return session.isAuthenticated ? (session.viewMode === 'employer' && session.canAccessEmployer ? <EmployerStackNavigator /> : <WorkerStackNavigator />) : <AuthNavigator />;
}

function SessionOverlays() {
  const session = useAppSession();

  return (
    <>
      {session.showLogoutModal ? (
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutCard}>
            <TouchableOpacity style={styles.logoutClose} onPress={session.closeLogoutConfirm}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={36} color="#6B7280" />
            </View>
            <Text style={styles.logoutTitle}>Sign Out?</Text>
            <Text style={styles.logoutSubtitle}>Are you sure you want to exit?</Text>
            <View style={styles.logoutActions}>
              <TouchableOpacity style={styles.logoutSecondary} onPress={session.closeLogoutConfirm}>
                <Text style={styles.logoutSecondaryText}>NO</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutPrimary} onPress={() => void session.logout()}>
                <Text style={styles.logoutPrimaryText}>SIGN OUT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {session.showIdleWarning ? (
        <View style={styles.idleOverlay}>
          <View style={styles.idleCard}>
            <Text style={styles.idleTitle}>Session timeout</Text>
            <Text style={styles.idleSubtitle}>Your session will end due to inactivity. Press OK to continue.</Text>
            <View style={styles.idleActions}>
              <TouchableOpacity style={styles.idlePrimary} onPress={session.dismissIdleWarning}>
                <Text style={styles.idlePrimaryText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

function RootApp() {
  const session = useAppSession();
  const [showLaunch, setShowLaunch] = useState(true);
  const navigationTheme = useMemo(() => ({
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: tokens.colors.signedInCanvas, primary: tokens.colors.brand, card: tokens.colors.contentSurface },
  }), []);
  return (
    <View
      style={{ flex: 1, overflow: 'hidden', backgroundColor: tokens.colors.signedInCanvas }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={() => session.registerActivity()}
      onTouchStart={() => session.registerActivity()}
    >
      <StatusBar style="dark" />
      <NavigationContainer theme={navigationTheme} onStateChange={() => session.registerActivity()}>
        <AppNavigator />
      </NavigationContainer>
      <SessionOverlays />
      {showLaunch ? <LaunchScreen sessionReady={session.isReady} onFinished={() => setShowLaunch(false)} /> : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AppSessionProvider>
          <RootApp />
        </AppSessionProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  logoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoutCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
  },
  logoutClose: {
    position: 'absolute',
    right: 18,
    top: 18,
  },
  logoutIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  logoutSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  logoutPrimary: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  idleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  idleCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: '#fff',
    padding: 24,
  },
  idleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  idleSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  idleActions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  idlePrimary: {
    minWidth: 110,
    borderRadius: 14,
    backgroundColor: '#1C4D8D',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  idlePrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
