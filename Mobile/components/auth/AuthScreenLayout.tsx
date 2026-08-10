import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUTH_COLORS, clamp, getAuthMetrics } from '../../theme/authTheme';
import ScrollView from '../ui/SmoothScrollView';
import CanvasBackButton from '../ui/CanvasBackButton';
import MicroJobsLogo from './MicroJobsLogo';

type AuthScreenLayoutProps = {
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: ReactNode;
  eyebrow?: string;
  centered?: boolean;
};

export default function AuthScreenLayout({ title, subtitle, onBack, children, centered = false }: AuthScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();
  const metrics = getAuthMetrics(screenWidth, screenHeight, fontScale);
  const horizontalPadding = metrics.horizontalPadding;
  const topPadding = Math.max(insets.top, 10) + clamp(screenHeight * 0.035, metrics.compactHeight ? 10 : 18, 28);
  const backButtonSize = clamp(screenWidth * 0.15, 52, 56);
  const titleFontSize = clamp(screenWidth * 0.106, 34, 42);
  const subtitleFontSize = clamp(screenWidth * 0.051, 18, 20);
  const contentMaxWidth = Math.min(metrics.contentMaxWidth, screenWidth - horizontalPadding * 2);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 24}
    >
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: topPadding,
            paddingBottom: 28 + Math.max(insets.bottom, 10),
            maxWidth: contentMaxWidth,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          {onBack ? (
            <CanvasBackButton
              style={{ width: backButtonSize, height: backButtonSize, borderRadius: clamp(backButtonSize * 0.29, 14, 16) }}
              onPress={onBack}
              lightSurface
            />
          ) : <View style={{ width: backButtonSize, height: backButtonSize }} />}
          <MicroJobsLogo compact />
          <View style={{ width: backButtonSize }} />
        </View>

        <Text
          style={[styles.title, centered && styles.centeredText, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.16) }]}
        >
          {title}
        </Text>
        <Text
          style={[styles.subtitle, centered && styles.centeredText, { fontSize: subtitleFontSize, lineHeight: Math.round(subtitleFontSize * 1.4) }]}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, gap: 8, flexWrap: 'wrap' },
  title: {
    fontSize: 42,
    lineHeight: 50,
    fontWeight: '800',
    color: AUTH_COLORS.backgroundDeep,
    marginBottom: 8,
    maxWidth: '100%',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    color: AUTH_COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 20,
    flexShrink: 1,
  },
  centeredText: { alignSelf: 'center', textAlign: 'center' },
});
