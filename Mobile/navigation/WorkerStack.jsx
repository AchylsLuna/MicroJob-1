import { useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Jobs from '../pages/worker/Jobs';
import JobDetails from '../pages/worker/JobDetails';
import SavedJobs from '../pages/worker/SavedJobs';
import AppliedJobs from '../pages/worker/AppliedJobs';
import Profile from '../pages/worker/Profile';
import NotificationsInbox from '../pages/worker/NotificationsInbox';
import WorkerInbox from '../pages/worker/WorkerInbox';
import EWallet from '../pages/worker/EWallet';
import Settings from '../pages/worker/Settings';
import PersonalInformation from '../pages/worker/PersonalInformation';
import LocationServices from '../pages/worker/LocationServices';
import MFA from '../pages/worker/MFA';
import About from '../pages/worker/About';
import DeleteAccount from '../pages/worker/DeleteAccount';
import ChangePassword from '../pages/worker/ChangePassword';
import ContactSupport from '../pages/worker/ContactSupport';
import { useAppSession } from '../contexts/AppSessionContext';
import { useToast } from '../contexts/ToastContext';
import { useWorkerTabNavigation } from './useTabNavigation';
import { hiddenTabs, stackMotion } from './options';

const WorkerStack = createNativeStackNavigator();
const WorkerTab = createBottomTabNavigator();

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
        session.setInitialWorkerChatTarget({ id: String(userId), name: userName || 'Employer', jobId: jobId ? String(jobId) : undefined });
        navigation.navigate('Messages');
      }}
      savedJobIds={session.savedJobIds}
      onOpenSavedJobs={() => navigation.navigate('WorkerSavedJobs')}
      onOpenAppliedJobs={() => navigation.navigate('WorkerAppliedJobs')}
      onOpenNotifications={() => navigation.navigate('WorkerNotifications')}
      activeTab="Jobs"
      onTabPress={workerTabPress}
      notificationBadgeCount={session.workerNotificationUnreadCount}
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
      notificationBadgeCount={session.workerNotificationUnreadCount}
      messageBadgeCount={session.unreadMessageCount}
      onOpenInvoiceChat={(target) => { session.setInitialWorkerChatTarget(target); workerTabPress('Messages'); }}
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
      notificationBadgeCount={session.workerNotificationUnreadCount}
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
  // Workers have no dashboard — Jobs is their home, mirroring the web client.
  return (
    <WorkerTab.Navigator screenOptions={hiddenTabs} initialRouteName="Jobs">
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
      onBack={() => navigation.goBack()}
      onSaveJob={async (targetJob) => {
        try {
          await session.toggleSavedJob(targetJob || job);
        } catch (error) {
          toast.error(error?.message || 'Failed to update saved jobs.');
        }
      }}
      onMessageEmployer={({ userId, userName, jobId }) => {
        if (!userId) return;
        session.setInitialWorkerChatTarget({ id: String(userId), name: userName || 'Employer', jobId: jobId ? String(jobId) : undefined });
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
      onMessageEmployer={({ userId, userName, jobId }) => {
        if (!userId) return;
        session.setInitialWorkerChatTarget({ id: String(userId), name: userName || 'Employer', jobId: jobId ? String(jobId) : undefined });
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
    const destination = resolveNotificationDestination(item);
    if (destination === 'applications') navigation.navigate('WorkerAppliedJobs');
    else if (destination === 'messages') workerTabPress('Messages');
    else if (destination === 'wallet') workerTabPress('EWallet');
    else if (destination === 'support') navigation.navigate('WorkerSupport');
    else if (destination === 'settings') navigation.navigate('WorkerSettings');
  };
  return (
    <NotificationsInbox
      activeTab="Jobs"
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
      onNavigateWithdrawals={() => navigation.navigate('WorkerTabs', { screen: 'EWallet' })}
      onNavigateMfa={() => navigation.navigate('WorkerMfa')}
      onNavigateAbout={() => navigation.navigate('WorkerAbout')}
      onNavigateDeleteAccount={() => navigation.navigate('WorkerDeleteAccount')}
      onNavigateSupport={() => navigation.navigate('WorkerSupport')}
      currentRole="worker"
      canSwitchAccountMode={session.canSwitchAccountMode}
      onSwitchAccountMode={session.switchViewMode}
      isSwitchingAccountMode={session.isSwitchingViewMode}
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

export default WorkerStackNavigator;
