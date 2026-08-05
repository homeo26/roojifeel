/**
 * The Feelings Wheel — a fullscreen, spinnable rendition of the classic
 * three-ring wheel. Drag to spin (with inertia), tap any segment to see
 * its path, and log the selected feeling in one tap.
 */
import React, { useMemo, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { G, Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CoreFeeling, FEELINGS_WHEEL, getCore, getSecondary, getTertiary, label } from '../src/data/feelings';
import { theme, font, displayFont } from '../src/theme';
import * as haptics from '../src/haptics';

const { width: SCREEN_W } = Dimensions.get('window');
const WHEEL_SIZE = SCREEN_W - 24;
const R = WHEEL_SIZE / 2;
const CX = R;
const CY = R;

// Ring radii (fractions of R)
const R_HOLE = 0.17;
const R_CORE = 0.44;
const R_SEC = 0.72;
const R_TERT = 0.99;

interface Segment {
  path: string;
  color: string;
  coreId: string;
  secondaryId?: string;
  tertiaryId?: string;
  key: string;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Annular sector path between radii r0..r1 and angles a0..a1 (degrees). */
function sector(r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const p1 = polar(CX, CY, r1, a0);
  const p2 = polar(CX, CY, r1, a1);
  const p3 = polar(CX, CY, r0, a1);
  const p4 = polar(CX, CY, r0, a0);
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/** Build every wheel segment with angular spans proportional to leaf count. */
function buildSegments(): { segments: Segment[]; coreCenters: Array<{ coreId: string; emoji: string; x: number; y: number }> } {
  const segments: Segment[] = [];
  const coreCenters: Array<{ coreId: string; emoji: string; x: number; y: number }> = [];
  const leafCount = (c: CoreFeeling) =>
    c.children.reduce((sum, s) => sum + (s.children?.length ?? 0), 0);
  const totalLeaves = FEELINGS_WHEEL.reduce((sum, c) => sum + leafCount(c), 0);

  let angle = 0;
  for (const core of FEELINGS_WHEEL) {
    const span = (leafCount(core) / totalLeaves) * 360;
    segments.push({
      path: sector(R * R_HOLE, R * R_CORE - 1.5, angle + 0.6, angle + span - 0.6),
      color: core.color,
      coreId: core.id,
      key: core.id,
    });
    const mid = polar(CX, CY, R * ((R_HOLE + R_CORE) / 2), angle + span / 2);
    coreCenters.push({ coreId: core.id, emoji: core.emoji, x: mid.x, y: mid.y });

    let secAngle = angle;
    for (const sec of core.children) {
      const secSpan = ((sec.children?.length ?? 0) / totalLeaves) * 360;
      segments.push({
        path: sector(R * R_CORE, R * R_SEC - 1.5, secAngle + 0.5, secAngle + secSpan - 0.5),
        color: core.colorMid,
        coreId: core.id,
        secondaryId: sec.id,
        key: `${core.id}/${sec.id}`,
      });
      let tertAngle = secAngle;
      for (const tert of sec.children ?? []) {
        const tertSpan = (1 / totalLeaves) * 360;
        segments.push({
          path: sector(R * R_SEC, R * R_TERT, tertAngle + 0.45, tertAngle + tertSpan - 0.45),
          color: core.colorOuter,
          coreId: core.id,
          secondaryId: sec.id,
          tertiaryId: tert.id,
          key: `${core.id}/${sec.id}/${tert.id}`,
        });
        tertAngle += tertSpan;
      }
      secAngle += secSpan;
    }
    angle += span;
  }
  return { segments, coreCenters };
}

export default function WheelScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const [selected, setSelected] = useState<Segment | null>(null);

  const { segments, coreCenters } = useMemo(buildSegments, []);

  // Spin physics
  const rotation = useSharedValue(0);
  const startRotation = useSharedValue(0);
  const startTouchAngle = useSharedValue(0);

  const pan = Gesture.Pan()
    .minDistance(10)
    .onStart((e) => {
      startRotation.value = rotation.value;
      startTouchAngle.value =
        (Math.atan2(e.y - CY, e.x - CX) * 180) / Math.PI;
    })
    .onUpdate((e) => {
      const a = (Math.atan2(e.y - CY, e.x - CX) * 180) / Math.PI;
      rotation.value = startRotation.value + (a - startTouchAngle.value);
    })
    .onEnd((e) => {
      // Tangential velocity → angular velocity (deg/s)
      const dx = e.x - CX;
      const dy = e.y - CY;
      const r2 = Math.max(dx * dx + dy * dy, 400);
      const omega = ((dx * e.velocityY - dy * e.velocityX) / r2) * (180 / Math.PI);
      rotation.value = withDecay({ velocity: omega, deceleration: 0.9985 });
    });

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const onSelect = (seg: Segment) => {
    haptics.selection();
    setSelected(seg);
  };

  const core = selected ? getCore(selected.coreId) : undefined;
  const secondary = selected?.secondaryId
    ? getSecondary(selected.coreId, selected.secondaryId)
    : undefined;
  const tertiary =
    selected?.secondaryId && selected?.tertiaryId
      ? getTertiary(selected.coreId, selected.secondaryId, selected.tertiaryId)
      : undefined;

  const logSelected = () => {
    if (!selected) return;
    haptics.impact();
    router.dismiss();
    router.push({
      pathname: '/log',
      params: {
        coreId: selected.coreId,
        ...(selected.secondaryId ? { secondaryId: selected.secondaryId } : {}),
        ...(selected.tertiaryId ? { tertiaryId: selected.tertiaryId } : {}),
      },
    });
  };

  return (
    <SafeAreaView
      style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]}
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={theme.colors.ink} />
        </Pressable>
        <Text style={[styles.title, { fontFamily: displayFont(lang) }]}>{t('wheel.title')}</Text>
        <View style={styles.headerBtn} />
      </View>
      <Text style={[styles.hint, { fontFamily: font(lang, 'regular') }]}>{t('wheel.hint')}</Text>

      {/* The wheel */}
      <View style={styles.wheelWrap}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ width: WHEEL_SIZE, height: WHEEL_SIZE }, wheelStyle]}>
            <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
              <G>
                {segments.map((seg) => (
                  <Path
                    key={seg.key}
                    d={seg.path}
                    fill={seg.color}
                    opacity={
                      selected == null
                        ? 1
                        : selected.key === seg.key
                          ? 1
                          : selected.coreId === seg.coreId
                            ? 0.75
                            : 0.28
                    }
                    stroke={selected?.key === seg.key ? '#FFFFFF' : 'transparent'}
                    strokeWidth={selected?.key === seg.key ? 2 : 0}
                    onPress={() => onSelect(seg)}
                  />
                ))}
              </G>
            </Svg>
            {/* Core emojis */}
            {coreCenters.map((c) => (
              <View
                key={c.coreId}
                pointerEvents="none"
                style={[styles.coreEmojiWrap, { left: c.x - 13, top: c.y - 13 }]}
              >
                <Text style={styles.coreEmoji}>{c.emoji}</Text>
              </View>
            ))}
            {/* Center logo */}
            <View pointerEvents="none" style={styles.centerLogoWrap}>
              <Image
                source={require('../assets/logo-circle.png')}
                style={{ width: R * R_HOLE * 2 - 14, height: R * R_HOLE * 2 - 14 }}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Selection card */}
      {selected && core ? (
        <Animated.View entering={FadeInDown.duration(220)} style={styles.card}>
          <View style={[styles.cardStripe, { backgroundColor: core.color }]} />
          <View style={styles.cardBody}>
            <Text style={[styles.cardPath, { fontFamily: font(lang, 'semibold') }]}>
              {core.emoji} {label(core, lang)}
              {secondary ? `  ›  ${label(secondary, lang)}` : ''}
            </Text>
            <Text style={[styles.cardFeeling, { fontFamily: displayFont(lang), color: core.colorMid }]}>
              {tertiary ? label(tertiary, lang) : secondary ? label(secondary, lang) : label(core, lang)}
            </Text>
          </View>
          <Pressable onPress={logSelected}>
            {({ pressed }) => (
              <LinearGradient
                colors={theme.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.logBtn, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={[styles.logBtnText, { fontFamily: font(lang, 'bold') }]}>
                  {t('wheel.logThis')}
                </Text>
              </LinearGradient>
            )}
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(300)} style={styles.emptyCard}>
          <Text style={[styles.emptyText, { fontFamily: font(lang, 'regular') }]}>
            {t('wheel.tapPrompt')}
          </Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    letterSpacing: -0.4,
    color: theme.colors.ink,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.inkFaint,
    textAlign: 'center',
    marginTop: 2,
  },
  wheelWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreEmojiWrap: {
    position: 'absolute',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreEmoji: {
    fontSize: 18,
  },
  centerLogoWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSolid,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    overflow: 'hidden',
  },
  cardStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardBody: {
    flex: 1,
  },
  cardPath: {
    fontSize: 12,
    color: theme.colors.inkSoft,
    textAlign: 'left',
  },
  cardFeeling: {
    fontSize: 24,
    letterSpacing: -0.5,
    marginTop: 2,
    textAlign: 'left',
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  logBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  emptyCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderBright,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.inkFaint,
  },
});
