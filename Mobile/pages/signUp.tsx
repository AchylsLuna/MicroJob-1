import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { apiRequest } from '../lib/api';
import { AUTH_COLORS, clamp } from '../theme/authTheme';
import { useToast } from '../contexts/ToastContext';

const SIGNUP_COLORS = {
  background: AUTH_COLORS.background,
  backButton: AUTH_COLORS.tileSoft,
  title: AUTH_COLORS.textPrimary,
  subtitle: AUTH_COLORS.textSecondary,
  inputBackground: AUTH_COLORS.inputDark,
  inputBorder: AUTH_COLORS.inputDarkBorder,
  inputText: AUTH_COLORS.inputTextDark,
  placeholder: AUTH_COLORS.placeholderDark,
  mutedIcon: AUTH_COLORS.placeholderDark,
  eyeIcon: AUTH_COLORS.textMuted,
  roleCardBackground: 'rgba(255,255,255,0.05)',
  roleCardBorder: 'rgba(255,255,255,0.12)',
  roleCardActiveBackground: 'rgba(27,79,216,0.15)',
  roleCardActiveBorder: AUTH_COLORS.primary,
  roleCardActiveText: AUTH_COLORS.primary,
  cta: AUTH_COLORS.primary,
  ctaText: AUTH_COLORS.primaryText,
  loginText: AUTH_COLORS.textTertiary,
  loginLink: AUTH_COLORS.linkLight,
  secure: AUTH_COLORS.success,
} as const;

type Role = 'hire' | 'work' | 'both';

type Props = {
  onBack: () => void;
  onNavigateToSignIn: () => void;
  onNavigateToVerify: () => void;
};

const ROLE_OPTIONS: Array<{
  label: string;
  value: Role;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { label: 'Hire', value: 'hire', icon: 'briefcase' },
  { label: 'Work', value: 'work', icon: 'user' },
  { label: 'Both', value: 'both', icon: 'users' },
];

const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

const isStrongPassword = (value: string) =>
  value.length >= 8 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

const parseFullName = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(' ');
  if (parts.length < 2) {
    return null;
  }

  const [firstName, ...lastNameParts] = parts;
  const lastName = lastNameParts.join(' ').trim();

  if (!firstName || !lastName) {
    return null;
  }

  return { normalized, firstName, lastName };
};

const sanitizePhoneInput = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.startsWith('63')) {
    return digitsOnly.slice(0, 12);
  }
  return digitsOnly.slice(0, 11);
};

const normalizePhilippineMobile = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) {
    return digits;
  }
  if (/^639\d{9}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }
  return null;
};

type PasswordRule = { label: string; passes: boolean };
type StrengthLevel = { label: string; color: string; segments: number };

const getPasswordRules = (password: string, confirmPassword: string): PasswordRule[] => [
  { label: 'At least 8 characters', passes: password.length >= 8 },
  { label: 'At least 1 uppercase letter (A-Z)', passes: /[A-Z]/.test(password) },
  { label: 'At least 1 lowercase letter (a-z)', passes: /[a-z]/.test(password) },
  { label: 'At least 1 number (0-9)', passes: /[0-9]/.test(password) },
  { label: 'At least 1 special character', passes: /[^A-Za-z0-9]/.test(password) },
  { label: 'Passwords match', passes: password.length > 0 && password === confirmPassword },
];

const getStrength = (passCount: number): StrengthLevel => {
  if (passCount <= 2) return { label: 'Weak', color: '#F97316', segments: 1 };
  if (passCount <= 4) return { label: 'Fair', color: '#EAB308', segments: 2 };
  if (passCount === 5) return { label: 'Good', color: '#22C55E', segments: 3 };
  return { label: 'Strong', color: '#16A34A', segments: 4 };
};

