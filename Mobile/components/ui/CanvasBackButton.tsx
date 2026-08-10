import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  lightSurface?: boolean;
};

export default function CanvasBackButton({ onPress, style, accessibilityLabel = 'Go back', lightSurface = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.button, lightSurface && styles.lightButton, style, pressed && (lightSurface ? styles.lightPressed : styles.pressed)]}
    >
      <Feather name="arrow-left" size={22} color={lightSurface ? tokens.colors.brand : tokens.colors.onCanvas} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    transform: [{ scale: 0.97 }],
  },
  lightButton: { backgroundColor: tokens.colors.brandSoft },
  lightPressed: { backgroundColor: tokens.colors.brandMuted, transform: [{ scale: 0.97 }] },
});
