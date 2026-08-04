import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as haptics from '../../src/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { FeelingEntry, deleteEntry, getAllEntries } from '../../src/db';
import { FEELINGS_WHEEL, getCore } from '../../src/data/feelings';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EntryCard } from '../../src/components/EntryCard';
import { ActivityBars } from '../../src/components/Charts';
import { theme, font, displayFont } from '../../src/theme';
import { isSameDay } from '../../src/timeFormat';
import { claimMilestone, computeStreak, nextMilestone } from '../../src/streaks';
import { refreshWidget } from '../../src/widget/RoojifeelWidget';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DAY_MS = 24 * 60 * 60 * 1000;
const fade = (delay = 0) => FadeIn.duration(theme.motion.base).delay(delay);

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const [entries, setEntries] = useState<FeelingEntry[]>([]);
  const [celebration, setCelebration] = useState<number | null>(null);
  const scale = useSharedValue(1);

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

  // Last 14 days of activity, oldest first.
  const activity = useMemo(() => {
    const buckets = new Array(14).fill(0) as number[];
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    for (const e of entries) {
      const diffDays = Math.floor((startOfToday + DAY_MS - e.createdAt) / DAY_MS);
      if (diffDays >= 0 && diffDays < 14) buckets[13 - diffDays] += 1;
    }
    return buckets;
  }, [entries, today]);

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
      <FlatList
        data={recent}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <Animated.View entering={fade()}>
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
              <View style={styles.quickRow}>
                {FEELINGS_WHEEL.map((c) => (
                  <Pressable
                    key={c.id}
                    style={({ pressed }) => [
                      styles.quickChip,
                      { backgroundColor: c.tint, borderColor: pressed ? c.color : theme.colors.border },
                    ]}
                    onPress={() => {
                      haptics.selection();
                      router.push({ pathname: '/log', params: { coreId: c.id } });
                    }}
                  >
                    <Text style={styles.quickEmoji}>{c.emoji}</Text>
                    <Text
                      style={[styles.quickName, { fontFamily: font(lang, 'semibold'), color: c.colorMid }]}
                      numberOfLines={1}
                    >
                      {lang === 'ar' ? c.ar : c.en}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
                    router.push('/stats');
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
                    router.push('/stats');
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

            {/* 14-day activity → stats */}
            <Animated.View entering={fade(120)}>
              <Pressable
                style={({ pressed }) => [styles.activityCard, pressed && styles.pressedCard]}
                onPress={() => {
                  haptics.selection();
                  router.push('/stats');
                }}
              >
                <Text style={[styles.cardLabel, { fontFamily: font(lang, 'semibold') }]}>
                  {t('home.activity')}
                </Text>
                <ActivityBars values={activity} color={theme.colors.teal} />
              </Pressable>
            </Animated.View>

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
                    router.push('/history');
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
        <Pressable style={styles.celebrationBackdrop} onPress={() => setCelebration(null)}>
          <Animated.View entering={FadeIn.duration(250)} style={styles.celebrationCard}>
            <Text style={styles.celebrationEmoji}>🎉</Text>
            <Text style={[styles.celebrationTitle, { fontFamily: font(lang, 'extrabold') }]}>
              {t('home.milestoneTitle', { count: celebration })}
            </Text>
            <Text style={[styles.celebrationSub, { fontFamily: font(lang, 'regular') }]}>
              {t('home.milestoneSub')}
            </Text>
            <Text style={[styles.celebrationDismiss, { fontFamily: font(lang, 'semibold') }]}>
              {t('home.milestoneDismiss')}
            </Text>
          </Animated.View>
        </Pressable>
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
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
