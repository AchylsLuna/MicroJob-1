import { useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import useReducedMotion from '../../hooks/useReducedMotion';
import { motion } from '../../theme/motion';
import { tokens } from '../../theme/tokens';

type Props = PressableProps & {
  containerStyle?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export default function AnimatedPressable({ containerStyle, pressedScale = motion.press.scale, disabled, children, onPressIn, onPressOut, onTouchCancel, ...props }: Props) {
  const reducedMotion = useReducedMotion() === true;
  const progress = useRef(new Animated.Value(0)).current;

  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const animate = useCallback((toValue: number) => {
    animationRef.current?.stop();
    animationRef.current = Animated.timing(progress, {
      toValue,
      duration: reducedMotion ? motion.duration.instant : motion.duration.fast,
      useNativeDriver: true,
    });
    animationRef.current.start(({ finished }) => {
      if (finished) animationRef.current = null;
    });
  }, [progress, reducedMotion]);

  useEffect(() => () => animationRef.current?.stop(), []);

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [disabled ? tokens.opacity.disabled : 1, disabled ? tokens.opacity.disabled : motion.press.opacity] }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, reducedMotion ? 1 : pressedScale] }) }],
        },
      ]}
    >
      <Pressable
        {...props}
        disabled={disabled}
        style={styles.pressable}
        onPressIn={(event) => {
          animate(1);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animate(0);
          onPressOut?.(event);
        }}
        onTouchCancel={(event) => {
          animate(0);
          onTouchCancel?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressable: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
});
