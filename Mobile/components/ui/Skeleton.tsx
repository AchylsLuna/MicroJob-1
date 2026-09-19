import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import useReducedMotion from '../../hooks/useReducedMotion';
import { motion } from '../../theme/motion';
import { tokens } from '../../theme/tokens';

type Props = {
  style?: StyleProp<ViewStyle>;
};

/**
 * A single placeholder block for content whose shape is known before it loads.
 *
 * Extracted from the inline skeleton in `NotificationFeedView`, which was the
 * only screen with one. Compose rows from several blocks rather than adding
 * variant props, so each screen's placeholder matches its real layout.
 *
 * Under reduced motion the pulse is skipped entirely and the block simply sits
 * at its resting opacity — never a slowed-down version of the same animation.
 */
export default function Skeleton({ style }: Props) {
  const reducedMotion = useReducedMotion() === true;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: motion.duration.launch, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: motion.duration.launch, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        style,
        reducedMotion ? null : { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.contentMuted },
});
