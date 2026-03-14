import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
  useWindowDimensions,
} from 'react-native';
import { AUTH_COLORS, clamp } from '../theme/authTheme';

type OnboardingSlide = {
  id: string;
  icon: 'briefcase' | 'users' | 'shield' | 'trending-up';
  eyebrow: string;
  title: string;
  subtitle: string;
  highlight: string;
};

type Props = {
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onSkip?: () => void;
  onLogin?: () => void;
  onComplete: () => void;
};

const slides: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'briefcase',
    eyebrow: 'WORK MODE',
    title: 'Find Work\nYou Love',
    subtitle: 'Connect with thousands of employers looking for your skills and expertise.',
    highlight: 'Verified jobs updated daily',
  },
  {
    id: '2',
    icon: 'users',
    eyebrow: 'HIRE MODE',
    title: 'Hire Top\nTalent Fast',
    subtitle: 'Post a job and get matched with verified professionals in minutes.',
    highlight: 'Shortlist faster with stage tracking',
  },
  {
    id: '3',
    icon: 'shield',
    eyebrow: 'TRUSTED PAYMENTS',
    title: 'Safe & Verified\nTransactions',
    subtitle: 'Every profile is verified so you can work and hire with full confidence.',
    highlight: 'Wallet history stays fully auditable',
  },
  {
    id: '4',
    icon: 'trending-up',
    eyebrow: 'PROFILE GROWTH',
    title: 'Grow Your\nCareer',
    subtitle: 'Track applications, build your profile, and unlock your next opportunity.',
    highlight: 'Interview timelines stay in one place',
  },
];

