import { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';
import { apiRequest } from '../lib/api';
import OnboardingCarouselScreen from '../pages/OnboardingCarouselScreen';
import SignIn from '../pages/signIn';
import SignUp from '../pages/signUp';
import VerifyEmail from '../pages/verifyEmail';
import ForgotPass from '../pages/forgotPass';
import CreatePass from '../pages/createPass';
import PassChanged from '../pages/passChanged';
import LegalDocument from '../pages/legalDocument';
import GuestJobs from '../pages/GuestJobs';
import JobDetails from '../pages/worker/JobDetails';
import { isLegalDocId } from '../lib/legalDocuments';
import { useAppSession } from '../contexts/AppSessionContext';
import { useToast } from '../contexts/ToastContext';
import { stackMotion } from './options';

const AuthStack = createNativeStackNavigator();

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
      onNavigateToGuestBrowse={() => navigation.navigate('GuestJobs')}
      onLogin={async () => {
        await handleAuthSuccess();
      }}
    />
  );
}

function GuestJobsScreen() {
  const navigation = useNavigation();
  return (
    <GuestJobs
      onViewDetails={(job) => navigation.navigate('GuestJobDetails', { job })}
      onNavigateToSignIn={() => navigation.navigate('SignIn')}
      onNavigateToSignUp={() => navigation.navigate('SignUp')}
    />
  );
}

function GuestJobDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const job = route.params?.job || null;
  return (
    <JobDetails
      job={job}
      onBack={() => navigation.goBack()}
      onRequireSignIn={() => navigation.navigate('SignIn')}
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
      onNavigateToLegal={(docId) => navigation.navigate('LegalDocument', { docId })}
    />
  );
}

function LegalDocumentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const routeParams = route?.params || {};
  return (
    <LegalDocument
      initialDocId={isLegalDocId(routeParams.docId) ? routeParams.docId : 'terms'}
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'SignUp' }] })}
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
          // The server answers identically whether or not the address is
          // registered, so there is no "account not found" case to branch on.
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
      <AuthStack.Screen name="LegalDocument" component={LegalDocumentScreen} />
      <AuthStack.Screen name="GuestJobs" component={GuestJobsScreen} />
      <AuthStack.Screen name="GuestJobDetails" component={GuestJobDetailsScreen} />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="CreatePass" component={CreatePassScreen} />
      <AuthStack.Screen name="PassChanged" component={PassChangedScreen} />
    </AuthStack.Navigator>
  );
}

export default AuthNavigator;
