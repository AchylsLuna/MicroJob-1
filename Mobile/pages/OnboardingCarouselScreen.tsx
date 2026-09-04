import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  BackHandler,
  FlatList,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUTH_COLORS, clamp, getAuthMetrics } from '../theme/authTheme';
import MicroJobsLogo from '../components/auth/MicroJobsLogo';
import findWorkArtwork from '../assets/onboarding-find-work.png';
import hireTalentArtwork from '../assets/onboarding-hire-talent.png';
import securePaymentArtwork from '../assets/onboarding-secure-payment.png';
import careerGrowthArtwork from '../assets/onboarding-career-growth.png';
import useReducedMotion from '../hooks/useReducedMotion';
import { motion } from '../theme/motion';

const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 32;

type OnboardingSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  highlight: string;
  artwork: ImageSourcePropType;
  artworkLabel: string;
};

type Props = {
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onSkip?: () => void;
  onLogin?: () => void;
  onComplete: () => void;
};

export default function OnboardingCarouselScreen({
  activeIndex,
  onIndexChange,
  onSkip,
  onLogin,
  onComplete,
}: Props) {
  const { t } = useTranslation('auth');
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const metrics = getAuthMetrics(width, height, fontScale);
  const reducedMotion = useReducedMotion() === true;
  const slides = useMemo<OnboardingSlide[]>(() => [
    {
      id: '1',
      eyebrow: t('onboarding.slides.work.eyebrow'),
      title: t('onboarding.slides.work.title'),
      subtitle: t('onboarding.slides.work.subtitle'),
      highlight: t('onboarding.slides.work.highlight'),
      artwork: findWorkArtwork,
      artworkLabel: t('onboarding.slides.work.artworkLabel'),
    },
    {
      id: '2',
      eyebrow: t('onboarding.slides.hire.eyebrow'),
      title: t('onboarding.slides.hire.title'),
      subtitle: t('onboarding.slides.hire.subtitle'),
      highlight: t('onboarding.slides.hire.highlight'),
      artwork: hireTalentArtwork,
      artworkLabel: t('onboarding.slides.hire.artworkLabel'),
    },
    {
      id: '3',
      eyebrow: t('onboarding.slides.payments.eyebrow'),
      title: t('onboarding.slides.payments.title'),
      subtitle: t('onboarding.slides.payments.subtitle'),
      highlight: t('onboarding.slides.payments.highlight'),
      artwork: securePaymentArtwork,
      artworkLabel: t('onboarding.slides.payments.artworkLabel'),
    },
    {
      id: '4',
      eyebrow: t('onboarding.slides.growth.eyebrow'),
      title: t('onboarding.slides.growth.title'),
      subtitle: t('onboarding.slides.growth.subtitle'),
      highlight: t('onboarding.slides.growth.highlight'),
      artwork: careerGrowthArtwork,
      artworkLabel: t('onboarding.slides.growth.artworkLabel'),
    },
  ], [t]);
  const usableHeight = Math.max(480, height - insets.top - insets.bottom);
  const isCompactHeight = usableHeight < 700 || metrics.largeText;
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const scrollX = useRef(new Animated.Value(activeIndex * width)).current;
  // The dots widen the active pill, which is a layout property and therefore cannot be
  // driven by the native-driver scrollX. This tracks the settled page index instead.
  const dotProgress = useRef(new Animated.Value(activeIndex)).current;
  const previousIndexRef = useRef(activeIndex);
  const selectedIndexRef = useRef(activeIndex);

  const topPad = insets.top + (isCompactHeight ? 4 : 12);
  const botPad = insets.bottom + (isCompactHeight ? 6 : 12);
  const panelWidth = Math.min(width - metrics.horizontalPadding * 2, metrics.tablet ? 520 : 420);
  const titleFontSize = isCompactHeight ? clamp(width * 0.068, 23, 28) : clamp(width * 0.086, 30, 36);
  const titleLineHeight = Math.round(titleFontSize * 1.14);
  const subtitleFontSize = isCompactHeight ? clamp(width * 0.036, 13, 15) : clamp(width * 0.041, 15, 17);
  const artworkHeight = isCompactHeight
    ? clamp(usableHeight * 0.18, 104, 144)
    : clamp(usableHeight * 0.25, 170, 230);
  const artworkWidth = Math.round(artworkHeight * 0.72);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (!first || first.index == null) return;
      selectedIndexRef.current = first.index;
      if (first.index !== previousIndexRef.current) {
        previousIndexRef.current = first.index;
        onIndexChange(first.index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  useEffect(() => {
    if (previousIndexRef.current === activeIndex) return;
    previousIndexRef.current = activeIndex;
    selectedIndexRef.current = activeIndex;
    flatListRef.current?.scrollToIndex({ index: activeIndex, animated: !reducedMotion });
  }, [activeIndex, reducedMotion]);

  useEffect(() => {
    const animation = reducedMotion
      ? Animated.timing(dotProgress, { toValue: activeIndex, duration: motion.duration.instant, useNativeDriver: false })
      : Animated.spring(dotProgress, { toValue: activeIndex, useNativeDriver: false, ...motion.spring });
    animation.start();
    return () => animation.stop();
  }, [activeIndex, dotProgress, reducedMotion]);

  useEffect(() => {
    const currentIndex = previousIndexRef.current;
    scrollX.setValue(currentIndex * width);
    flatListRef.current?.scrollToOffset({ offset: currentIndex * width, animated: false });
  }, [scrollX, width]);

  const goToIndex = useCallback((nextIndex: number) => {
    const index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    selectedIndexRef.current = index;
    flatListRef.current?.scrollToIndex({ index, animated: !reducedMotion });
  }, [reducedMotion, slides]);

  const handlePrevious = useCallback(() => {
    if (selectedIndexRef.current <= 0) return false;
    goToIndex(selectedIndexRef.current - 1);
    return true;
  }, [goToIndex]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handlePrevious);
    return () => subscription.remove();
  }, [handlePrevious]));

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.backgroundOrbTop} />
      <View pointerEvents="none" style={styles.backgroundOrbBottom} />

      <View style={styles.topBar}>
        <MicroJobsLogo compact />

        <View style={styles.topActions}>
          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && styles.blueControlPressed]}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skipA11y')}
          >
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.slidesWrapper}>
        <Animated.FlatList
          ref={flatListRef}
          data={slides}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          directionalLockEnabled
          decelerationRate="fast"
          bounces
          alwaysBounceHorizontal={false}
          overScrollMode="never"
          snapToInterval={width}
          snapToAlignment="center"
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialScrollIndex={activeIndex}
          onScrollToIndexFailed={({ index }) => {
            flatListRef.current?.scrollToOffset({ offset: index * width, animated: false });
          }}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item, index }) => {
            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.55, 1, 0.55], extrapolate: 'clamp' });
            const scale = reducedMotion ? 1 : scrollX.interpolate({ inputRange, outputRange: [0.94, 1, 0.94], extrapolate: 'clamp' });
            const translateY = reducedMotion ? 0 : scrollX.interpolate({ inputRange, outputRange: [12, 0, 12], extrapolate: 'clamp' });
            const artworkTranslateX = reducedMotion ? 0 : scrollX.interpolate({ inputRange, outputRange: [motion.distance.medium, 0, -motion.distance.medium], extrapolate: 'clamp' });
            const artworkScale = reducedMotion ? 1 : scrollX.interpolate({ inputRange, outputRange: [0.96, 1, 0.96], extrapolate: 'clamp' });
            const artworkOpacity = scrollX.interpolate({ inputRange, outputRange: [0.58, 1, 0.58], extrapolate: 'clamp' });
            return (
            <View style={[styles.slide, { width }]}>
              <Animated.View style={[styles.slidePanel, isCompactHeight && styles.slidePanelCompact, { width: panelWidth, opacity, transform: [{ scale }, { translateY }] }]}>
                <View pointerEvents="none" style={styles.panelGlow} />

                <View style={styles.slideHeaderRow}>
                  <View style={styles.eyebrowPill}>
                    <Text style={styles.eyebrowText}>
                      {item.eyebrow}
                    </Text>
                  </View>
                  <Text style={styles.stepText}>
                    {item.id}/{slides.length}
                  </Text>
                </View>

                <View style={[styles.illustrationArea, isCompactHeight && styles.illustrationAreaCompact]}>
                  <Animated.Image
                    source={item.artwork}
                    style={[styles.artworkImage, { width: artworkWidth, height: artworkHeight, opacity: artworkOpacity, transform: [{ translateX: artworkTranslateX }, { scale: artworkScale }] }]}
                    resizeMode="contain"
                    accessibilityLabel={item.artworkLabel}
                  />

                  <View style={[styles.highlightPill, isCompactHeight && styles.highlightPillCompact]}>
                    <Feather name="check-circle" size={14} color="#93C5FD" />
                    <Text style={styles.highlightText}>
                      {item.highlight}
                    </Text>
                  </View>
                </View>

                <View style={[styles.textArea, isCompactHeight && styles.textAreaCompact]}>
                  <Text style={[styles.title, { fontSize: titleFontSize, lineHeight: titleLineHeight }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.subtitle, { fontSize: subtitleFontSize, lineHeight: Math.round(subtitleFontSize * 1.58) }]}>
                    {item.subtitle}
                  </Text>
                </View>
              </Animated.View>

            </View>
            );
          }}
        />
      </View>

      <View style={[styles.footer, isCompactHeight && styles.footerCompact, { width: panelWidth }]}>
        <View style={styles.dots} accessibilityLabel={t('onboarding.slideProgressA11y', { current: activeIndex + 1, total: slides.length })} accessibilityLiveRegion="polite">
          {slides.map((_, dotIndex) => {
            const dotInputRange = [dotIndex - 1, dotIndex, dotIndex + 1];
            // Animating width (not scaleX) keeps the pill inside its own layout slot, so a
            // widened active dot pushes its neighbours along instead of covering them.
            const dotWidth = dotProgress.interpolate({
              inputRange: dotInputRange,
              outputRange: [DOT_SIZE, DOT_ACTIVE_WIDTH, DOT_SIZE],
              extrapolate: 'clamp',
            });
            const dotOpacity = dotProgress.interpolate({
              inputRange: dotInputRange,
              outputRange: [0.28, 1, 0.28],
              extrapolate: 'clamp',
            });
            return <Animated.View key={dotIndex} style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]} />;
          })}
        </View>

        <Pressable
          style={({ pressed }) => [styles.nextButton, isCompactHeight && styles.nextButtonCompact, pressed && styles.nextButtonPressed]}
          onPress={() => activeIndex < slides.length - 1 ? goToIndex(selectedIndexRef.current + 1) : onComplete()}
          accessibilityRole="button"
          accessibilityLabel={activeIndex === slides.length - 1 ? t('onboarding.getStartedA11y') : t('onboarding.continueA11y')}
        >
          <Text style={styles.nextButtonText}>{activeIndex === slides.length - 1 ? t('onboarding.getStarted') : t('onboarding.continueButton')}</Text>
          {activeIndex < slides.length - 1 ? <Feather name="arrow-right" size={18} color="#FFFFFF" style={styles.nextButtonIcon} /> : null}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.loginRow, isCompactHeight && styles.loginRowCompact, pressed && styles.blueControlPressed]}
          onPress={onLogin}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.loginA11y')}
        >
          <Text style={styles.loginText}>{t('onboarding.loginPrompt')}</Text>
          <Text style={styles.loginLink}>{t('onboarding.loginLink')}</Text>
        </Pressable>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
    alignItems: 'center',
  },
  backgroundOrbTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: AUTH_COLORS.backgroundElevated,
    opacity: 0.05,
    top: -210,
    right: -165,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: AUTH_COLORS.backgroundElevated,
    opacity: 0.04,
    bottom: -170,
    left: -145,
  },
  topBar: {
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtn: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AUTH_COLORS.blueControlSurface,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skipText: {
    fontSize: 15,
    color: AUTH_COLORS.onBlue,
    fontWeight: '700',
  },
  slidesWrapper: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  slidePanel: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderWidth: 0,
    overflow: 'visible',
  },
  slidePanelCompact: {
    paddingVertical: 4,
  },
  panelGlow: {
    position: 'absolute',
    top: -48,
    right: -30,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  slideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: AUTH_COLORS.blueControlSurface,
  },
  eyebrowText: {
    fontSize: 11,
    letterSpacing: 0.9,
    color: AUTH_COLORS.onBlue,
    fontWeight: '800',
  },
  stepText: {
    fontSize: 12,
    color: AUTH_COLORS.onBlueMuted,
    fontWeight: '700',
  },
  illustrationArea: {
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  illustrationAreaCompact: {
    marginTop: 8,
    gap: 6,
  },
  artworkImage: {
    alignSelf: 'center',
  },
  highlightPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    backgroundColor: AUTH_COLORS.blueControlSurface,
  },
  highlightPillCompact: {
    paddingVertical: 6,
  },
  highlightText: {
    fontSize: 13,
    color: AUTH_COLORS.backgroundDeep,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  textArea: {
    marginTop: 24,
    alignItems: 'center',
    gap: 14,
  },
  textAreaCompact: {
    marginTop: 8,
    gap: 6,
  },
  title: {
    color: AUTH_COLORS.backgroundDeep,
    textAlign: 'center',
    letterSpacing: -0.7,
    fontWeight: '800',
  },
  subtitle: {
    color: AUTH_COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    fontWeight: '500',
  },
  footer: {
    flexShrink: 0,
    paddingTop: 8,
    gap: 10,
    alignItems: 'center',
  },
  footerCompact: {
    paddingTop: 2,
    gap: 4,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: 999,
    backgroundColor: AUTH_COLORS.primary,
  },
  nextButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: AUTH_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#0F2954',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 10,
  },
  nextButtonCompact: {
    minHeight: 46,
  },
  nextButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  nextButtonIcon: {
    marginLeft: 8,
  },
  loginRow: {
    width: '100%',
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.blueControlSurface,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loginRowCompact: {
    minHeight: 42,
    paddingVertical: 6,
  },
  loginText: {
    fontSize: 14,
    color: AUTH_COLORS.onBlueMuted,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  loginLink: {
    fontSize: 14,
    color: AUTH_COLORS.onBlue,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
  blueControlPressed: { backgroundColor: AUTH_COLORS.blueControlSurfacePressed, transform: [{ scale: 0.99 }] },
  nextButtonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
