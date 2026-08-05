/**
 * The Feelings Wheel — a fullscreen, spinnable, zoomable rendition of the
 * classic three-ring wheel. Drag to spin (inertia), pinch to zoom (centered),
 * tap any segment: it pops with an animated highlight and a selection card.
 */
import React, { useMemo, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CoreFeeling,
  FEELINGS_WHEEL,
  FeelingNode,
  getCore,
  getSecondary,
  getTertiary,
  label,
} from '../src/data/feelings';
import { theme, font, displayFont } from '../src/theme';
import * as haptics from '../src/haptics';

const { width: SCREEN_W } = Dimensions.get('window');
const WHEEL_SIZE = SCREEN_W - 16;
const R = WHEEL_SIZE / 2;
const CX = R;
const CY = R;

const R_HOLE = 0.15;
const R_CORE = 0.40;
const R_SEC = 0.70;
const R_TERT = 0.99;

interface Segment {
  path: string;
  color: string;
  coreId: string;
  secondaryId?: string;
  tertiaryId?: string;
  key: string;
  node: FeelingNode;
  // Label placement
  lx: number;
  ly: number;
  lrot: number;
  lsize: number;
  lcolor: string;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

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

/** Radial label transform: text runs along the radius, kept upright. */
function radialLabel(midAngle: number, radius: number) {
  const pos = polar(CX, CY, radius, midAngle);
  // Rotate text to lie along the radius; flip on the left half so it reads outward.
  let rot = midAngle - 90;
  if (midAngle > 180) rot = midAngle + 90;
  return { x: pos.x, y: pos.y, rot };
}

function buildSegments(): {
  segments: Segment[];
  coreCenters: Array<{ coreId: string; emoji: string; x: number; y: number }>;
} {
  const segments: Segment[] = [];
  const coreCenters: Array<{ coreId: string; emoji: string; x: number; y: number }> = [];
  const leafCount = (c: CoreFeeling) =>
    c.children.reduce((sum, s) => sum + (s.children?.length ?? 0), 0);
  const totalLeaves = FEELINGS_WHEEL.reduce((sum, c) => sum + leafCount(c), 0);

  let angle = 0;
  for (const core of FEELINGS_WHEEL) {
    const span = (leafCount(core) / totalLeaves) * 360;
    const coreMid = angle + span / 2;
    const coreLabel = radialLabel(coreMid, R * (R_CORE - 0.065));
    segments.push({
      path: sector(R * R_HOLE, R * R_CORE - 1.5, angle + 0.6, angle + span - 0.6),
      color: core.color,
      coreId: core.id,
      key: core.id,
      node: core,
      lx: coreLabel.x,
      ly: coreLabel.y,
      lrot: coreLabel.rot,
      lsize: 13,
      lcolor: '#FFFFFF',
    });
    const emojiPos = polar(CX, CY, R * (R_HOLE + 0.06), coreMid);
    coreCenters.push({ coreId: core.id, emoji: core.emoji, x: emojiPos.x, y: emojiPos.y });

    let secAngle = angle;
    for (const sec of core.children) {
      const secSpan = ((sec.children?.length ?? 0) / totalLeaves) * 360;
      const secLbl = radialLabel(secAngle + secSpan / 2, R * ((R_CORE + R_SEC) / 2));
      segments.push({
        path: sector(R * R_CORE, R * R_SEC - 1.5, secAngle + 0.5, secAngle + secSpan - 0.5),
        color: core.colorMid,
        coreId: core.id,
        secondaryId: sec.id,
        key: `${core.id}/${sec.id}`,
        node: sec,
        lx: secLbl.x,
        ly: secLbl.y,
        lrot: secLbl.rot,
        lsize: 9.5,
        lcolor: '#FFFFFF',
      });
      let tertAngle = secAngle;
      for (const tert of sec.children ?? []) {
        const tertSpan = (1 / totalLeaves) * 360;
        const tertLbl = radialLabel(tertAngle + tertSpan / 2, R * ((R_SEC + R_TERT) / 2));
        segments.push({
          path: sector(R * R_SEC, R * R_TERT, tertAngle + 0.45, tertAngle + tertSpan - 0.45),
          color: core.colorOuter,
          coreId: core.id,
          secondaryId: sec.id,
          tertiaryId: tert.id,
          key: `${core.id}/${sec.id}/${tert.id}`,
          node: tert,
          lx: tertLbl.x,
          ly: tertLbl.y,
          lrot: tertLbl.rot,
          lsize: 7.5,
          lcolor: 'rgba(255,255,255,0.95)',
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
  const { zoom } = useLocalSearchParams<{ zoom?: string }>();
  const [zoomed, setZoomed] = useState(false);

  const { segments, coreCenters } = useMemo(buildSegments, []);

  // Spin + zoom physics
  const rotation = useSharedValue(0);
  const startRotation = useSharedValue(0);
  const startTouchAngle = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);

  // Dev/deep-link zoom control (also lets links open the wheel pre-zoomed).
  React.useEffect(() => {
    const z = zoom ? Number(zoom) : NaN;
    if (!Number.isNaN(z)) {
      scale.value = withTiming(Math.min(Math.max(z, 1), 3.2), {
        duration: 400,
        easing: theme.motion.easing,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  useDerivedValue(() => {
    runOnJS(setZoomed)(scale.value > 1.08);
  });

  const pan = Gesture.Pan()
    .minDistance(10)
    .maxPointers(1)
    .onStart((e) => {
      startRotation.value = rotation.value;
      startTouchAngle.value = (Math.atan2(e.y - CY, e.x - CX) * 180) / Math.PI;
    })
    .onUpdate((e) => {
      const a = (Math.atan2(e.y - CY, e.x - CX) * 180) / Math.PI;
      rotation.value = startRotation.value + (a - startTouchAngle.value);
    })
    .onEnd((e) => {
      const dx = e.x - CX;
      const dy = e.y - CY;
      const r2 = Math.max(dx * dx + dy * dy, 400);
      const omega = ((dx * e.velocityY - dy * e.velocityX) / r2) * (180 / Math.PI);
      rotation.value = withDecay({ velocity: omega, deceleration: 0.9985 });
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = startScale.value * e.scale;
      scale.value = Math.min(Math.max(next, 1), 3.2);
    });

  const gestures = Gesture.Simultaneous(pan, pinch);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  const resetZoom = () => {
    haptics.selection();
    scale.value = withTiming(1, { duration: 280, easing: theme.motion.easing });
  };

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
        <View style={styles.headerBtn}>
          {zoomed ? (
            <Pressable onPress={resetZoom} hitSlop={10}>
              <Ionicons name="contract-outline" size={20} color={theme.colors.inkSoft} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <Text style={[styles.hint, { fontFamily: font(lang, 'regular') }]}>{t('wheel.hint')}</Text>

      {/* The wheel */}
      <View style={styles.wheelWrap}>
        <GestureDetector gesture={gestures}>
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
                            ? 0.8
                            : 0.3
                    }
                    onPress={() => onSelect(seg)}
                  />
                ))}
                {/* Animated highlight overlay for the selected segment */}
                {selected ? (
                  <Path
                    key={`hl-${selected.key}`}
                    d={selected.path}
                    fill="transparent"
                    stroke="#FFFFFF"
                    strokeWidth={2.5}
                    pointerEvents="none"
                  />
                ) : null}
              </G>
              {/* Labels */}
              <G pointerEvents="none">
                {segments.map((seg) => (
                  <SvgText
                    key={`lbl-${seg.key}`}
                    x={seg.lx}
                    y={seg.ly}
                    fill={seg.lcolor}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={0.35}
                    fontSize={seg.lsize}
                    fontWeight="bold"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    transform={`rotate(${seg.lrot.toFixed(1)}, ${seg.lx.toFixed(1)}, ${seg.ly.toFixed(1)})`}
                    opacity={
                      selected == null ? 1 : selected.coreId === seg.coreId ? 1 : 0.35
                    }
                  >
                    {label(seg.node, lang)}
                  </SvgText>
                ))}
              </G>
            </Svg>
            {/* Core emojis */}
            {coreCenters.map((c) => (
              <View
                key={c.coreId}
                pointerEvents="none"
                style={[styles.coreEmojiWrap, { left: c.x - 11, top: c.y - 11 }]}
              >
                <Text style={styles.coreEmoji}>{c.emoji}</Text>
              </View>
            ))}
            {/* Center logo */}
            <View pointerEvents="none" style={styles.centerLogoWrap}>
              <Image
                source={require('../assets/logo-circle.png')}
                style={{ width: R * R_HOLE * 2 - 12, height: R * R_HOLE * 2 - 12 }}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Selection card — re-keyed so every selection animates in */}
      {selected && core ? (
        <Animated.View
          key={selected.key}
          entering={FadeInDown.duration(220).springify().damping(18)}
          style={styles.card}
        >
          <View style={[styles.cardStripe, { backgroundColor: core.color }]} />
          <Animated.View entering={ZoomIn.delay(60).duration(180)} style={styles.cardEmojiWrap}>
            <Text style={styles.cardEmoji}>{core.emoji}</Text>
          </Animated.View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardPath, { fontFamily: font(lang, 'semibold') }]}>
              {label(core, lang)}
              {secondary ? `  ›  ${label(secondary, lang)}` : ''}
            </Text>
            <Text
              style={[styles.cardFeeling, { fontFamily: displayFont(lang), color: core.colorMid }]}
            >
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
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreEmoji: {
    fontSize: 15,
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
    gap: 10,
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
  cardEmojiWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 26,
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
    fontSize: 22,
    letterSpacing: -0.5,
    marginTop: 1,
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
