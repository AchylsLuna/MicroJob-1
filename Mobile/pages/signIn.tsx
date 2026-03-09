import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, asObject } from '../lib/api';

export default function SignIn({
  onBack,
  onNavigateToSignUp,
  onNavigateToForgot,
  onNavigateToVerify,
  onLogin,
}: {
  onBack: () => void;
  onNavigateToSignUp?: () => void;
  onNavigateToForgot?: () => void;
  onNavigateToVerify?: () => void;
  onLogin?: () => void;
}) {
  const ROLE_REQUIRING_LOGIN_OTP = new Set(['hire', 'work', 'both', 'employer', 'worker']);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const shouldRequireOtpForRole = (user: any) => {
    const role = String(user?.role || '').toLowerCase();
    return ROLE_REQUIRING_LOGIN_OTP.has(role);
  };

  const sendLoginOtp = async (emailAddress: string) => {
    const normalizedEmail = String(emailAddress || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('No email found for OTP verification.');
    }

    const result = await apiRequest(`${API_URL}/auth/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: normalizedEmail }),
    }, 'Unable to send OTP.');

    if (!result.ok) {
      throw new Error(`${result.message || 'Unable to send OTP.'} (HTTP ${result.status})`);
    }

    await AsyncStorage.setItem('pending_verification_email', normalizedEmail);
    await AsyncStorage.setItem('pending_verification_skip_send', '1');
  };

  const continueAfterPrimaryAuth = async (token: string, user: any) => {
    if (!token || !user) {
      throw new Error('Invalid login response.');
    }

    if (shouldRequireOtpForRole(user)) {
      setRequiresMfa(false);
      setMfaToken('');
      setMfaCode('');
      await sendLoginOtp(user?.email || email);
      Alert.alert('OTP Required', 'Enter the 6-digit code sent to your email to finish login.', [
        {
          text: 'Continue',
          onPress: () => onNavigateToVerify?.(),
        },
      ]);
      return;
    }

    await completeLogin(token, user);
  };

  const completeLogin = async (token: string, user: any) => {
    await AsyncStorage.setItem('auth_token', token);
    if (user) {
      await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    }
    await AsyncStorage.setItem('has_onboarded', 'true');
    setRequiresMfa(false);
    setMfaToken('');
    setMfaCode('');
    Alert.alert('Success', 'Login successful!');
    onLogin?.();
  };

  const handleSignIn = async () => {
    // Validation
    const loginInput = email.trim();
    if (!loginInput) {
      Alert.alert('Error', 'Please enter your email, username, or phone number');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const phoneDigits = loginInput.replace(/\D/g, '');
      const normalizedPhone = phoneDigits.startsWith('63') && phoneDigits.length === 12
        ? `0${phoneDigits.slice(2)}`
        : phoneDigits;
      const isPhoneLogin = /^\d{11}$/.test(normalizedPhone);
      const requestBody: Record<string, string> = { password };

      if (isPhoneLogin) {
        requestBody.phoneNumber = normalizedPhone;
      } else {
        requestBody.emailOrUsername = loginInput.includes('@')
          ? loginInput.toLowerCase()
          : loginInput;
      }

      const result = await apiRequest(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, 'Unable to sign in.');

      const responseData = asObject<any>(result.data) || {};
      const responseRaw = asObject<any>(result.raw) || {};
      const token = responseData?.token || responseRaw?.token;
      const user = responseData?.user || responseRaw?.user;
      const nextMfaRequired = Boolean(responseData?.mfaRequired || responseRaw?.mfaRequired);
      const nextMfaToken = responseData?.mfaToken || responseRaw?.mfaToken;

      if (result.ok && nextMfaRequired && nextMfaToken) {
        setRequiresMfa(true);
        setMfaToken(nextMfaToken);
        setMfaCode('');
        Alert.alert('MFA Required', 'Enter your authenticator or backup code to continue.');
      } else if (result.ok && token) {
        await continueAfterPrimaryAuth(token, user);
      } else {
        const serverMessage = result.message || 'Unable to sign in.';
        if (result.status === 401 && /verify your email/i.test(serverMessage)) {
          const normalizedEmail = loginInput.includes('@') ? loginInput.toLowerCase() : '';
          if (normalizedEmail) {
            await AsyncStorage.setItem('pending_verification_email', normalizedEmail);
          }
          Alert.alert(
            'Email verification required',
            serverMessage,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Verify now', onPress: () => onNavigateToVerify?.() },
            ]
          );
        } else if (result.status === 401 && /invalid credentials/i.test(serverMessage)) {
          Alert.alert('Error', 'Invalid credentials. Check your email/phone/username and password.');
        } else {
          Alert.alert('Error', `${serverMessage} (HTTP ${result.status})`);
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Error', error?.message || 'Network error. Please check your connection and server status.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!requiresMfa || !mfaToken) {
      Alert.alert('Error', 'Start sign in first.');
      return;
    }
    if (!mfaCode.trim()) {
      Alert.alert('Error', 'Enter your MFA code.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiRequest(`${API_URL}/auth/login/mfa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mfaToken,
          code: mfaCode.trim(),
        }),
      }, 'Unable to verify MFA.');

      const responseData = asObject<any>(result.data) || {};
      const responseRaw = asObject<any>(result.raw) || {};
      const token = responseData?.token || responseRaw?.token;
      const user = responseData?.user || responseRaw?.user;

      if (result.ok && token) {
        await continueAfterPrimaryAuth(token, user);
        return;
      }

      Alert.alert('Error', `${result.message || 'Invalid MFA code.'} (HTTP ${result.status})`);
    } catch (error) {
      Alert.alert('Error', 'Network error while verifying MFA.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      {/* Card */}
      <View style={styles.card}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>💼</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {/* Login Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputIcon}>📧</Text>
          <TextInput
            style={styles.input}
            placeholder="Email, Username, or Phone"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password Input */}
        <View style={styles.passwordContainer}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="password"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {requiresMfa ? (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>🔐</Text>
              <TextInput
                style={styles.input}
                placeholder="Authenticator / Backup Code"
                placeholderTextColor="#999"
                value={mfaCode}
                onChangeText={setMfaCode}
                autoCapitalize="characters"
              />
            </View>
            <Text style={styles.mfaHelpText}>
              MFA is enabled for this account. Enter a valid code to continue.
            </Text>
          </>
        ) : (
          <TouchableOpacity style={styles.forgotContainer} onPress={onNavigateToForgot}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {/* Sign In Button */}
        <TouchableOpacity 
          style={[styles.signInButton, isLoading && styles.signInButtonDisabled]} 
          onPress={requiresMfa ? handleVerifyMfa : handleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signInButtonText}>{requiresMfa ? 'Verify MFA' : 'Sign in'}</Text>
          )}
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <TouchableOpacity onPress={onNavigateToSignUp}>
            <Text style={styles.signUpLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a2847',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    width: 80,
    height: 80,
    backgroundColor: '#0a2847',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000',
  },
  eyeIcon: {
    fontSize: 18,
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    fontSize: 13,
    color: '#0066cc',
    fontWeight: '600',
  },
  mfaHelpText: {
    width: '100%',
    fontSize: 12,
    color: '#475569',
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: '#0a2847',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 13,
    color: '#666',
  },
  signUpLink: {
    fontSize: 13,
    color: '#0066cc',
    fontWeight: '600',
  },
});