export default function SignUp({ onBack, onNavigateToSignIn, onNavigateToVerify }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const horizontalPadding = clamp(screenWidth * 0.052, 18, 24);
  const topPadding = Math.max(insets.top, 10) + clamp(screenHeight * 0.04, 18, 28);
  const backButtonSize = clamp(screenWidth * 0.12, 40, 44);
  const backIconSize = clamp(screenWidth * 0.056, 20, 22);
  const titleFontSize = clamp(screenWidth * 0.104, 34, 40);
  const subtitleFontSize = clamp(screenWidth * 0.04, 15, 16);
  const inputHeight = clamp(screenHeight * 0.068, 50, 58);
  const inputRadius = clamp(inputHeight * 0.24, 12, 14);
  const inputFontSize = clamp(screenWidth * 0.04, 14, 15);
  const fieldIconSize = clamp(screenWidth * 0.049, 18, 20);
  const eyeIconSize = fieldIconSize;
  const optionIconSize = clamp(screenWidth * 0.06, 20, 24);
  const roleCardMinHeight = clamp(screenHeight * 0.098, 74, 84);
  const roleCardRadius = clamp(roleCardMinHeight * 0.19, 14, 16);
  const roleLabelSize = clamp(screenWidth * 0.04, 14, 15);
  const buttonHeight = clamp(screenHeight * 0.068, 50, 58);
  const buttonRadius = clamp(buttonHeight * 0.23, 12, 14);
  const buttonFontSize = clamp(screenWidth * 0.043, 15, 16);
  const helperFontSize = clamp(screenWidth * 0.039, 13, 14);
  const contentMaxWidth = Math.min(440, screenWidth - horizontalPadding * 2);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('work');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const passwordRules = useMemo(
    () => getPasswordRules(password, confirmPassword),
    [password, confirmPassword]
  );
  const passCount = passwordRules.filter((rule) => rule.passes).length;
  const strength = getStrength(passCount);

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(sanitizePhoneInput(value));
  };

  const handleSignUp = async () => {
    const parsedName = parseFullName(fullName);
    if (!parsedName) {
      toast.error('Please enter your full name (first and last name).');
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      toast.error('Please enter your email.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    const normalizedPhone = normalizePhilippineMobile(phoneNumber);
    if (!normalizedPhone) {
      toast.error('Please enter a valid Philippine mobile number (09XXXXXXXXX).');
      return;
    }

    if (!password) {
      toast.error('Please enter a password.');
      return;
    }

    if (!isStrongPassword(password)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiRequest(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: parsedName.normalized,
          firstName: parsedName.firstName,
          lastName: parsedName.lastName,
          email: normalizedEmail,
          phoneNumber: normalizedPhone || undefined,
          password,
          role: selectedRole,
        }),
      }, 'Registration failed.');

      if (result.ok) {
        await AsyncStorage.setItem('pending_verification_email', normalizedEmail);
        toast.success('Account created! Please verify your email.');
        onNavigateToVerify();
      } else {
        toast.error(`${result.message || 'Registration failed'} (HTTP ${result.status})`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Network error. Please check your connection and server status.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: topPadding,
            paddingBottom: 24 + Math.max(insets.bottom, 10),
            maxWidth: contentMaxWidth,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              width: backButtonSize,
              height: backButtonSize,
              borderRadius: clamp(backButtonSize * 0.29, 14, 16),
            },
          ]}
          onPress={onBack}
        >
          <Feather name="arrow-left" size={backIconSize} color={SIGNUP_COLORS.ctaText} />
        </TouchableOpacity>

        <Text
          allowFontScaling={false}
          style={[styles.title, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.18) }]}
        >
          Start your Journey
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.subtitle, { fontSize: subtitleFontSize, lineHeight: Math.round(subtitleFontSize * 1.4) }]}
        >
          Create an account to get started
        </Text>

        <View style={[styles.inputContainer, { minHeight: inputHeight, borderRadius: inputRadius }]}>
          <Feather name="user" size={fieldIconSize} color={SIGNUP_COLORS.mutedIcon} />
          <TextInput
            style={[styles.input, { fontSize: inputFontSize }]}
            placeholder="Full Name"
            placeholderTextColor={SIGNUP_COLORS.placeholder}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <View style={[styles.inputContainer, { minHeight: inputHeight, borderRadius: inputRadius }]}>
          <Feather name="mail" size={fieldIconSize} color={SIGNUP_COLORS.mutedIcon} />
          <TextInput
            style={[styles.input, { fontSize: inputFontSize }]}
            placeholder="Email"
            placeholderTextColor={SIGNUP_COLORS.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={[styles.inputContainer, { minHeight: inputHeight, borderRadius: inputRadius }]}>
          <Feather name="phone" size={fieldIconSize} color={SIGNUP_COLORS.mutedIcon} />
          <TextInput
            style={[styles.input, { fontSize: inputFontSize }]}
            placeholder="Phone Number"
            placeholderTextColor={SIGNUP_COLORS.placeholder}
            value={phoneNumber}
            onChangeText={handlePhoneNumberChange}
            keyboardType="number-pad"
            maxLength={12}
            returnKeyType="next"
          />
        </View>

        <View style={[styles.inputContainer, { minHeight: inputHeight, borderRadius: inputRadius }]}>
          <Feather name="lock" size={fieldIconSize} color={SIGNUP_COLORS.mutedIcon} />
          <TextInput
            style={[styles.input, { fontSize: inputFontSize }]}
            placeholder="Password"
            placeholderTextColor={SIGNUP_COLORS.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={eyeIconSize} color={SIGNUP_COLORS.eyeIcon} />
          </TouchableOpacity>
        </View>

        <View style={[styles.inputContainer, { minHeight: inputHeight, borderRadius: inputRadius }]}>
          <Feather name="lock" size={fieldIconSize} color={SIGNUP_COLORS.mutedIcon} />
          <TextInput
            style={[styles.input, { fontSize: inputFontSize }]}
            placeholder="Confirm Password"
            placeholderTextColor={SIGNUP_COLORS.placeholder}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)}>
            <Feather
              name={showConfirmPassword ? 'eye-off' : 'eye'}
              size={eyeIconSize}
              color={SIGNUP_COLORS.eyeIcon}
            />
          </TouchableOpacity>
        </View>

        {password ? (
          <View style={styles.strengthCard}>
            <View style={styles.strengthHeader}>
              <Text allowFontScaling={false} style={[styles.strengthTitle, { fontSize: helperFontSize }]}>
                Password Strength
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.strengthLabel, { color: strength.color, fontSize: helperFontSize }]}
              >
                {strength.label}
              </Text>
            </View>
            <View style={styles.strengthBars}>
              {Array.from({ length: 4 }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor:
                        index < strength.segments ? strength.color : 'rgba(255,255,255,0.1)',
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.ruleList}>
              {passwordRules.map((rule) => (
                <View key={rule.label} style={styles.ruleRow}>
                  <View
                    style={[
                      styles.ruleIconWrap,
                      {
                        borderColor: rule.passes ? SIGNUP_COLORS.secure : 'rgba(255,255,255,0.25)',
                      },
                    ]}
                  >
                    <Feather
                      name={rule.passes ? 'check' : 'x'}
                      size={10}
                      color={rule.passes ? SIGNUP_COLORS.secure : 'rgba(255,255,255,0.3)'}
                    />
                  </View>
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.ruleText,
                      {
                        fontSize: helperFontSize,
                        color: rule.passes ? SIGNUP_COLORS.secure : 'rgba(255,255,255,0.45)',
                      },
                    ]}
                  >
                    {rule.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text allowFontScaling={false} style={[styles.roleLabel, { fontSize: roleLabelSize }]}>
          I want to:
        </Text>
        <View style={styles.roleContainer}>
          {ROLE_OPTIONS.map((role) => {
            const isActive = selectedRole === role.value;
            return (
              <TouchableOpacity
                key={role.value}
                style={[
                  styles.roleCard,
                  { minHeight: roleCardMinHeight, borderRadius: roleCardRadius },
                  isActive && styles.roleCardActive,
                ]}
                onPress={() => setSelectedRole(role.value)}
              >
                <Feather
                  name={role.icon}
                  size={optionIconSize}
                  color={isActive ? SIGNUP_COLORS.roleCardActiveText : SIGNUP_COLORS.mutedIcon}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.roleText, { fontSize: helperFontSize }, isActive && styles.roleTextActive]}
                >
                  {role.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { minHeight: buttonHeight, borderRadius: buttonRadius },
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleSignUp}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text allowFontScaling={false} style={[styles.primaryButtonText, { fontSize: buttonFontSize }]}>
              SIGN UP
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text allowFontScaling={false} style={[styles.loginText, { fontSize: helperFontSize }]}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={onNavigateToSignIn}>
            <Text allowFontScaling={false} style={[styles.loginLink, { fontSize: helperFontSize }]}>
              Log In
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.secureRow}>
          <Feather name="shield" size={fieldIconSize} color={SIGNUP_COLORS.secure} />
          <Text allowFontScaling={false} style={[styles.secureText, { fontSize: clamp(helperFontSize * 0.88, 14, 16) }]}>
            Your information is secure and encrypted
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SIGNUP_COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SIGNUP_COLORS.backButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
    color: SIGNUP_COLORS.title,
    marginBottom: 8,
    maxWidth: 300,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: SIGNUP_COLORS.subtitle,
    fontWeight: '400',
    marginBottom: 28,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    backgroundColor: SIGNUP_COLORS.inputBackground,
    borderWidth: 1,
    borderColor: SIGNUP_COLORS.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    color: SIGNUP_COLORS.inputText,
    fontSize: 15,
    fontWeight: '400',
  },
  strengthCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strengthTitle: {
    color: SIGNUP_COLORS.title,
    fontWeight: '600',
  },
  strengthLabel: {
    fontWeight: '700',
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  ruleList: {
    gap: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ruleIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ruleText: {
    fontWeight: '400',
  },
  roleLabel: {
    color: SIGNUP_COLORS.title,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 10,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  roleCard: {
    width: '31.5%',
    minHeight: 80,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: SIGNUP_COLORS.roleCardBorder,
    backgroundColor: SIGNUP_COLORS.roleCardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardActive: {
    borderColor: SIGNUP_COLORS.roleCardActiveBorder,
    backgroundColor: SIGNUP_COLORS.roleCardActiveBackground,
  },
  roleText: {
    color: SIGNUP_COLORS.placeholder,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
  roleTextActive: {
    color: SIGNUP_COLORS.roleCardActiveText,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: SIGNUP_COLORS.cta,
    borderRadius: 14,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SIGNUP_COLORS.cta,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    marginBottom: 18,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: SIGNUP_COLORS.ctaText,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  loginText: {
    color: SIGNUP_COLORS.loginText,
    fontSize: 14,
    fontWeight: '400',
  },
  loginLink: {
    color: SIGNUP_COLORS.loginLink,
    fontSize: 14,
    fontWeight: '600',
  },
  secureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secureText: {
    marginLeft: 6,
    color: SIGNUP_COLORS.secure,
    fontSize: 13,
    fontWeight: '400',
  },
});
