import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as haptics from '../haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { FeelingEntry, deleteEntry, getAllEntries } from '../db';
import { FEELINGS_WHEEL, getCore } from '../data/feelings';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EntryCard } from '../components/EntryCard';
import { theme, font, displayFont } from '../theme';
import { isSameDay } from '../timeFormat';
import { useTabPager } from './TabPagerContext';
import { CoreLegend } from '../components/CoreLegend';
import { AmbientGlow } from '../components/AmbientGlow';
import { claimMilestone, computeStreak, nextMilestone } from '../streaks';
import { refreshWidget } from '../widget/RoojifeelWidget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDED_KEY } from '../../app/onboarding';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DAY_MS = 24 * 60 * 60 * 1000;
const fade = (delay = 0) => FadeIn.duration(theme.motion.base).delay(delay);

export function HomeScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const { goToTab } = useTabPager();
  const [entries, setEntries] = useState<FeelingEntry[]>([]);
  const [celebration, setCelebration] = useState<number | null>(null);
  const scale = useSharedValue(1);

  // First launch → cozy onboarding.
  React.useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then((v) => {
      if (v !== 'true') router.push('/onboarding');
    });
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAllEntries().then((all) => {
        if (active) setEntries(all);
        refreshWidget(all, lang).catch(() => {});
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const today = new Date();
  const hour = today.getHours();
  const greetingKey =
    hour >= 5 && hour < 12
      ? 'greetingMorning'
      : hour >= 12 && hour < 17
        ? 'greetingAfternoon'
        : hour >= 17 && hour < 22
          ? 'greetingEvening'
          : 'greetingNight';
  const todayCount = entries.filter((e) => isSameDay(new Date(e.createdAt), today)).length;
  const recent = entries.slice(0, 4);

  const streak = useMemo(() => computeStreak(entries), [entries]);

  // One-time cozy celebration when a milestone is first reached.
  React.useEffect(() => {
    if (streak === 0) return;
    claimMilestone(streak).then((m) => {
      if (m != null) setCelebration(m);
    });
  }, [streak]);

  // Mood flow: dominant core per day over the last 14 days, oldest first.
  const moodFlow = useMemo(() => {
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const days: Array<ReturnType<typeof getCore> | null> = [];
    for (let i = 13; i >= 0; i--) {
      const from = startOfToday - i * DAY_MS;
      const to = from + DAY_MS;
      const counts = new Map<string, number>();
      for (const e of entries) {
        if (e.createdAt >= from && e.createdAt < to) {
          for (const f of e.feelings) counts.set(f.coreId, (counts.get(f.coreId) ?? 0) + 1);
        }
      }
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      days.push(top ? getCore(top[0]) ?? null : null);
    }
    return days;
  }, [entries, today]);

  // Memory: an entry from roughly one week ago (6-8 day window).
  const memory = useMemo(() => {
    const from = Date.now() - 8 * DAY_MS;
    const to = Date.now() - 6 * DAY_MS;
    return entries.find((e) => e.createdAt >= from && e.createdAt <= to) ?? null;
  }, [entries]);

  // Rotating daily reflection prompt.
  const promptIndex = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 0).getTime();
    const dayOfYear = Math.floor((today.getTime() - start) / DAY_MS);
    return (dayOfYear % 30) + 1;
  }, [today]);

  // Dominant feeling today for the hero accent.
  const dominantCore = useMemo(() => {
    const todays = entries.filter((e) => isSameDay(new Date(e.createdAt), today));
    if (todays.length === 0) return null;
    const counts = new Map<string, number>();
    for (const e of todays)
      for (const f of e.feelings) counts.set(f.coreId, (counts.get(f.coreId) ?? 0) + 1);
    if (counts.size === 0) return null;
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return getCore(top[0]) ?? null;
  }, [entries, today]);

  // Most frequent core over the last 7 days — powers the insight card.
  const weekTopCore = useMemo(() => {
    const weekAgo = Date.now() - 7 * DAY_MS;
    const recent7 = entries.filter((e) => e.createdAt >= weekAgo);
    if (recent7.length === 0) return null;
    const counts = new Map<string, number>();
    for (const e of recent7)
      for (const f of e.feelings) counts.set(f.coreId, (counts.get(f.coreId) ?? 0) + 1);
    if (counts.size === 0) return null;
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return getCore(top[0]) ?? null;
  }, [entries]);

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const confirmDelete = (entry: FeelingEntry) => {
    Alert.alert(t('history.deleteTitle'), t('history.deleteMessage'), [
      { text: t('history.cancel'), style: 'cancel' },
      {
        text: t('history.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(entry.id);
          const all = await getAllEntries();
          setEntries(all);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]} edges={['top']}>
      <AmbientGlow />
      <FlatList
        data={recent}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <Animated.View entering={fade()}>
              <View style={styles.heroTopRow}>
                <View style={styles.dateRow}>
                  <View style={styles.dateDot} />
                  <Text style={[styles.dateText, { fontFamily: font(lang, 'semibold') }]}>
                    {new Date().toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </Text>
                </View>
                <Image source={require('../../assets/logo-circle.png')} style={styles.heroLogo} />
              </View>
              <Text style={[styles.greeting, { fontFamily: displayFont(lang) }]}>
                {t(`home.${greetingKey}`)}
              </Text>
              <LinearGradient
                colors={theme.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.greetingAccent}
              />
              <Text style={[styles.prompt, { fontFamily: font(lang, 'regular') }]}>
                {t('home.prompt')}
              </Text>
            </Animated.View>

            {/* CTA */}
            <AnimatedPressable
              style={buttonStyle}
              onPressIn={() => {
                scale.value = withTiming(0.98, { duration: theme.motion.fast });
              }}
              onPressOut={() => {
                scale.value = withTiming(1, { duration: theme.motion.fast });
              }}
              onPress={() => {
                haptics.impact();
                router.push('/log');
              }}
            >
              <LinearGradient
                colors={theme.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logButton}
              >
                <Text style={[styles.logButtonText, { fontFamily: font(lang, 'bold') }]}>
                  {t('home.logFeeling')}
                </Text>
                <Text style={styles.logButtonArrow}>→</Text>
              </LinearGradient>
            </AnimatedPressable>

            {/* Quick log — one tap per core feeling */}
            <Animated.View entering={fade(40)}>
              <Text style={[styles.quickLabel, { fontFamily: font(lang, 'semibold') }]}>
                {t('home.quickLog')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.orbRow}
              >
                {FEELINGS_WHEEL.map((c) => (
                  <Pressable
                    key={c.id}
                    style={({ pressed }) => [styles.orbWrap, pressed && { transform: [{ scale: 0.92 }] }]}
                    onPress={() => {
                      haptics.selection();
                      router.push({ pathname: '/log', params: { coreId: c.id } });
                    }}
                  >
                    <View
                      style={[
                        styles.orb,
                        {
                          backgroundColor: c.tint,
                          borderColor: c.color,
                          shadowColor: c.color,
                        },
                      ]}
                    >
                      <Text style={styles.orbEmoji}>{c.emoji}</Text>
                    </View>
                    <Text
                      style={[styles.orbName, { fontFamily: font(lang, 'semibold'), color: c.colorMid }]}
                      numberOfLines={1}
                    >
                      {lang === 'ar' ? c.ar : c.en}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>

            {/* Explore the wheel */}
            <Animated.View entering={fade(50)}>
              <Pressable
                style={({ pressed }) => [styles.wheelCard, pressed && styles.pressedCard]}
                onPress={() => {
                  haptics.selection();
                  router.push('/wheel');
                }}
              >
                <Image source={require('../../assets/logo-circle.png')} style={styles.wheelCardLogo} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.wheelCardTitle, { fontFamily: font(lang, 'bold') }]}>
                    {t('home.exploreWheel')}
                  </Text>
                  <Text style={[styles.wheelCardSub, { fontFamily: font(lang, 'regular') }]}>
                    {t('home.exploreWheelSub')}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.colors.inkFaint}
                  style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
                />
              </Pressable>
            </Animated.View>

            {/* Daily reflection prompt */}
            <Animated.View entering={fade(160)}>
                <Pressable
                  style={({ pressed }) => [styles.promptCard, pressed && styles.pressedCard]}
                  onPress={() => {
                    haptics.selection();
                    router.push('/log');
                  }}
                >
                  <Text style={styles.memoryIcon}>💭</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memoryLabel, { fontFamily: font(lang, 'semibold') }]}>
                      {t('home.promptTitle')}
                    </Text>
                    <Text style={[styles.promptText, { fontFamily: font(lang, 'bold') }]}>
                      {t(`home.prompt${promptIndex}`)}
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>

            {/* Stat tiles → stats tab */}
            <Animated.View entering={fade(60)} style={styles.statRow}>
              {[
                {
                  label: t('home.statToday'),
                  value: String(todayCount),
                  sub: dominantCore
                    ? `${dominantCore.emoji} ${lang === 'ar' ? dominantCore.ar : dominantCore.en}`
                    : '—',
                  subColor: dominantCore?.colorMid,
                },
                {
                  label: t('home.statStreak'),
                  value: String(streak),
                  sub: nextMilestone(streak) != null
                    ? t('home.nextMilestone', { next: nextMilestone(streak) })
                    : t('home.statStreakUnit'),
                },
                { label: t('home.statTotal'), value: String(entries.length), sub: t('home.statTotalUnit') },
              ].map((tile) => (
                <Pressable
                  key={tile.label}
                  style={({ pressed }) => [styles.statBox, pressed && styles.pressedCard]}
                  onPress={() => {
                    haptics.selection();
                    goToTab('stats');
                  }}
                >
                  <Text style={[styles.statLabel, { fontFamily: font(lang, 'semibold') }]}>
                    {tile.label}
                  </Text>
                  <Text style={[styles.statValue, { fontFamily: font(lang, 'extrabold') }]}>
                    {tile.value}
                  </Text>
                  <Text
                    style={[
                      styles.statSub,
                      { fontFamily: font(lang, 'semibold') },
                      tile.subColor ? { color: tile.subColor } : null,
                    ]}
                    numberOfLines={1}
                  >
                    {tile.sub}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>

            {/* Weekly insight → stats */}
            {weekTopCore ? (
              <Animated.View entering={fade(90)}>
                <Pressable
                  style={({ pressed }) => [
                    styles.insightCard,
                    { borderColor: pressed ? weekTopCore.color : theme.colors.border },
                  ]}
                  onPress={() => {
                    haptics.selection();
                    goToTab('stats');
                  }}
                >
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: weekTopCore.tint, borderRadius: theme.radius.md }]} />
                  <Text style={styles.insightEmoji}>{weekTopCore.emoji}</Text>
                  <View style={styles.insightText}>
                    <Text style={[styles.insightLabel, { fontFamily: font(lang, 'semibold') }]}>
                      {t('home.insightTitle')}
                    </Text>
                    <Text
                      style={[styles.insightFeeling, { fontFamily: font(lang, 'extrabold'), color: weekTopCore.colorMid }]}
                    >
                      {lang === 'ar' ? weekTopCore.ar : weekTopCore.en}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.colors.inkFaint}
                    style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
                  />
                </Pressable>
              </Animated.View>
            ) : null}

            {/* Mood flow strip → stats */}
            <Animated.View entering={fade(120)}>
              <Pressable
                style={({ pressed }) => [styles.activityCard, pressed && styles.pressedCard]}
                onPress={() => {
                  haptics.selection();
                  goToTab('stats');
                }}
              >
                <Text style={[styles.cardLabel, { fontFamily: font(lang, 'semibold') }]}>
                  {t('home.moodFlow')}
                </Text>
                <View style={styles.flowRow}>
                  {moodFlow.map((core, i) => {
                    const isToday = i === moodFlow.length - 1;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.flowCell,
                          core
                            ? { backgroundColor: core.color, opacity: 0.9 }
                            : styles.flowCellEmpty,
                          isToday && styles.flowCellToday,
                        ]}
                      >
                        {core ? <Text style={styles.flowEmoji}>{core.emoji}</Text> : null}
                      </View>
                    );
                  })}
                </View>
                <View style={styles.flowLabels}>
                  <Text style={[styles.flowLabel, { fontFamily: font(lang, 'semibold') }]}>
                    {t('home.flowStart')}
                  </Text>
                  <Text style={[styles.flowLabel, { fontFamily: font(lang, 'semibold') }]}>
                    {t('home.flowToday')}
                  </Text>
                </View>
                <CoreLegend
                  coreIds={[...new Set(moodFlow.filter(Boolean).map((c) => c!.id))]}
                />
              </Pressable>
            </Animated.View>

            {/* One week ago memory */}
            {memory ? (
              <Animated.View entering={fade(140)}>
                <Pressable
                  style={({ pressed }) => [styles.memoryCard, pressed && styles.pressedCard]}
                  onPress={() => {
                    haptics.selection();
                    router.push({ pathname: '/log', params: { editId: String(memory.id) } });
                  }}
                >
                  <Text style={styles.memoryIcon}>🫙</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memoryLabel, { fontFamily: font(lang, 'semibold') }]}>
                      {t('home.memoryTitle')}
                    </Text>
                    <Text style={[styles.memoryText, { fontFamily: font(lang, 'bold') }]} numberOfLines={1}>
                      {memory.feelings
                        .map((f) => {
                          const c = getCore(f.coreId);
                          return c ? `${c.emoji} ${lang === 'ar' ? c.ar : c.en}` : '';
                        })
                        .join(' · ')}
                    </Text>
                    {memory.note ? (
                      <Text style={[styles.memoryNote, { fontFamily: font(lang, 'regular') }]} numberOfLines={1}>
                        “{memory.note}”
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              </Animated.View>
            ) : null}

            {recent.length > 0 ? (
              <View style={styles.sectionRow}>
                <View style={styles.sectionAccent} />
                <Text style={[styles.sectionTitle, { fontFamily: font(lang, 'bold') }]}>
                  {t('home.recent')}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    haptics.selection();
                    goToTab('history');
                  }}
                >
                  <Text style={[styles.viewAll, { fontFamily: font(lang, 'bold') }]}>
                    {t('home.viewAll')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Animated.View entering={fade(150)} style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🪐</Text>
            <Text style={[styles.empty, { fontFamily: font(lang, 'regular') }]}>
              {t('home.empty')}
            </Text>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <EntryCard entry={item} index={index} onLongPress={() => confirmDelete(item)} />
        )}
      />
      {celebration != null ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={styles.celebrationBackdrop}
        >
          <Pressable style={styles.celebrationTouch} onPress={() => setCelebration(null)}>
          <Animated.View
            entering={ZoomIn.delay(120).springify().damping(13).stiffness(160)}
            style={styles.celebrationCard}
          >
            <Animated.Text
              entering={ZoomIn.delay(320).springify().damping(8).stiffness(180)}
              style={styles.celebrationEmoji}
            >
              🎉
            </Animated.Text>
            <Text style={[styles.celebrationTitle, { fontFamily: font(lang, 'extrabold') }]}>
              {t('home.milestoneTitle', { count: celebration })}
            </Text>
            <Text style={[styles.celebrationSub, { fontFamily: font(lang, 'regular') }]}>
              {t('home.milestoneSub')}
            </Text>
            <Animated.Text
              entering={FadeIn.delay(700).duration(300)}
              style={[styles.celebrationDismiss, { fontFamily: font(lang, 'semibold') }]}
            >
              {t('home.milestoneDismiss')}
            </Animated.Text>
          </Animated.View>
          </Pressable>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  celebrationBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  celebrationTouch: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSolid,
    borderWidth: 1,
    borderColor: theme.colors.purple,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: 8,
    ...theme.shadow.glow,
  },
  celebrationEmoji: {
    fontSize: 44,
  },
  celebrationTitle: {
    fontSize: 20,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  celebrationSub: {
    fontSize: 13,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
  celebrationDismiss: {
    marginTop: theme.spacing.sm,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.purpleSoft,
  },
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroLogo: {
    width: 44,
    height: 44,
  },
  dateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.teal,
  },
  dateText: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.inkSoft,
  },
  greeting: {
    fontSize: 38,
    letterSpacing: -1.2,
    lineHeight: 44,
    color: theme.colors.ink,
    marginTop: theme.spacing.sm,
    textAlign: 'left',
  },
  greetingAccent: {
    width: 64,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
  },
  prompt: {
    fontSize: 15,
    color: theme.colors.inkSoft,
    marginTop: 12,
    textAlign: 'left',
  },
  logButton: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.radius.md,
    paddingVertical: 18,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadow.glow,
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
  },
  logButtonArrow: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  orbRow: {
    gap: 14,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  orbWrap: {
    alignItems: 'center',
    gap: 6,
    width: 62,
  },
  orb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    // The colored glow is an iOS-only effect. On Android, `elevation` on a
    // translucent circle renders a boxy/hexagonal neutral shadow, so we skip
    // it — the colored ring + tint fill carry the look there.
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 10,
      },
      default: {},
    }),
  },
  orbEmoji: {
    fontSize: 24,
  },
  orbName: {
    fontSize: 10.5,
  },
  flowRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  flowCell: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowCellEmpty: {
    backgroundColor: theme.o(0.05),
    height: 12,
    borderRadius: 4,
  },
  flowCellToday: {
    borderWidth: 1.5,
    borderColor: theme.o(0.55),
  },
  flowEmoji: {
    fontSize: 12,
  },
  flowLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  flowLabel: {
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.inkFaint,
  },
  memoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.35)',
    backgroundColor: 'rgba(20, 184, 166, 0.07)',
  },
  memoryIcon: {
    fontSize: 24,
  },
  memoryLabel: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.inkFaint,
  },
  memoryText: {
    fontSize: 14,
    color: theme.colors.ink,
    marginTop: 2,
  },
  memoryNote: {
    fontSize: 12,
    color: theme.colors.inkSoft,
    marginTop: 2,
  },
  promptText: {
    fontSize: 14,
    color: theme.colors.tealSoft,
    marginTop: 2,
    lineHeight: 20,
  },
  quickLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.inkFaint,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'left',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  quickEmoji: {
    fontSize: 15,
  },
  quickName: {
    fontSize: 12,
  },
  wheelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.35)',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  wheelCardLogo: {
    width: 38,
    height: 38,
  },
  wheelCardTitle: {
    fontSize: 15,
    color: theme.colors.ink,
    textAlign: 'left',
  },
  wheelCardSub: {
    fontSize: 12,
    color: theme.colors.inkSoft,
    marginTop: 1,
    textAlign: 'left',
  },
  pressedCard: {
    opacity: 0.75,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceSolid,
    overflow: 'hidden',
  },
  insightEmoji: {
    fontSize: 26,
  },
  insightText: {
    flex: 1,
  },
  insightLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.inkSoft,
  },
  insightFeeling: {
    fontSize: 18,
  },
  viewAll: {
    fontSize: 12,
    color: theme.colors.purpleSoft,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: theme.spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.inkFaint,
  },
  statValue: {
    fontSize: 24,
    color: theme.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  statSub: {
    fontSize: 11,
    color: theme.colors.inkSoft,
  },
  activityCard: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  cardLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.inkFaint,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  sectionAccent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: theme.colors.purple,
  },
  sectionTitle: {
    fontSize: 17,
    color: theme.colors.ink,
    textAlign: 'left',
    flex: 1,
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: theme.spacing.sm,
  },
  empty: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.inkFaint,
    textAlign: 'center',
  },
});
