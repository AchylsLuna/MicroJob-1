import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { AUTH_COLORS, clamp } from '../../theme/authTheme';

type AuthScreenLayoutProps = {
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: ReactNode;
};

export default function AuthScreenLayout({ title, subtitle, onBack, children }: AuthScreenLayoutProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const horizontalPadding = clamp(screenWidth * 0.05, 16, 24);
  const topPadding = clamp(screenHeight * 0.07, 44, 62);
  const backButtonSize = clamp(screenWidth * 0.15, 52, 56);
  const backIconSize = clamp(screenWidth * 0.06, 18, 22);
  const titleFontSize = clamp(screenWidth * 0.106, 34, 42);
  const subtitleFontSize = clamp(screenWidth * 0.051, 18, 20);
  const contentMaxWidth = Math.min(460, screenWidth - horizontalPadding * 2);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: topPadding,
            maxWidth: contentMaxWidth,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {onBack ? (
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
            <Feather name="arrow-left" size={backIconSize} color={AUTH_COLORS.primaryText} />
          </TouchableOpacity>
        ) : null}

        <Text
          allowFontScaling={false}
          style={[styles.title, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.16) }]}
        >
          {title}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.subtitle, { fontSize: subtitleFontSize, lineHeight: Math.round(subtitleFontSize * 1.4) }]}
        >
          {subtitle}
        </Text>

        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
  },
  backgroundOrbTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: AUTH_COLORS.backgroundElevated,
    opacity: 0.15,
    top: -150,
    right: -120,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: AUTH_COLORS.backgroundElevated,
    opacity: 0.13,
    bottom: -110,
    left: -100,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.tileSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 42,
    lineHeight: 50,
    fontWeight: '800',
    color: AUTH_COLORS.textPrimary,
    marginBottom: 8,
    maxWidth: 340,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    color: AUTH_COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 20,
  },
});
