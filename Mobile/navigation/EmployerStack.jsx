import { useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import EmployerJobPosts from '../pages/employer/EmployerJobPosts';
import EmployerPostJob from '../pages/employer/EmployerPostJob';
import EmployerApplications from '../pages/employer/EmployerApplications';
import EmployerProfile from '../pages/employer/EmployerProfile';
import EmployerEWallet from '../pages/employer/EmployerEWallet';
import EmployerNotifications from '../pages/employer/EmployerNotifications';
import EmployerInbox from '../pages/employer/EmployerInbox';
import EmployerPaymentMethods from '../pages/employer/EmployerPaymentMethods';
import Settings from '../pages/worker/Settings';
import PersonalInformation from '../pages/worker/PersonalInformation';
import LocationServices from '../pages/worker/LocationServices';
import MFA from '../pages/worker/MFA';
import About from '../pages/worker/About';
import DeleteAccount from '../pages/worker/DeleteAccount';
import ChangePassword from '../pages/worker/ChangePassword';
import ContactSupport from '../pages/worker/ContactSupport';
import { useAppSession } from '../contexts/AppSessionContext';
import { resolveNotificationDestination } from '../lib/notifications';
import { useEmployerTabNavigation } from './useTabNavigation';
import { hiddenTabs, stackMotion } from './options';

const EmployerStack = createNativeStackNavigator();
const EmployerTab = createBottomTabNavigator();

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
      onOpenApplications={() => employerTabPress('Applications')}
      onPostJob={() => employerTabPress('Post Job')}
      onOpenMessages={() => employerTabPress('Messages')}
      onOpenNotifications={() => navigation.navigate('EmployerNotifications')}
      notificationBadgeCount={session.employerNotificationUnreadCount}
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
      onOpenNotifications={() => navigation.navigate('EmployerNotifications')}
      notificationBadgeCount={session.employerNotificationUnreadCount}
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
  const session = useAppSession();
  return (
    <EmployerPostJob
      onPosted={() => navigateToEmployerTab(navigation, 'Home')}
      onOpenWallet={() => navigation.navigate('EmployerEWallet')}
      onOpenProfile={() => navigation.navigate('EmployerAccountInformation', { initialSection: 'profile' })}
      currentUser={session.user}
      jobToEdit={route.params?.jobToEdit || null}
      activeTab="Post Job"
      onTabPress={employerTabPress}
      onOpenNotifications={() => navigation.navigate('EmployerNotifications')}
      notificationBadgeCount={session.employerNotificationUnreadCount}
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
      onOpenNotifications={() => navigation.navigate('EmployerNotifications')}
      notificationBadgeCount={session.employerNotificationUnreadCount}
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
    const destination = resolveNotificationDestination(item);
    if (destination === 'applications') employerTabPress('Applications');
    else if (destination === 'messages') {
      session.setInitialEmployerChatTarget(item.actorId ? { id: item.actorId, name: item.actorName || undefined } : null);
      employerTabPress('Messages');
    }
    else if (destination === 'wallet') navigation.navigate('EmployerEWallet', item?.entityType === 'payment_request' ? { invoiceRequestId: item.entityId } : undefined);
    else if (destination === 'support') navigation.navigate('EmployerSupport');
    else if (destination === 'settings') navigation.navigate('EmployerSettings');
  };
  return <EmployerNotifications onBack={() => navigation.goBack()} liveNotifications={session.employerNotifications} onOpenNotification={openNotification} />;
}

function EmployerProfileScreen() {
  const navigation = useNavigation();
  const employerTabPress = useEmployerTabNavigation();
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
      onNavigateNotifications={() => navigation.navigate('EmployerNotifications')}
      onNavigateLocation={() => navigation.navigate('EmployerLocationServices')}
      onNavigateMfa={() => navigation.navigate('EmployerMfa')}
      onNavigateAbout={() => navigation.navigate('EmployerAbout')}
      onNavigateDeleteAccount={() => navigation.navigate('EmployerDeleteAccount')}
      onNavigateSupport={() => navigation.navigate('EmployerSupport')}
      onNavigatePaymentMethods={() => navigation.navigate('EmployerPaymentMethods')}
      currentRole="employer"
      canSwitchAccountMode={session.canSwitchAccountMode}
      onSwitchAccountMode={session.switchViewMode}
      isSwitchingAccountMode={session.isSwitchingViewMode}
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
  const route = useRoute();
  const employerTabPress = useEmployerTabNavigation();
  const session = useAppSession();
  return (
    <EmployerEWallet
      onBack={() => navigation.goBack()}
      activeTab="Profile"
      onTabPress={employerTabPress}
      initialInvoiceRequestId={route.params?.invoiceRequestId || null}
      onOpenNotifications={() => navigation.navigate('EmployerNotifications')}
      notificationBadgeCount={session.employerNotificationUnreadCount}
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
      <EmployerStack.Screen name="EmployerNotifications" component={EmployerNotificationsScreen} />
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

export default EmployerStackNavigator;
