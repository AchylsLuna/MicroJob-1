import { forwardRef, type ButtonHTMLAttributes } from "react";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens, seconds } from "@/constants/motion";

/**
 * React's drag and animation DOM handlers share names with Framer's own props
 * but have incompatible signatures, so they are omitted rather than fought
 * with. Nothing in the app passes them to a button.
 */
export type PressableBaseProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
>;

type Props = PressableBaseProps & {
  /** Overrides the token press scale for a surface that needs a smaller dip. */
  pressedScale?: number;
};

/**
 * The web counterpart to `Mobile/components/ui/AnimatedPressable.tsx`.
 *
 * Gives a button real press feedback — a brief scale dip plus an opacity drop —
 * so taps acknowledge themselves. This matters more here than it might look:
 * the brand blue has no darker step (tailwind.config.js flattens 500–950 to one
 * value), so a colour change cannot express "pressed" and transform/opacity is
 * the only honest signal available.
 *
 * Reduced motion drops the scale but keeps the opacity change, matching the
 * mobile component: the animation is skipped, never merely shortened, and the
 * user still gets feedback that their press registered.
 */
export const Pressable = forwardRef<HTMLButtonElement, Props>(
  ({ pressedScale = motionTokens.press.scale, disabled, type = "button", ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion();

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled}
        whileTap={disabled ? undefined : { scale: prefersReducedMotion ? 1 : pressedScale, opacity: motionTokens.press.opacity }}
        transition={{ duration: seconds(motionTokens.duration.fast) }}
        {...props}
      />
    );
  },
);
Pressable.displayName = "Pressable";

export default Pressable;
