import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { AUTH_COLORS, clamp } from '../theme/authTheme';

type OnboardingIcon = 'briefcase' | 'users' | 'shield' | 'trending-up';

type OnboardingStepScreenProps = {
  activeIndex: number;
  icon: OnboardingIcon;
  title: string;
  subtitle: string;
  buttonLabel: string;
  showArrow?: boolean;
  onNext: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  onLogin?: () => void;
};

const DOT_COUNT = 4;

export default function OnboardingStepScreen({
  activeIndex,
  icon,
  title,
  subtitle,
  buttonLabel,
  showArrow = true,
  onNext,
  onPrevious,
  onSkip,
  onLogin,
}: OnboardingStepScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const introAnim = useRef(new Animated.Value(0)).current;
  const swipeX = useRef(new Animated.Value(0)).current;
  const isNavigatingRef = useRef(false);
  const navDirection = useRef<1 | -1>(1);
  const horizontalPadding = clamp(screenWidth * 0.06, 20, 28);
  const topPadding = clamp(screenHeight * 0.08, 52, 70);
  const entryOffsetX = clamp(screenWidth * 0.11, 28, 44);
  const exitOffsetX = screenWidth * 0.58;
  const swipeThreshold = clamp(screenWidth * 0.17, 56, 84);
  const iconOuterSize = clamp(screenWidth * 0.44, 150, 186);
  const iconInnerSize = clamp(iconOuterSize * 0.62, 94, 112);
  const iconGlyphSize = clamp(iconInnerSize * 0.42, 38, 46);
  const titleFontSize = clamp(screenWidth * 0.09, 30, 36);
  const titleLineHeight = Math.round(titleFontSize * 1.22);
  const subtitleFontSize = clamp(screenWidth * 0.043, 15, 17);
  const subtitleLineHeight = Math.round(subtitleFontSize * 1.62);
  const footerBottomPadding = clamp(screenHeight * 0.022, 12, 24);
  const buttonHeight = clamp(screenHeight * 0.073, 54, 62);
  const ctaFontSize = clamp(screenWidth * 0.043, 15, 17);
  const helperFontSize = clamp(screenWidth * 0.039, 14, 15);
  const skipFontSize = clamp(screenWidth * 0.042, 15, 16);
  const dotSize = clamp(screenWidth * 0.025, 8, 10);
  const activeDotWidth = clamp(screenWidth * 0.078, 26, 32);
  const dotGap = clamp(screenWidth * 0.009, 2, 4);
  const arrowSize = clamp(screenWidth * 0.05, 18, 20);
  const titleMaxWidth = Math.min(342, screenWidth - horizontalPadding * 2);
  const subtitleMaxWidth = Math.min(300, screenWidth - horizontalPadding * 2);

  useEffect(() => {
    introAnim.setValue(0);
    Animated.timing(introAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, introAnim]);

  const animateAndNavigate = useCallback((toValue: number, onDone: () => void) => {
    if (isNavigatingRef.current) {
      return;
    }
    isNavigatingRef.current = true;
    Animated.timing(swipeX, {
      toValue,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      swipeX.setValue(0);
      onDone();
      isNavigatingRef.current = false;
    });
  }, [swipeX]);

  const handleNext = useCallback(() => {
    navDirection.current = 1;
    animateAndNavigate(-exitOffsetX, onNext);
  }, [animateAndNavigate, exitOffsetX, onNext]);

  const handlePrevious = useCallback(() => {
    if (!onPrevious) {
      return;
    }
    navDirection.current = -1;
    animateAndNavigate(exitOffsetX, onPrevious);
  }, [animateAndNavigate, exitOffsetX, onPrevious]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onPanResponderGrant: () => {
          swipeX.stopAnimation();
        },
        onPanResponderTerminationRequest: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.vx) > 0.08) &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          const clampedDx = clamp(gestureState.dx, -screenWidth * 0.9, screenWidth * 0.9);
          swipeX.setValue(clampedDx);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (isNavigatingRef.current) {
            return;
          }
          const isSwipeLeft = gestureState.dx <= -swipeThreshold || gestureState.vx <= -0.35;
          if (isSwipeLeft) {
            handleNext();
            return;
          }

          const isSwipeRight = gestureState.dx >= swipeThreshold || gestureState.vx >= 0.35;
          if (isSwipeRight && onPrevious) {
            handlePrevious();
            return;
          }

          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 15,
            bounciness: 4,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 15,
            bounciness: 4,
          }).start();
        },
      }),
    [handleNext, handlePrevious, onPrevious, screenWidth, swipeThreshold, swipeX]
  );

  const slideScale = swipeX.interpolate({
    inputRange: [-screenWidth, 0, screenWidth],
    outputRange: [0.975, 1, 0.975],
    extrapolate: 'clamp',
  });
  const iconParallaxX = swipeX.interpolate({
    inputRange: [-screenWidth, 0, screenWidth],
    outputRange: [screenWidth * 0.06, 0, -screenWidth * 0.06],
    extrapolate: 'clamp',
  });
  const textParallaxX = swipeX.interpolate({
    inputRange: [-screenWidth, 0, screenWidth],
    outputRange: [screenWidth * 0.035, 0, -screenWidth * 0.035],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.slide,
          {
            opacity: introAnim,
            transform: [
              { translateX: swipeX },
              { scale: slideScale },
              {
                translateX: introAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [entryOffsetX * navDirection.current, 0],
                }),
              },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.content, { paddingTop: topPadding, paddingHorizontal: horizontalPadding }]}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
              <Text allowFontScaling={false} style={[styles.skipText, { fontSize: skipFontSize }]}>
                Skip
              </Text>
            </TouchableOpacity>
          </View>

          <Animated.View
            style={[
              styles.iconArea,
              { width: iconOuterSize, height: iconOuterSize, transform: [{ translateX: iconParallaxX }] },
            ]}
          >
            <Animated.View
              style={[
                styles.iconOuterRing,
                {
                  width: iconOuterSize,
                  height: iconOuterSize,
                  borderRadius: iconOuterSize / 2,
                },
              ]}
            />
            <View
              style={[
                styles.iconInnerCircle,
                { width: iconInnerSize, height: iconInnerSize, borderRadius: iconInnerSize / 2 },
              ]}
            >
              <Feather name={icon} size={iconGlyphSize} color={AUTH_COLORS.primaryText} />
            </View>
          </Animated.View>

          <Animated.View style={{ transform: [{ translateX: textParallaxX }] }}>
            <Text
              allowFontScaling={false}
              style={[
                styles.title,
                {
                  fontSize: titleFontSize,
                  lineHeight: titleLineHeight,
                  maxWidth: titleMaxWidth,
                  minHeight: Math.round(titleLineHeight * 2.15),
                },
              ]}
            >
              {title}
            </Text>
            <Text
              allowFontScaling={false}
              style={[
                styles.subtitle,
                {
                  fontSize: subtitleFontSize,
                  lineHeight: subtitleLineHeight,
                  maxWidth: subtitleMaxWidth,
                  minHeight: Math.round(subtitleLineHeight * 2.4),
                },
              ]}
            >
              {subtitle}
            </Text>
          </Animated.View>
        </View>

        <View
          style={[
            styles.footer,
            { paddingHorizontal: horizontalPadding, paddingBottom: footerBottomPadding },
          ]}
        >
          <View style={styles.dotsRow}>
            {Array.from({ length: DOT_COUNT }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    height: dotSize,
                    borderRadius: dotSize / 2,
                    marginHorizontal: dotGap,
                    width: activeIndex === index ? activeDotWidth : dotSize,
                  },
                  activeIndex === index ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              { minHeight: buttonHeight, borderRadius: clamp(buttonHeight * 0.27, 18, 22) },
            ]}
            onPress={handleNext}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.primaryButtonText,
                { fontSize: ctaFontSize },
                !showArrow && styles.primaryButtonTextNoArrow,
                ]}
            >
              {buttonLabel}
            </Text>
            {showArrow ? <Feather name="arrow-right" size={arrowSize} color={AUTH_COLORS.primaryText} /> : null}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text allowFontScaling={false} style={[styles.loginText, { fontSize: helperFontSize }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={onLogin}>
              <Text allowFontScaling={false} style={[styles.loginLink, { fontSize: helperFontSize }]}>
                Log In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
  },
  slide: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  topRow: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 10,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.38)',
    fontWeight: '500',
  },
  iconArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  iconOuterRing: {
    position: 'absolute',
    backgroundColor: 'rgba(27,79,216,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
  },
  iconInnerCircle: {
    backgroundColor: AUTH_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AUTH_COLORS.primary,
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
  },
  title: {
    color: AUTH_COLORS.textPrimary,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.52)',
    textAlign: 'center',
  },
  footer: {
    paddingTop: 20,
    gap: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  primaryButton: {
    backgroundColor: AUTH_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AUTH_COLORS.primary,
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryButtonText: {
    color: AUTH_COLORS.primaryText,
    fontWeight: '600',
    marginRight: 8,
    letterSpacing: 0.2,
  },
  primaryButtonTextNoArrow: {
    marginRight: 0,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 4,
  },
  loginText: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
  },
  loginLink: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
});
