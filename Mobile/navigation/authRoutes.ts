export type VerificationMode = 'emailVerification' | 'loginOtp' | 'passwordReset';

export type AuthStackParamList = {
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  VerifyEmail: { mode: VerificationMode; email?: string; otpToken?: string; origin?: 'signup' | 'signin' | 'forgot' };
  ForgotPassword: undefined;
  CreatePass: { email: string; code: string };
  PassChanged: undefined;
};
