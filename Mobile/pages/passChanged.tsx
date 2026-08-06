import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AUTH_COLORS, clamp } from '../theme/authTheme';

type Props = {
  onBackToLogin?: () => void;
};

export default function PassChanged({ onBackToLogin }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const iconSize = clamp(screenWidth * 0.26, 92, 108);
  const checkSize = clamp(iconSize * 0.36, 32, 40);
  const buttonHeight = clamp(screenHeight * 0.086, 68, 76);
  const buttonRadius = clamp(buttonHeight * 0.26, 18, 20);
  const buttonFontSize = clamp(screenWidth * 0.052, 18, 20);
  const helperFontSize = clamp(screenWidth * 0.04, 14, 16);

  return (
    <AuthScreenLayout title="Password Updated" subtitle="Your credential has been changed successfully.">
      <AuthStepCard
        step={1}
        title="Reset Completed"
        subtitle="Your account is now protected with your new password."
        style={styles.primaryCard}
      >
        <View style={styles.successIconWrap}>
          <View
            style={[styles.successIcon, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}
          >
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
        subtitle="Sign in again with your new password to continue."
        dark
      >
        <Text maxFontSizeMultiplier={1.4} style={[styles.darkChip, { fontSize: helperFontSize }]}>
          Ready to authenticate
        </Text>
      </AuthStepCard>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  primaryCard: {
    marginBottom: 12,
  },
  successIconWrap: {
    alignItems: 'center',
    marginBottom: 18,
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
