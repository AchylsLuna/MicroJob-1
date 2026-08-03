import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AUTH_COLORS, clamp } from '../theme/authTheme';

type Props = {
  onBackToLogin: () => void;
};

export default function SignSuccess({ onBackToLogin }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const iconSize = clamp(screenWidth * 0.26, 92, 108);
  const checkSize = clamp(iconSize * 0.38, 34, 40);
  const buttonHeight = clamp(screenHeight * 0.086, 68, 76);
  const buttonRadius = clamp(buttonHeight * 0.26, 18, 20);
  const buttonFontSize = clamp(screenWidth * 0.052, 18, 20);
  const helperFontSize = clamp(screenWidth * 0.04, 14, 16);

  return (
    <AuthScreenLayout title="Sign Up Complete" subtitle="Your account has been successfully created.">
      <AuthStepCard
        step={1}
        title="Welcome to MicroJobs"
        subtitle="You can now sign in and start building your profile."
        style={styles.primaryCard}
      >
        <View style={styles.iconContainer}>
          <View style={[styles.successIcon, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}>
            <Feather name="check" size={checkSize} color={AUTH_COLORS.primaryText} />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { minHeight: buttonHeight, borderRadius: buttonRadius }]}
          onPress={onBackToLogin}
        >
          <Text maxFontSizeMultiplier={1.4} style={[styles.buttonText, { fontSize: buttonFontSize }]}>
            Back to Login
          </Text>
        </TouchableOpacity>
      </AuthStepCard>

      <AuthStepCard
        step={2}
        title="Account Status"
        subtitle="Sign in with your new account to continue to the dashboard."
        dark
      >
        <Text maxFontSizeMultiplier={1.4} style={[styles.darkChip, { fontSize: helperFontSize }]}>
          Account ready
        </Text>
      </AuthStepCard>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  primaryCard: {
    marginBottom: 12,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    backgroundColor: AUTH_COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AUTH_COLORS.success,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  button: {
    backgroundColor: AUTH_COLORS.primary,
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
