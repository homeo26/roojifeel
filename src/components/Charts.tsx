/**
 * Kibana-style SVG visualizations: semi-circular gauge, donut chart,
 * and a daily activity bar sparkline. Pure react-native-svg, animated
 * with short subtle transitions.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const TIMING = { duration: theme.motion.base, easing: theme.motion.easing };

/* ------------------------------------------------------------------ */
/* Gauge — semi-circular, Kibana style                                  */
/* ------------------------------------------------------------------ */

interface GaugeProps {
  /** 0..1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  /** Big center label. */
  label: string;
  /** Small caption under the label. */
  caption?: string;
  labelFont: string;
  captionFont: string;
}

export function Gauge({
  value,
  size = 150,
  strokeWidth = 14,
  color = theme.colors.teal,
  trackColor = 'rgba(255,255,255,0.08)',
  label,
  caption,
  labelFont,
  captionFont,
}: GaugeProps) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r; // semi-circle
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(Math.max(value, 0), 1), TIMING);
  }, [value, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const d = `M ${strokeWidth / 2} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${cy}`;

  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <Svg width={size} height={cy + strokeWidth / 2}>
        <Path d={d} stroke={trackColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <AnimatedPath
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, gaugeStyles.center, { paddingTop: cy - 26 }]}>
        <Text style={[gaugeStyles.label, { fontFamily: labelFont }]}>{label}</Text>
        {caption ? (
          <Text style={[gaugeStyles.caption, { fontFamily: captionFont }]}>{caption}</Text>
        ) : null}
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  label: {
    fontSize: 26,
    color: theme.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: 11,
    color: theme.colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 0,
  },
});

/* ------------------------------------------------------------------ */
/* Donut — distribution ring                                            */
/* ------------------------------------------------------------------ */

export interface DonutSlice {
  value: number;
  color: string;
}

interface DonutProps {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  /** Big center label. */
  label: string;
  caption?: string;
  labelFont: string;
  captionFont: string;
}

export function Donut({
  slices,
  size = 168,
  strokeWidth = 18,
  label,
  caption,
  labelFont,
  captionFont,
}: DonutProps) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const gap = slices.length > 1 ? 2.5 : 0; // degrees of separation

  let cumulative = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={cx} originY={cy}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {slices.map((slice, i) => {
            const startAngle = (cumulative / total) * 360;
            const sweep = (slice.value / total) * 360;
            cumulative += slice.value;
            const arcLen = Math.max(((sweep - gap) / 360) * circumference, 2);
            const offset = (startAngle / 360) * circumference;
            return (
              <Circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                stroke={slice.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="butt"
                strokeDasharray={`${arcLen} ${circumference - arcLen}`}
                strokeDashoffset={-offset}
              />
            );
          })}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, donutStyles.center]}>
        <Text style={[donutStyles.label, { fontFamily: labelFont }]}>{label}</Text>
        {caption ? (
          <Text style={[donutStyles.caption, { fontFamily: captionFont }]}>{caption}</Text>
        ) : null}
      </View>
    </View>
  );
}

const donutStyles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 30,
    color: theme.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: 10,
    color: theme.colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

/* ------------------------------------------------------------------ */
/* ActivityBars — daily check-in sparkline                              */
/* ------------------------------------------------------------------ */

interface ActivityBarsProps {
  /** One value per day, oldest first. */
  values: number[];
  height?: number;
  color?: string;
}

export function ActivityBars({ values, height = 56, color = theme.colors.purple }: ActivityBarsProps) {
  const max = Math.max(...values, 1);
  const barGap = 3;

  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: barGap }}>
      {values.map((v, i) => (
        <Bar key={i} heightPx={Math.max((v / max) * height, 3)} active={v > 0} color={color} />
      ))}
    </View>
  );
}

function Bar({
  heightPx,
  active,
  color,
}: {
  heightPx: number;
  active: boolean;
  color: string;
}) {
  const h = useSharedValue(3);

  useEffect(() => {
    h.value = withTiming(heightPx, {
      duration: theme.motion.base,
      easing: theme.motion.easing,
    });
  }, [heightPx, h]);

  const animatedStyle = useAnimatedStyle(() => ({ height: h.value }));

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          borderRadius: 2,
          backgroundColor: active ? color : 'rgba(255,255,255,0.08)',
        },
        animatedStyle,
      ]}
    />
  );
}
