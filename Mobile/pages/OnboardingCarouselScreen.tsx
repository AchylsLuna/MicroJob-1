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
import { AUTH_COLORS } from '../theme/authTheme';

type OnboardingSlide = {
  id: string;
  icon: 'briefcase' | 'users' | 'shield' | 'trending-up';
  title: string;
  subtitle: string;
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
    title: 'Find Work\nYou Love',
    subtitle: 'Connect with thousands of employers looking for your skills and expertise.',
  },
  {
    id: '2',
    icon: 'users',
    title: 'Hire Top\nTalent Fast',
    subtitle: 'Post a job and get matched with verified professionals in minutes.',
  },
  {
    id: '3',
    icon: 'shield',
    title: 'Safe & Verified\nTransactions',
    subtitle: 'Every profile is verified so you can work and hire with full confidence.',
  },
  {
    id: '4',
    icon: 'trending-up',
    title: 'Grow Your\nCareer',
    subtitle: 'Track applications, build your profile, and unlock your next opportunity.',
  },
];

export default function OnboardingCarouselScreen({
  activeIndex,
  onIndexChange,
  onSkip,
  onLogin,
  onComplete,
}: Props) {
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const scrollX = useRef(new Animated.Value(activeIndex * width)).current;
  const previousIndexRef = useRef(activeIndex);

  const topPad = Platform.OS === 'web' ? 67 : 52;
  const botPad = Platform.OS === 'web' ? 34 : 20;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (!first || first.index == null) return;
      if (first.index !== previousIndexRef.current) {
        previousIndexRef.current = first.index;
        onIndexChange(first.index);
      }
    }
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

      <View style={styles.topBar}>
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
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialScrollIndex={activeIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              <View style={styles.illustrationArea}>
                <View style={styles.iconRing}>
                  <View style={styles.iconCircle}>
                    <Feather name={item.icon} size={44} color="#FFFFFF" />
                  </View>
                </View>
              </View>

              <View style={styles.textArea}>
                <Text allowFontScaling={false} style={styles.title}>
                  {item.title}
                </Text>
                <Text allowFontScaling={false} style={styles.subtitle}>
                  {item.subtitle}
                </Text>
              </View>
            </View>
          )}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 28, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.25, 1, 0.25],
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
            <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
          ) : null}
        </Pressable>

        <Pressable style={styles.loginRow} onPress={onLogin}>
          <Text allowFontScaling={false} style={styles.loginText}>
            Already have an account?{' '}
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
  },
  topBar: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: '500',
  },
  slidesWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 40,
  },
  illustrationArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRing: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: 'rgba(27,79,216,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: AUTH_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AUTH_COLORS.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 14,
  },
  textArea: {
    alignItems: 'center',
    gap: 14,
  },
  title: {
    fontSize: 34,
    color: AUTH_COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.52)',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 290,
    fontWeight: '400',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 20,
    gap: 18,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
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
    fontWeight: '600',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  loginText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
  },
  loginLink: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
});
