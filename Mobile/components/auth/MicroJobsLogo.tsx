import { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AUTH_COLORS } from '../../theme/authTheme';
import useReducedMotion from '../../hooks/useReducedMotion';
import { motion } from '../../theme/motion';
import AnimatedPressable from '../ui/AnimatedPressable';

type LogoVariant = 'default' | 'compact' | 'launch';

export function MicroJobsLogoBadge({ variant = 'default', style }: { variant?: LogoVariant; style?: StyleProp<ViewStyle> }) {
  const size = variant === 'launch' ? 82 : variant === 'compact' ? 34 : 42;
  return <View style={[styles.badge, { width: size, height: size, borderRadius: variant === 'launch' ? 26 : variant === 'compact' ? 11 : 13 }, style]}>
    <Text style={[styles.badgeText, variant === 'compact' && styles.badgeTextCompact, variant === 'launch' && styles.badgeTextLaunch]}>M</Text>
  </View>;
}

export function AnimatedMicroJobsLogoBadge({ variant = 'compact' }: { variant?: LogoVariant }) {
  const reducedMotion = useReducedMotion();
  const size = variant === 'launch' ? 82 : variant === 'compact' ? 34 : 42;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  // Turns of *extra* rotation layered on top of the badge's own static 30deg
  // tilt. Entrance settles this from a small overshoot down to 0; a tap
  // animates it 0 -> 1 (one full turn, landing back at the resting tilt) as a
  // delight-only easter egg -- the badge is purely decorative branding and
  // doesn't navigate anywhere, so this has zero functional consequence.
  const spin = useRef(new Animated.Value(-0.03)).current;
  const spinningRef = useRef(false);

  useEffect(() => {
    if (reducedMotion == null) return;
    opacity.setValue(0);
    scale.setValue(reducedMotion ? 1 : 0.9);
    spin.setValue(reducedMotion ? 0 : -0.03);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: reducedMotion ? motion.duration.instant : motion.duration.enter,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: motion.spring.damping,
        stiffness: motion.spring.stiffness,
        mass: motion.spring.mass,
        useNativeDriver: true,
      }),
      Animated.timing(spin, {
        toValue: 0,
        duration: reducedMotion ? motion.duration.instant : motion.duration.enter,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion, scale, spin]);

  const handlePress = useCallback(() => {
    // Reduced motion means skip, not shorten -- a tap does nothing at all rather
    // than play a fast version, since the whole interaction is decorative.
    if (reducedMotion !== false || spinningRef.current) return;
    spinningRef.current = true;
    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1,
      duration: motion.duration.standard,
      useNativeDriver: true,
    }).start(({ finished }) => {
      spinningRef.current = false;
      if (finished) spin.setValue(0); // 360deg reads identical to 0deg -- no visible reset
    });
  }, [reducedMotion, spin]);

  const rotate = spin.interpolate({ inputRange: [-0.03, 0, 1], outputRange: ['-11deg', '0deg', '360deg'] });

  return (
    <AnimatedPressable
      onPress={handlePress}
      containerStyle={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no"
    >
      <Animated.View style={{ opacity, transform: [{ scale: reducedMotion ? 1 : scale }, { rotate: reducedMotion ? '0deg' : rotate }] }}>
        <MicroJobsLogoBadge variant={variant} />
      </Animated.View>
    </AnimatedPressable>
  );
}

export function MicroJobsWordmark({ variant = 'default', style }: { variant?: LogoVariant; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.wordmark, variant === 'compact' && styles.wordmarkCompact, variant === 'launch' && styles.wordmarkLaunch, style]}><Text style={styles.micro}>Micro</Text>Jobs</Text>;
}

export default function MicroJobsLogo({ compact = false, variant }: { compact?: boolean; variant?: LogoVariant }) {
  const resolvedVariant = variant || (compact ? 'compact' : 'default');
  return <View style={styles.row} accessibilityRole="image" accessibilityLabel="MicroJobs">
    <MicroJobsLogoBadge variant={resolvedVariant} />
    <MicroJobsWordmark variant={resolvedVariant} />
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  badge: { backgroundColor: AUTH_COLORS.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '30deg' }] },
  badgeText: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', transform: [{ rotate: '-30deg' }] },
  badgeTextCompact: { fontSize: 17 },
  badgeTextLaunch: { fontSize: 40 },
  wordmark: { color: AUTH_COLORS.primary, fontSize: 24, fontWeight: '800', letterSpacing: -0.6, flexShrink: 1 },
  wordmarkCompact: { fontSize: 20 },
  wordmarkLaunch: { fontSize: 38, letterSpacing: -1 },
  micro: { color: AUTH_COLORS.backgroundDeep },
});
