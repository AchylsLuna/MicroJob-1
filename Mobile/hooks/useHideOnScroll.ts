import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import useReducedMotion from './useReducedMotion';

type UseHideOnScrollResult = {
  /** Attach to the scrollable list's `onScroll` prop. Requires `scrollEventThrottle`. */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Attach to the header's `onLayout` so the hide distance matches its real height. */
  onHeaderLayout: (event: LayoutChangeEvent) => void;
  /** Spread onto the `Animated.View` wrapping the header. */
  headerStyle: { transform: [{ translateY: number | Animated.AnimatedInterpolation<number> }] };
  /**
   * The header's measured height (or the fallback, before the first layout pass). Use it
   * as top padding on the scrollable content when the header is positioned absolutely
   * above it, so content doesn't render underneath the header initially.
   */
  headerHeight: number;
};

/**
 * Drives a header's translateY from a scrollable list's scroll offset, entirely on the
 * native driver: the header slides out of view as the list scrolls down and slides back
 * in as soon as the list scrolls up, using the standard `Animated.diffClamp` recipe.
 *
 * Reduced motion is respected by skipping the hide behavior outright (per the repo's
 * motion rules — skip, don't shorten): the header simply stays put.
 */
export default function useHideOnScroll(fallbackHeaderHeight = 96): UseHideOnScrollResult {
  const reducedMotion = useReducedMotion() === true;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [headerHeight, setHeaderHeight] = useState(fallbackHeaderHeight);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    if (measured > 0) setHeaderHeight(measured);
  }, []);

  const translateY = useMemo(() => {
    const clampedScroll = Animated.diffClamp(scrollY, 0, headerHeight);
    return clampedScroll.interpolate({
      inputRange: [0, headerHeight],
      outputRange: [0, -headerHeight],
      extrapolate: 'clamp',
    });
  }, [scrollY, headerHeight]);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  return {
    onScroll,
    onHeaderLayout,
    headerStyle: { transform: [{ translateY: reducedMotion ? 0 : translateY }] },
    headerHeight,
  };
}
