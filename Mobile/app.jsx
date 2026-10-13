import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNavigationContainerRef, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from './theme/tokens';
import AuthNavigator from './navigation/AuthStack';
import WorkerStackNavigator from './navigation/WorkerStack';
import EmployerStackNavigator from './navigation/EmployerStack';
import { AppSessionProvider, useAppSession } from './contexts/AppSessionContext';
import ErrorBoundary from './components/ErrorBoundary';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { startQueryClientBridge } from './lib/queryClientBridge';
import { ToastProvider } from './contexts/ToastContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import './i18n';
import { StatusBar } from 'expo-status-bar';
import LaunchScreen from './components/LaunchScreen';
import { resolveNotificationDestination } from './lib/notifications';

const navigationRef = createNavigationContainerRef();

const resetLinkPrefixes = ['microjobs://', 'https://micro-jobs.online'];

const parseResetLinkUrl = (linkUrl) => {
  if (!linkUrl) return null;

  try {
    const parsed = new URL(linkUrl);
    const path = String(parsed.pathname || '').replace(/\/+$/, '');
    const hasResetPath = path === '/reset-password' || path === 'reset-password';
    if (!hasResetPath) return null;
    const code = parsed.searchParams.get('code') || parsed.searchParams.get('otp') || parsed.searchParams.get('token') || '';
    const email = parsed.searchParams.get('email') || parsed.searchParams.get('user') || '';
    if (!code && !email) return null;
    return { code, email };
  } catch (error) {
    return null;
  }
};






function AppNavigator() {
  const session = useAppSession();

  if (!session.isReady) {
    return <View style={{ flex: 1, backgroundColor: tokens.colors.brand }} />;
  }

  if (session.bootstrapIssue) {
    return <ApiConnectionScreen session={session} />;
  }

  return session.isAuthenticated
    ? (session.viewMode === 'employer' && session.canAccessEmployer ? <EmployerStackNavigator key="employer-mode" /> : <WorkerStackNavigator key="worker-mode" />)
    : <AuthNavigator />;
}

