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
import { getCore } from '../../src/data/feelings';
import { EntryCard } from '../../src/components/EntryCard';
import { ActivityBars } from '../../src/components/Charts';
import { theme, font } from '../../src/theme';
import { isSameDay } from '../../src/timeFormat';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DAY_MS = 24 * 60 * 60 * 1000;
const fade = (delay = 0) => FadeIn.duration(theme.motion.base).delay(delay);

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const [entries, setEntries] = useState<FeelingEntry[]>([]);
  const scale = useSharedValue(1);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAllEntries().then((all) => {
        if (active) setEntries(all);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const today = new Date();
  const todayCount = entries.filter((e) => isSameDay(new Date(e.createdAt), today)).length;
  const recent = entries.slice(0, 4);

  // Streak: consecutive days (ending today or yesterday) with >= 1 check-in.
  const streak = useMemo(() => {
    const days = new Set(
      entries.map((e) => {
        const d = new Date(e.createdAt);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      }),
    );
    let count = 0;
    let cursor = new Date();
    const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!days.has(key(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
    while (days.has(key(cursor))) {
      count += 1;
      cursor = new Date(cursor.getTime() - DAY_MS);
    }
    return count;
  }, [entries]);

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
    for (const e of todays) counts.set(e.coreId, (counts.get(e.coreId) ?? 0) + 1);
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return getCore(top[0]) ?? null;
  }, [entries, today]);

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
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowDot} />
                <Text style={[styles.eyebrow, { fontFamily: font(lang, 'semibold') }]}>
                  {t('appName')}
                </Text>
              </View>
              <Text style={[styles.greeting, { fontFamily: font(lang, 'extrabold') }]}>
                {t('home.greeting')}
              </Text>
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

            {/* Stat tiles */}
            <Animated.View entering={fade(60)} style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { fontFamily: font(lang, 'semibold') }]}>
                  {t('home.statToday')}
                </Text>
                <Text style={[styles.statValue, { fontFamily: font(lang, 'extrabold') }]}>
                  {todayCount}
                </Text>
                {dominantCore ? (
                  <Text style={[styles.statSub, { color: dominantCore.colorMid, fontFamily: font(lang, 'semibold') }]}>
                    {dominantCore.emoji} {lang === 'ar' ? dominantCore.ar : dominantCore.en}
                  </Text>
                ) : (
                  <Text style={[styles.statSub, { fontFamily: font(lang, 'regular') }]}>—</Text>
                )}
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { fontFamily: font(lang, 'semibold') }]}>
                  {t('home.statStreak')}
                </Text>
                <Text style={[styles.statValue, { fontFamily: font(lang, 'extrabold') }]}>
                  {streak}
                </Text>
                <Text style={[styles.statSub, { fontFamily: font(lang, 'regular') }]}>
                  {t('home.statStreakUnit')}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { fontFamily: font(lang, 'semibold') }]}>
                  {t('home.statTotal')}
                </Text>
                <Text style={[styles.statValue, { fontFamily: font(lang, 'extrabold') }]}>
                  {entries.length}
                </Text>
                <Text style={[styles.statSub, { fontFamily: font(lang, 'regular') }]}>
                  {t('home.statTotalUnit')}
                </Text>
              </View>
            </Animated.View>

            {/* 14-day activity */}
            <Animated.View entering={fade(120)} style={styles.activityCard}>
              <Text style={[styles.cardLabel, { fontFamily: font(lang, 'semibold') }]}>
                {t('home.activity')}
              </Text>
              <ActivityBars values={activity} color={theme.colors.teal} />
            </Animated.View>

            {recent.length > 0 ? (
              <View style={styles.sectionRow}>
                <View style={styles.sectionAccent} />
                <Text style={[styles.sectionTitle, { fontFamily: font(lang, 'bold') }]}>
                  {t('home.recent')}
                </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.sm,
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.teal,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.inkSoft,
  },
  greeting: {
    fontSize: 32,
    letterSpacing: -0.8,
    color: theme.colors.ink,
    marginTop: theme.spacing.md,
    textAlign: 'left',
  },
  prompt: {
    fontSize: 15,
    color: theme.colors.inkSoft,
    marginTop: 4,
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
