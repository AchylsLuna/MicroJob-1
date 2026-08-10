import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { tokens } from '../theme/tokens';
import { motion } from '../theme/motion';
import useReducedMotion from '../hooks/useReducedMotion';
import { MicroJobsLogoBadge, MicroJobsWordmark } from './auth/MicroJobsLogo';

const MINIMUM_DISPLAY_MS = 2000;

type Props = {
  sessionReady: boolean;
  onFinished: () => void;
};

export default function LaunchScreen({ sessionReady, onFinished }: Props) {
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const reduceMotion = useReducedMotion();
  const finishedRef = useRef(false);
  const entryStartedRef = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.88)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), MINIMUM_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (reduceMotion == null || entryStartedRef.current) return;
    entryStartedRef.current = true;
    opacity.setValue(0);
    badgeOpacity.setValue(0);
    badgeScale.setValue(reduceMotion ? 1 : 0.88);
    wordmarkOpacity.setValue(0);
    wordmarkTranslateY.setValue(reduceMotion ? 0 : motion.distance.small);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: reduceMotion ? motion.duration.fast : motion.duration.standard,
          useNativeDriver: true,
        }),
        Animated.timing(badgeOpacity, {
          toValue: 1,
          duration: motion.duration.standard,
          useNativeDriver: true,
        }),
        Animated.spring(badgeScale, {
          toValue: 1,
          damping: motion.spring.damping,
          stiffness: motion.spring.stiffness,
          mass: motion.spring.mass,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: motion.duration.standard,
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkTranslateY, {
          toValue: 0,
          duration: reduceMotion ? 0 : motion.duration.standard,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [badgeOpacity, badgeScale, opacity, reduceMotion, wordmarkOpacity, wordmarkTranslateY]);

  useEffect(() => {
    if (!minimumElapsed || !sessionReady || reduceMotion == null || finishedRef.current) return;
    finishedRef.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: reduceMotion ? motion.duration.fast : motion.duration.exit,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinished();
    });
  }, [minimumElapsed, onFinished, opacity, reduceMotion, sessionReady]);

  return (
    <Animated.View
      style={[styles.overlay, { opacity }]}
      accessibilityRole="progressbar"
      accessibilityLabel="MicroJobs is loading"
    >
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.glowLarge} />
      <View pointerEvents="none" style={styles.glowSmall} />
      <View style={styles.logoGroup}>
        <Animated.View style={{ opacity: badgeOpacity, transform: [{ scale: reduceMotion ? 1 : badgeScale }] }}>
          <MicroJobsLogoBadge variant="launch" />
        </Animated.View>
        <Animated.View style={{ opacity: wordmarkOpacity, transform: [{ translateY: reduceMotion ? 0 : wordmarkTranslateY }] }}>
          <MicroJobsWordmark variant="launch" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: tokens.colors.launchCanvas,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoGroup: {
    alignItems: 'center',
    gap: 22,
    paddingHorizontal: 24,
  },
  glowLarge: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: tokens.colors.brandSoft,
    opacity: 0.72,
  },
  glowSmall: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: tokens.colors.launchSurface,
    opacity: 0.92,
  },
});