function ApiConnectionScreen({ session }) {
  const issue = session.bootstrapIssue;
  return (
    <View style={styles.connectionScreen} accessibilityRole="alert">
      <View style={styles.connectionIcon}>
        <Ionicons name={issue?.kind === 'environment-mismatch' ? 'git-compare-outline' : 'cloud-offline-outline'} size={34} color={tokens.colors.brand} />
      </View>
      <Text style={styles.connectionTitle}>{issue?.title || 'Unable to connect'}</Text>
      <Text style={styles.connectionMessage}>{issue?.message}</Text>
      <View style={styles.connectionDetails}>
        <Text style={styles.connectionLabel}>Mobile API</Text>
        <Text selectable style={styles.connectionValue}>{session.apiDiagnostics.apiUrl}</Text>
        <Text style={styles.connectionLabel}>Configuration</Text>
        <Text style={styles.connectionValue}>{session.apiDiagnostics.source} · port {session.apiDiagnostics.port}</Text>
        {session.apiDiagnostics.databaseId ? <Text style={styles.connectionValue}>Database {session.apiDiagnostics.databaseId} · {session.apiDiagnostics.environmentId}</Text> : null}
      </View>
      <TouchableOpacity style={styles.connectionRetry} onPress={() => void session.retryBootstrap()} accessibilityRole="button">
        <Ionicons name="refresh" size={19} color={tokens.colors.white} />
        <Text style={styles.connectionRetryText}>Retry connection</Text>
      </TouchableOpacity>
      {issue?.kind === 'environment-mismatch' ? (
        <TouchableOpacity style={styles.connectionSecondary} onPress={() => void session.resetSessionForCurrentApi()} accessibilityRole="button">
          <Text style={styles.connectionSecondaryText}>Sign in to this server</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.connectionHint}>For Expo Go, start web/API with `npm run dev`, then connect the phone to the same Wi-Fi network.</Text>
    </View>
  );
}

function SessionOverlays() {
  const session = useAppSession();
  const insets = useSafeAreaInsets();

  return (
    <>
      {session.showLogoutModal ? (
        <View style={styles.logoutOverlay} accessibilityViewIsModal>
          <TouchableOpacity
            style={styles.logoutBackdrop}
            onPress={session.closeLogoutConfirm}
            accessibilityRole="button"
            accessibilityLabel="Close sign out confirmation"
          />
          <View style={[styles.logoutCard, { paddingBottom: Math.max(insets.bottom, 18) + 18 }]} accessibilityRole="alert">
            <TouchableOpacity
              style={styles.logoutClose}
              onPress={session.closeLogoutConfirm}
              accessibilityRole="button"
              accessibilityLabel="Close sign out confirmation"
            >
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
              <TouchableOpacity
                style={styles.logoutPrimary}
                onPress={() => void session.logout()}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
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
  const language = useLanguage();
  const [showLaunch, setShowLaunch] = useState(true);
  const [navigationReady, setNavigationReady] = useState(false);
  // Bumped by the error boundary's "Try again": changing the key remounts the
  // NavigationContainer, which is the only way to actually clear a crashed
  // screen on native. Without it the boundary re-renders the same broken
  // subtree and throws again immediately.
  const [navigatorGeneration, setNavigatorGeneration] = useState(0);
  const navigationTheme = useMemo(() => ({
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: tokens.colors.signedInCanvas, primary: tokens.colors.brand, card: tokens.colors.contentSurface },
  }), []);
  const linking = useMemo(() => ({
    prefixes: resetLinkPrefixes,
    config: {
      screens: {
        CreatePass: 'reset-password',
        ForgotPassword: 'forgot-password',
        SignIn: 'sign-in',
        SignUp: 'sign-up',
      },
    },
  }), []);

  const handleResetDeepLink = useCallback((deepLinkUrl) => {
    const parsed = parseResetLinkUrl(deepLinkUrl);
    if (!parsed) return;

    const resetParams = { email: parsed.email || '', code: parsed.code || '' };
    if (!resetParams.email && !resetParams.code) return;

    try {
      if (navigationRef.isReady()) {
        navigationRef.navigate('CreatePass', resetParams);
      }
    } catch (error) {
      navigationRef.reset({ index: 0, routes: [{ name: 'SignIn' }, { name: 'CreatePass', params: resetParams }] });
    }
  }, []);

  useEffect(() => {
    const onUrl = ({ url }) => {
      if (url) handleResetDeepLink(url);
    };

    const subscription = Linking.addEventListener('url', onUrl);
    let isMounted = true;

    Linking.getInitialURL().then((initialUrl) => {
      if (!isMounted || !initialUrl) return;
      handleResetDeepLink(initialUrl);
    }).catch(() => undefined);

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [handleResetDeepLink]);

  React.useEffect(() => {
    const data = session.pendingNotificationData;
    if (!data || !session.isReady || !session.isAuthenticated || !navigationReady || !navigationRef.isReady()) return;
    const audience = String(data.audience || 'shared').toLowerCase();
    const destination = resolveNotificationDestination(data);
    const targetMode = audience === 'employer' ? 'employer' : audience === 'worker' ? 'worker' : session.viewMode;
    if (targetMode !== session.viewMode && session.canSwitchAccountMode) {
      void session.switchViewMode(targetMode);
      return;
    }
    const employer = session.viewMode === 'employer';
    const entityId = String(data.entityId || '');
    const conversationId = String(data.conversationId || data.senderId || data.participantId || '');
    if (destination === 'messages') {
      if (employer) session.setInitialEmployerChatTarget(conversationId ? { id: conversationId } : null);
      else session.setInitialWorkerChatTarget(conversationId ? { id: conversationId } : null);
      navigationRef.navigate(employer ? 'EmployerTabs' : 'WorkerTabs', { screen: 'Messages' });
    } else if (destination === 'applications') {
      navigationRef.navigate(employer ? 'EmployerTabs' : 'WorkerAppliedJobs', employer ? { screen: 'Applications', params: { applicationId: entityId } } : { applicationId: entityId });
    } else if (destination === 'wallet') {
      navigationRef.navigate(employer ? 'EmployerEWallet' : 'WorkerTabs', employer ? { invoiceRequestId: entityId } : { screen: 'EWallet' });
    } else if (destination === 'support') {
      navigationRef.navigate(employer ? 'EmployerSupport' : 'WorkerSupport', { ticketId: entityId });
    } else if (destination === 'settings') {
      navigationRef.navigate(employer ? 'EmployerSettings' : 'WorkerSettings');
    } else {
      navigationRef.navigate(employer ? 'EmployerNotifications' : 'WorkerNotifications');
    }
    session.consumePendingNotification();
  }, [navigationReady, session.pendingNotificationData, session.isReady, session.isAuthenticated, session.viewMode, session.canSwitchAccountMode]);
  return (
    <View
      style={{ flex: 1, overflow: 'hidden', backgroundColor: tokens.colors.signedInCanvas }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={() => session.registerActivity()}
      onResponderMove={() => session.registerActivity()}
      onTouchStart={() => session.registerActivity()}
    >
      <StatusBar style="dark" />
      <ErrorBoundary
        onReset={() => {
          setNavigationReady(false);
          setNavigatorGeneration((generation) => generation + 1);
        }}
      >
        <NavigationContainer key={navigatorGeneration} ref={navigationRef} theme={navigationTheme} linking={linking} onReady={() => setNavigationReady(true)} onStateChange={() => session.registerActivity()}>

          <AppNavigator />
        </NavigationContainer>
      </ErrorBoundary>
      <SessionOverlays />
      {showLaunch ? <LaunchScreen sessionReady={session.isReady && language.isReady} onFinished={() => setShowLaunch(false)} /> : null}
    </View>
  );
}

export default function App() {
  // Forwards every dataRefresh event into the query cache, so screens migrated
  // to TanStack Query invalidate off the same signal the legacy consumers use.
  useEffect(() => startQueryClientBridge(), []);

  return (
    <LanguageProvider>
      <SafeAreaProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <AppSessionProvider>
              <RootApp />
            </AppSessionProvider>
          </QueryClientProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  connectionScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: tokens.colors.background },
  connectionIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brandSoft },
  connectionTitle: { marginTop: 20, color: tokens.colors.brandDark, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  connectionMessage: { maxWidth: 520, marginTop: 10, color: tokens.colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  connectionDetails: { width: '100%', maxWidth: 520, marginTop: 22, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceMuted },
  connectionLabel: { marginTop: 4, color: tokens.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  connectionValue: { marginTop: 3, marginBottom: 8, color: tokens.colors.brandDark, fontSize: 12, fontWeight: '700' },
  connectionRetry: { minHeight: 52, marginTop: 18, paddingHorizontal: 22, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: tokens.colors.brand },
  connectionRetryText: { color: tokens.colors.white, fontSize: 15, fontWeight: '800' },
  connectionSecondary: { minHeight: 48, marginTop: 10, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1, borderColor: tokens.colors.brand, alignItems: 'center', justifyContent: 'center' },
  connectionSecondaryText: { color: tokens.colors.brand, fontSize: 14, fontWeight: '800' },
  connectionHint: { maxWidth: 500, marginTop: 14, color: tokens.colors.textSubtle, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  logoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  logoutBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  logoutCard: {
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
  },
  logoutClose: {
    position: 'absolute',
    right: 20,
    top: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
  },
  logoutIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  logoutTitle: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: '800',
    color: tokens.colors.text,
  },
  logoutSubtitle: {
    marginTop: 10,
    fontSize: 15,
    color: tokens.colors.textMuted,
    textAlign: 'center',
  },
  logoutActions: {
    marginTop: 28,
    width: '100%',
    flexDirection: 'row',
    gap: 14,
  },
  logoutSecondary: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutSecondaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.text,
  },
  logoutPrimary: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.onBrand,
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
