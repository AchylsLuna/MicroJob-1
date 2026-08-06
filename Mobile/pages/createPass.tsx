import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AUTH_COLORS, clamp } from '../theme/authTheme';
import { useToast } from '../contexts/ToastContext';

type Props = {
  onBackToLogin?: () => void;
  onReset?: (payload: { code: string; password: string; confirm: string }) => void | Promise<void>;
};

export default function CreatePass({ onBackToLogin, onReset }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const fieldHeight = clamp(screenHeight * 0.082, 64, 74);
  const fieldRadius = clamp(fieldHeight * 0.24, 16, 18);
  const fieldIconSize = clamp(screenWidth * 0.056, 20, 22);
  const inputFontSize = clamp(screenWidth * 0.046, 16, 18);
  const buttonHeight = clamp(screenHeight * 0.086, 68, 76);
  const buttonRadius = clamp(buttonHeight * 0.26, 18, 20);
  const buttonFontSize = clamp(screenWidth * 0.052, 18, 20);
  const helperFontSize = clamp(screenWidth * 0.04, 14, 16);

  const rules = useMemo(
    () => ({
      len: password.length >= 8,
      upperLower: /[a-z]/.test(password) && /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    }),
    [password],
  );

  const score = Object.values(rules).filter(Boolean).length;
  const strength =
    score === 4
      ? { label: 'Strong', color: AUTH_COLORS.success, bar: [1, 1, 1, 1] }
      : score === 3
        ? { label: 'Good', color: '#3abf6b', bar: [1, 1, 1, 0.4] }
        : score === 2
          ? { label: 'Fair', color: '#f1b300', bar: [1, 1, 0.2, 0] }
          : password.length > 0
            ? { label: 'Weak', color: AUTH_COLORS.danger, bar: [1, 0.2, 0, 0] }
            : { label: '', color: AUTH_COLORS.cardBorder, bar: [0, 0, 0, 0] };

  const passwordsMatch = password.length > 0 && confirm.length > 0 && password === confirm;

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, '').slice(0, 6));
  };

  const handleReset = async () => {
    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      toast.error('Please enter the 6-digit reset code sent to your email.');
      return;
    }
    if (!rules.len || !rules.upperLower || !rules.number || !rules.special) {
      toast.error('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
      return;
    }
    if (!passwordsMatch) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await onReset?.({
        code: normalizedCode,
        password,
        confirm,
      });
    } catch (error: any) {
      toast.error(error?.message || 'Unable to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  const ruleItem = (ok: boolean, text: string) => (
    <View style={styles.ruleRow}>
      <Text maxFontSizeMultiplier={1.4} style={[styles.ruleIcon, { color: ok ? AUTH_COLORS.success : AUTH_COLORS.danger, fontSize: helperFontSize }]}>
        {ok ? '✓' : '○'}
      </Text>
      <Text maxFontSizeMultiplier={1.4} style={[styles.ruleText, { color: ok ? AUTH_COLORS.success : AUTH_COLORS.textSecondary, fontSize: helperFontSize }]}>
        {text}
      </Text>
    </View>
  );

  return (
    <AuthScreenLayout
      title="Create Password"
      subtitle="Choose a strong password to secure your account."
      onBack={onBackToLogin}
    >
      <AuthStepCard
        step={1}
        title="Password Setup"
        subtitle="Enter your 6-digit reset code, then create a strong new password."
        style={styles.primaryCard}
      >
        <View style={[styles.inputContainer, { minHeight: fieldHeight, borderRadius: fieldRadius }]}>
          <Feather name="hash" size={fieldIconSize} color={AUTH_COLORS.textMuted} />
          <TextInput
            maxFontSizeMultiplier={1.4}
            style={[styles.input, { fontSize: inputFontSize }]}
            placeholder="6-digit reset code"
            placeholderTextColor={AUTH_COLORS.placeholderDark}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>

        <View style={[styles.inputContainer, { minHeight: fieldHeight, borderRadius: fieldRadius }]}>
          <Feather name="lock" size={fieldIconSize} color={AUTH_COLORS.textMuted} />
          <TextInput
            maxFontSizeMultiplier={1.4}
            style={[styles.input, { fontSize: inputFontSize }]}
            placeholder="Enter new password"
            placeholderTextColor={AUTH_COLORS.placeholderDark}
            secureTextEntry={!showPass}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPass((prev) => !prev)}>
            <Feather name={showPass ? 'eye-off' : 'eye'} size={fieldIconSize} color={AUTH_COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.strengthRow}>
          <Text maxFontSizeMultiplier={1.4} style={[styles.strengthLabel, { fontSize: helperFontSize }]}>
            Password Strength
          </Text>
          <Text maxFontSizeMultiplier={1.4} style={[styles.strengthValue, { color: strength.color, fontSize: helperFontSize }]}>
            {strength.label}
          </Text>
        </View>
        <View style={styles.strengthBars}>
          {strength.bar.map((value, idx) => (
            <View
              key={idx}
              style={[
                styles.strengthBar,
                {
                  opacity: value,
                  backgroundColor: strength.color,
                },
              ]}
            />
          ))}
        </View>

        <View
          style={[
            styles.inputContainer,
            { minHeight: fieldHeight, borderRadius: fieldRadius },
            !passwordsMatch && confirm ? styles.inputError : null,
          ]}
        >
          <Feather name="shield" size={fieldIconSize} color={AUTH_COLORS.textMuted} />
          <TextInput
            maxFontSizeMultiplier={1.4}
            style={[styles.input, { fontSize: inputFontSize }]}
            placeholder="Confirm new password"
            placeholderTextColor={AUTH_COLORS.placeholderDark}
            secureTextEntry={!showConfirm}
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirm((prev) => !prev)}>
            <Feather name={showConfirm ? 'eye-off' : 'eye'} size={fieldIconSize} color={AUTH_COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.rulesList}>
          {ruleItem(rules.len, 'At least 8 characters')}
          {ruleItem(rules.upperLower, 'Uppercase & lowercase letters')}
          {ruleItem(rules.number, 'At least one number')}
          {ruleItem(rules.special, 'Special character (!@#$%^&*)')}
        </View>

        {!passwordsMatch && confirm.length > 0 ? (
          <View style={styles.warnRow}>
            <Text maxFontSizeMultiplier={1.4} style={[styles.warnDot, { fontSize: helperFontSize }]}>
              •
            </Text>
            <Text maxFontSizeMultiplier={1.4} style={[styles.warnText, { fontSize: helperFontSize }]}>
              Passwords do not match
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.button,
            { minHeight: buttonHeight, borderRadius: buttonRadius },
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleReset}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={AUTH_COLORS.primaryText} />
          ) : (
            <Text maxFontSizeMultiplier={1.4} style={[styles.buttonText, { fontSize: buttonFontSize }]}>
              Reset Password
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onBackToLogin} style={styles.backLinkWrap}>
          <Text maxFontSizeMultiplier={1.4} style={[styles.backLink, { fontSize: helperFontSize }]}>
            Back to Login
          </Text>
        </TouchableOpacity>
      </AuthStepCard>

      <AuthStepCard
        step={2}
        title="Security Reminder"
        subtitle="Use a password you have not used before and avoid personal details."
        dark
      >
        <Text maxFontSizeMultiplier={1.4} style={[styles.darkChip, { fontSize: helperFontSize }]}>
          Credential update pending
        </Text>
      </AuthStepCard>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  primaryCard: {
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.inputDark,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputDarkBorder,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: AUTH_COLORS.inputTextDark,
    marginLeft: 10,
    fontWeight: '500',
  },
  eyeButton: {
    padding: 4,
  },
  strengthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  strengthLabel: {
    color: AUTH_COLORS.textSecondary,
    fontWeight: '500',
  },
  strengthValue: {
    fontWeight: '700',
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: 4,
    backgroundColor: AUTH_COLORS.cardBorder,
    opacity: 0.3,
  },
  rulesList: {
    marginBottom: 10,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  ruleIcon: {
    marginRight: 8,
    fontWeight: '700',
  },
  ruleText: {
    fontWeight: '500',
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  warnDot: {
    color: AUTH_COLORS.warning,
    marginRight: 6,
  },
  warnText: {
    color: '#ffdba2',
    fontWeight: '600',
  },
  inputError: {
    borderColor: AUTH_COLORS.danger,
  },
  button: {
    backgroundColor: AUTH_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: AUTH_COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonText: {
    color: AUTH_COLORS.primaryText,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  backLinkWrap: {
    alignItems: 'center',
  },
  backLink: {
    color: AUTH_COLORS.linkLight,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  darkChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: AUTH_COLORS.cardBorderActive,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    color: AUTH_COLORS.textPrimary,
    backgroundColor: 'rgba(28,77,141, 0.2)',
    fontWeight: '600',
  },
});
