import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import useReducedMotion from '../../hooks/useReducedMotion';
import { motion } from '../../theme/motion';
import { tokens } from '../../theme/tokens';

type Props = PressableProps & {
  containerStyle?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export default function AnimatedPressable({ containerStyle, pressedScale = motion.press.scale, disabled, children, onPressIn, onPressOut, ...props }: Props) {
  const reducedMotion = useReducedMotion() === true;
  const progress = useRef(new Animated.Value(0)).current;

  const animate = (toValue: number) => {
    Animated.timing(progress, {
      toValue,
      duration: reducedMotion ? 0 : motion.duration.fast,
      useNativeDriver: true,
    }).start();
  };

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
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressable: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
});
