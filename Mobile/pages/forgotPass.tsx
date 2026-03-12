import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

type Props = {
  onBack?: () => void;
  onSendReset?: (email: string) => void | Promise<void>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPass({ onBack, onSendReset }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const fieldHeight = clamp(screenHeight * 0.082, 64, 74);
  const fieldRadius = clamp(fieldHeight * 0.24, 16, 18);
  const fieldIconSize = clamp(screenWidth * 0.056, 20, 22);
  const inputFontSize = clamp(screenWidth * 0.046, 16, 18);
  const buttonHeight = clamp(screenHeight * 0.086, 68, 76);
  const buttonRadius = clamp(buttonHeight * 0.26, 18, 20);
  const buttonTextSize = clamp(screenWidth * 0.052, 18, 20);
  const helperFontSize = clamp(screenWidth * 0.039, 13, 15);
  const badgeSize = clamp(screenWidth * 0.18, 60, 68);
  const badgeIconSize = clamp(badgeSize * 0.43, 24, 30);
  const fieldLabelSize = clamp(screenWidth * 0.04, 14, 15);

  const handleSendReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await onSendReset?.(normalizedEmail);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Unable to send reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScreenLayout
      title="Reset Password"
      subtitle="Enter your email and we will send recovery instructions."
      onBack={onBack}
    >
      <View style={[styles.heroBadge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
        <Feather name="shield" size={badgeIconSize} color={AUTH_COLORS.primaryText} />
      </View>

      <AuthStepCard
        step={1}
        title="Recovery Email"
        subtitle="Use the same email tied to your account."
        style={styles.primaryCard}
      >
        <Text allowFontScaling={false} style={[styles.fieldLabel, { fontSize: fieldLabelSize }]}>
          Email Address
        </Text>

        <View
          style={[
            styles.inputContainer,
            { minHeight: fieldHeight, borderRadius: fieldRadius },
            isInputFocused && styles.inputContainerFocused,
          ]}
        >
          <Feather name="mail" size={fieldIconSize} color={AUTH_COLORS.textMuted} />
          <TextInput
            allowFontScaling={false}
            style={[styles.input, { fontSize: inputFontSize }]}
            placeholder="Enter your email"
            placeholderTextColor={AUTH_COLORS.placeholderDark}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
          />
        </View>
        <Text allowFontScaling={false} style={[styles.helperText, { fontSize: helperFontSize }]}>
          We will send a 6-digit verification code to this email.
        </Text>

        <TouchableOpacity
          style={[
            styles.button,
            { minHeight: buttonHeight, borderRadius: buttonRadius },
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleSendReset}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={AUTH_COLORS.primaryText} />
          ) : (
            <Text allowFontScaling={false} style={[styles.buttonText, { fontSize: buttonTextSize }]}>
              Send Reset Link
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoRow}>
          <Feather name="lock" size={clamp(helperFontSize + 1, 14, 16)} color={AUTH_COLORS.textMuted} />
          <Text allowFontScaling={false} style={[styles.infoText, { fontSize: helperFontSize }]}>
            For security, use the same email you registered with.
          </Text>
        </View>
        <Text allowFontScaling={false} style={[styles.infoSubText, { fontSize: clamp(helperFontSize * 0.92, 12, 14) }]}>
          {"Didn't receive it? You can resend from the OTP screen."}
        </Text>
      </AuthStepCard>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  primaryCard: {
    marginBottom: 10,
  },
  heroBadge: {
    alignSelf: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.cardBorderActive,
    backgroundColor: 'rgba(27, 79, 216, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    color: AUTH_COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.inputDark,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputDarkBorder,
    borderRadius: 18,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  inputContainerFocused: {
    borderColor: AUTH_COLORS.cardBorderActive,
    backgroundColor: 'rgba(27,79,216,0.14)',
  },
  input: {
    flex: 1,
    marginLeft: 14,
    color: AUTH_COLORS.inputTextDark,
    fontWeight: '500',
  },
  helperText: {
    color: AUTH_COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 14,
  },
  button: {
    backgroundColor: AUTH_COLORS.primary,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
  infoRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    marginLeft: 8,
    color: AUTH_COLORS.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  infoSubText: {
    marginTop: 8,
    color: AUTH_COLORS.textTertiary,
    fontWeight: '500',
  },
});
