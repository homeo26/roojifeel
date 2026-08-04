/**
 * TrendChart — weekly series rendered as an SVG line chart with a
 * 3-week moving average overlay. Used for positivity % and average
 * intensity trends.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { theme } from '../theme';

export interface TrendPoint {
  /** Short x-axis label (e.g. "W28" or "12 Jun"). */
  label: string;
  /** Null = no data that week (gap in the line). */
  value: number | null;
}

interface Props {
  points: TrendPoint[];
  /** Y-axis max (min is 0). */
  max: number;
  color: string;
  height?: number;
  /** Formats a value for the last-point badge. */
  format?: (v: number) => string;
  labelFont: string;
}

function movingAverage(points: TrendPoint[], window = 3): Array<number | null> {
  return points.map((_, i) => {
    const slice = points
      .slice(Math.max(0, i - window + 1), i + 1)
      .map((p) => p.value)
      .filter((v): v is number => v != null);
    if (slice.length === 0) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function buildPath(
  values: Array<number | null>,
  w: number,
  h: number,
  max: number,
  pad: number,
): string {
  const n = values.length;
  const stepX = n > 1 ? (w - pad * 2) / (n - 1) : 0;
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - Math.min(v, max) / max);
    d += pen ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  });
  return d.trim();
}

export function TrendChart({
  points,
  max,
  color,
  height = 120,
  format = (v) => v.toFixed(0),
  labelFont,
}: Props) {
  const [width, setWidth] = React.useState(0);
  const pad = 10;
  const avg = movingAverage(points);
  const lastIdx = (() => {
    for (let i = points.length - 1; i >= 0; i--) if (points[i].value != null) return i;
    return -1;
  })();

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {/* Gridlines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <Line
              key={f}
              x1={pad}
              x2={width - pad}
              y1={pad + (height - pad * 2) * f}
              y2={pad + (height - pad * 2) * f}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}
          {/* Moving average (dashed, brighter) */}
          <Path
            d={buildPath(avg, width, height, max, pad)}
            stroke={color}
            strokeOpacity={0.35}
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="none"
          />
          {/* Raw weekly line */}
          <Path
            d={buildPath(points.map((p) => p.value), width, height, max, pad)}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Point markers */}
          {points.map((p, i) => {
            if (p.value == null) return null;
            const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
            const x = pad + i * stepX;
            const y = pad + (height - pad * 2) * (1 - Math.min(p.value, max) / max);
            return <Circle key={i} cx={x} cy={y} r={i === lastIdx ? 4 : 2.5} fill={color} />;
          })}
        </Svg>
      ) : null}
      {/* X labels: first, middle, last */}
      <View style={styles.xLabels}>
        <Text style={[styles.xLabel, { fontFamily: labelFont }]}>{points[0]?.label ?? ''}</Text>
        <Text style={[styles.xLabel, { fontFamily: labelFont }]}>
          {points[Math.floor(points.length / 2)]?.label ?? ''}
        </Text>
        <Text style={[styles.xLabel, { fontFamily: labelFont }]}>
          {points[points.length - 1]?.label ?? ''}
        </Text>
      </View>
      {lastIdx >= 0 ? (
        <View style={[styles.badge, { borderColor: color }]}>
          <Text style={[styles.badgeText, { color, fontFamily: labelFont }]}>
            {format(points[lastIdx].value as number)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 2,
  },
  xLabel: {
    fontSize: 9,
    color: theme.colors.inkFaint,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    position: 'absolute',
    top: 0,
    end: 0,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surfaceSolid,
  },
  badgeText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