export default function OnboardingCarouselScreen({
  activeIndex,
  onIndexChange,
  onSkip,
  onLogin,
  onComplete,
}: Props) {
  const { width, height } = useWindowDimensions();
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const scrollX = useRef(new Animated.Value(activeIndex * width)).current;
  const previousIndexRef = useRef(activeIndex);

  const topPad = Platform.OS === 'web' ? 68 : 54;
  const botPad = Platform.OS === 'web' ? 34 : 20;
  const panelWidth = Math.min(width - 48, 420);
  const titleFontSize = clamp(width * 0.086, 32, 38);
  const titleLineHeight = Math.round(titleFontSize * 1.14);
  const subtitleFontSize = clamp(width * 0.041, 15, 17);
  const iconRingSize = clamp(width * 0.42, 172, 204);
  const iconCircleSize = clamp(iconRingSize * 0.62, 106, 122);
  const iconSize = clamp(iconCircleSize * 0.4, 40, 48);
  const slideVerticalGap = clamp(height * 0.032, 22, 30);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (!first || first.index == null) return;
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
    flatListRef.current?.scrollToIndex({ index: activeIndex, animated: true });
  }, [activeIndex]);

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
      return;
    }
    onComplete();
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <StatusBar style="light" />
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />

      <View style={styles.topBar}>
        <View style={styles.brandPill}>
          <Text allowFontScaling={false} style={styles.brandText}>
            MicroJob
          </Text>
        </View>

        <Pressable style={styles.skipBtn} onPress={onSkip}>
          <Text allowFontScaling={false} style={styles.skipText}>
            Skip
          </Text>
        </Pressable>
      </View>

      <View style={styles.slidesWrapper}>
        <Animated.FlatList
          ref={flatListRef}
          data={slides}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialScrollIndex={activeIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width, gap: slideVerticalGap }]}>
              <View style={[styles.slidePanel, { width: panelWidth }]}> 
                <View style={styles.panelGlow} />

                <View style={styles.slideHeaderRow}>
                  <View style={styles.eyebrowPill}>
                    <Text allowFontScaling={false} style={styles.eyebrowText}>
                      {item.eyebrow}
                    </Text>
                  </View>
                  <Text allowFontScaling={false} style={styles.stepText}>
                    {item.id}/{slides.length}
                  </Text>
                </View>

                <View style={styles.illustrationArea}>
                  <View style={[styles.iconRing, { width: iconRingSize, height: iconRingSize, borderRadius: iconRingSize / 2 }]}> 
                    <View
                      style={[
                        styles.iconCircle,
                        {
                          width: iconCircleSize,
                          height: iconCircleSize,
                          borderRadius: iconCircleSize / 2,
                        },
                      ]}
                    >
                      <Feather name={item.icon} size={iconSize} color="#FFFFFF" />
                    </View>
                  </View>

                  <View style={styles.highlightPill}>
                    <Feather name="check-circle" size={14} color="#93C5FD" />
                    <Text allowFontScaling={false} style={styles.highlightText}>
                      {item.highlight}
                    </Text>
                  </View>
                </View>

                <View style={styles.textArea}>
                  <Text allowFontScaling={false} style={[styles.title, { fontSize: titleFontSize, lineHeight: titleLineHeight }]}>
                    {item.title}
                  </Text>
                  <Text allowFontScaling={false} style={[styles.subtitle, { fontSize: subtitleFontSize, lineHeight: Math.round(subtitleFontSize * 1.58) }]}>
                    {item.subtitle}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      </View>

      <View style={[styles.footer, { width: panelWidth }]}> 
        <View style={styles.dots}>
          {slides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 32, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.28, 1, 0.28],
              extrapolate: 'clamp',
            });
            return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity }]} />;
          })}
        </View>

        <Pressable style={styles.nextButton} onPress={handleNext}>
          <Text allowFontScaling={false} style={styles.nextButtonText}>
            {activeIndex === slides.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
          {activeIndex < slides.length - 1 ? (
            <Feather name="arrow-right" size={18} color="#FFFFFF" style={styles.nextButtonIcon} />
          ) : null}
        </Pressable>

        <Pressable style={styles.loginRow} onPress={onLogin}>
          <Text allowFontScaling={false} style={styles.loginText}>
            Already have an account?
          </Text>
          <Text allowFontScaling={false} style={styles.loginLink}>
            Log In
          </Text>
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
    opacity: 0.16,
    top: -150,
    right: -110,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: AUTH_COLORS.backgroundElevated,
    opacity: 0.14,
    bottom: -120,
    left: -100,
  },
  topBar: {
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandPill: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  brandText: {
    fontSize: 13,
    letterSpacing: 0.35,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
  skipBtn: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  skipText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.62)',
    fontWeight: '600',
  },
  slidesWrapper: {
    flex: 1,
    width: '100%',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  slidePanel: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderWidth: 0,
    overflow: 'visible',
  },
  panelGlow: {
    position: 'absolute',
    top: -48,
    right: -30,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(37,99,235,0.16)',
  },
  slideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(37,99,235,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
  },
  eyebrowText: {
    fontSize: 11,
    letterSpacing: 0.9,
    color: '#BFDBFE',
    fontWeight: '800',
  },
  stepText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.48)',
    fontWeight: '700',
  },
  illustrationArea: {
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  iconRing: {
    backgroundColor: 'rgba(27,79,216,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    backgroundColor: AUTH_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AUTH_COLORS.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 14,
  },
  highlightPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
  },
  highlightText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.74)',
    fontWeight: '600',
  },
  textArea: {
    marginTop: 24,
    alignItems: 'center',
    gap: 14,
  },
  title: {
    color: AUTH_COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.7,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    maxWidth: 320,
    fontWeight: '500',
  },
  footer: {
    paddingTop: 18,
    gap: 16,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  nextButton: {
    width: '100%',
    height: 58,
    borderRadius: 18,
    backgroundColor: AUTH_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: AUTH_COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 10,
  },
  nextButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
    fontWeight: '700',
  },
  nextButtonIcon: {
    marginLeft: 8,
  },
  loginRow: {
    width: '100%',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  loginText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  loginLink: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
});
