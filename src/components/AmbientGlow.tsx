/**
 * AmbientGlow — the living backdrop. Three huge, soft radial glows in the
 * brand tri-color drift and breathe slowly behind the content, like a
 * living WebGL backdrop. Pure UI-thread transforms — no WebGL, no cost.
 */
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

function Blob({
  color,
  size,
  startX,
  startY,
  driftX,
  driftY,
  duration,
  opacity,
}: {
  color: string;
  size: number;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  duration: number;
  opacity: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true, // reverse — drift back and forth forever
    );
  }, [duration, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: startX + t.value * driftX },
      { translateY: startY + t.value * driftY },
      { scale: 1 + t.value * 0.18 },
    ],
  }));

  return (
    <Animated.View style={[styles.blob, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="70%" stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#g)" />
      </Svg>
    </Animated.View>
  );
}

export function AmbientGlow() {
  // Softer on light backgrounds.
  const base = theme.scheme === 'dark' ? 1 : 0.5;
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Blob
        color="#7c3aed"
        size={W * 1.1}
        startX={-W * 0.35}
        startY={-H * 0.12}
        driftX={W * 0.22}
        driftY={H * 0.06}
        duration={13000}
        opacity={0.16 * base}
      />
      <Blob
        color="#14b8a6"
        size={W * 0.9}
        startX={W * 0.45}
        startY={H * 0.28}
        driftX={-W * 0.18}
        driftY={-H * 0.05}
        duration={17000}
        opacity={0.12 * base}
      />
      <Blob
        color="#ec4899"
        size={W * 0.8}
        startX={W * 0.15}
        startY={H * 0.62}
        driftX={W * 0.12}
        driftY={-H * 0.08}
        duration={21000}
        opacity={0.10 * base}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
  },
});
