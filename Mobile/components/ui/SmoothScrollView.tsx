import React, { forwardRef } from 'react';
import {
  Platform,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

/**
 * App-wide scrolling defaults. Explicit screen props always take precedence.
 * Keeping this wrapper native preserves platform momentum and accessibility.
 */
const SmoothScrollView = forwardRef<ScrollView, ScrollViewProps>(function SmoothScrollView(
  { horizontal = false, ...props },
  ref,
) {
  return (
    <ScrollView
      ref={ref}
      horizontal={horizontal}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      scrollEventThrottle={16}
      overScrollMode="auto"
      {...props}
    />
  );
});

export default SmoothScrollView;
