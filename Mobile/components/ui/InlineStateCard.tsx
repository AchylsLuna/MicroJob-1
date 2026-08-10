import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { motion } from '../../theme/motion';
import useReducedMotion from '../../hooks/useReducedMotion';
import AnimatedPressable from './AnimatedPressable';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
};

export default function InlineStateCard({ icon, title, message, actionLabel, onAction, busy = false }: Props) {
  const reducedMotion = useReducedMotion() === true;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: motion.duration.standard, useNativeDriver: true }).start();
  }, [progress]);

  return <Animated.View style={[styles.card, { opacity: progress, transform: [{ translateY: reducedMotion ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [motion.distance.small, 0] }) }] }]} accessibilityRole="text">
    <View style={styles.icon}><Ionicons name={icon} size={22} color={tokens.colors.brand} /></View>
    <View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text></View>
    {actionLabel && onAction ? <AnimatedPressable containerStyle={[styles.action, busy && styles.disabled]} onPress={onAction} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}><Text style={styles.actionText}>{busy ? 'Loading…' : actionLabel}</Text></AnimatedPressable> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: tokens.radius.lg, backgroundColor: tokens.colors.cardSoft, padding: tokens.spacing.lg, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, ...tokens.shadow.card },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: tokens.colors.contentSurface, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 160, gap: 3 },
  title: { color: tokens.colors.text, fontSize: 15, fontWeight: '800' },
  message: { color: tokens.colors.textMuted, fontSize: 12, lineHeight: 18 },
  action: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: tokens.colors.brand, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: tokens.colors.onBrand, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
