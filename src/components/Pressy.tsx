/**
 * Pressy — a Pressable with consistent press feedback: a fast, subtle
 * scale + fade (150ms, Cybertron easing). Use it anywhere a control
 * needs to feel alive without hand-rolling animations.
 */
import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How far to shrink while pressed. */
  scaleTo?: number;
  children?: React.ReactNode;
}

export function Pressy({ style, scaleTo = 0.95, onPressIn, onPressOut, children, ...rest }: Props) {
  const pressed = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * 0.25,
  }));

  return (
    <AnimatedPressable
      style={[style, animStyle]}
      onPressIn={(e) => {
        // Snappy in — a quick tap should still visibly dip.
        pressed.value = withTiming(1, { duration: 80, easing: theme.motion.easing });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // Smooth out.
        pressed.value = withTiming(0, { duration: 200, easing: theme.motion.easing });
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
