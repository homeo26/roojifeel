/**
 * Monthly Wrapped — a shareable summary card of your month:
 * dominant feelings, check-ins, streaks, intensity, top tag.
 * Rendered as a view, captured with view-shot, shared as an image.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot, { ViewShotRef, captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FeelingEntry, getEntriesBetween } from '../src/db';
import { getCore, getTertiary, label } from '../src/data/feelings';
import { theme, font } from '../src/theme';
import * as haptics from '../src/haptics';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function WrappedScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const shotRef = useRef<ViewShotRef>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [entries, setEntries] = useState<FeelingEntry[]>([]);

  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime() - 1;

  useEffect(() => {
    getEntriesBetween(monthStart, monthEnd).then(setEntries);
  }, [monthStart, monthEnd]);

  const summary = useMemo(() => {
    const feelingCounts = new Map<string, { name: string; color: string; emoji: string; count: number }>();
    const coreCounts = new Map<string, number>();
    const days = new Set<number>();
    const tagCounts = new Map<string, number>();
    let intensitySum = 0;
    let intensityN = 0;

    for (const e of entries) {
      days.add(new Date(e.createdAt).getDate());
      if (e.intensity != null) {
        intensitySum += e.intensity;
        intensityN += 1;
      }
      for (const tag of e.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      for (const f of e.feelings) {
        coreCounts.set(f.coreId, (coreCounts.get(f.coreId) ?? 0) + 1);
        const key = `${f.coreId}/${f.secondaryId}/${f.tertiaryId}`;
        const existing = feelingCounts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          const core = getCore(f.coreId);
          feelingCounts.set(key, {
            name: label(getTertiary(f.coreId, f.secondaryId, f.tertiaryId), lang),
            color: core?.colorMid ?? theme.colors.purpleSoft,
            emoji: core?.emoji ?? '💜',
            count: 1,
          });
        }
      }
    }

    // Longest streak of consecutive days within the month.
    const sortedDays = Array.from(days).sort((a, b) => a - b);
    let longest = 0;
    let run = 0;
    let prev = -2;
    for (const d of sortedDays) {
      run = d === prev + 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = d;
    }

    const topCoreId = Array.from(coreCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topTag = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      total: entries.length,
      daysLogged: days.size,
      longestStreak: longest,
      avgIntensity: intensityN > 0 ? intensitySum / intensityN : null,
      topFeelings: Array.from(feelingCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      topCore: topCoreId ? getCore(topCoreId) : undefined,
      topTag,
    };
  }, [entries, lang]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    lang === 'ar' ? 'ar' : 'en-GB',
    { month: 'long', year: 'numeric' },
  );

  const shiftMonth = (delta: number) => {
    haptics.selection();
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const share = async () => {
    haptics.selection();
    const uri = await captureRef(shotRef, { format: 'png', quality: 1 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Roojifeel Wrapped' });
    }
  };

  const gradient = summary.topCore
    ? ([summary.topCore.color, '#0b0d12'] as const)
    : theme.gradients.primary;

  return (
    <SafeAreaView
      style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={theme.colors.ink} />
        </Pressable>
        <View style={styles.monthNav}>
          <Pressable hitSlop={8} onPress={() => shiftMonth(-1)}>
            <Ionicons name="chevron-back" size={18} color={theme.colors.inkSoft} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
          </Pressable>
          <Text style={[styles.monthLabel, { fontFamily: font(lang, 'bold') }]}>{monthLabel}</Text>
          <Pressable
            hitSlop={8}
            onPress={() => shiftMonth(1)}
            disabled={year === now.getFullYear() && month === now.getMonth()}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={
                year === now.getFullYear() && month === now.getMonth()
                  ? theme.colors.border
                  : theme.colors.inkSoft
              }
              style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
            />
          </Pressable>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* The shareable card */}
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.card}
          >
            <Text style={[styles.cardEyebrow, { fontFamily: font(lang, 'semibold') }]}>
              {t('wrapped.eyebrow')}
            </Text>
            <Text style={[styles.cardMonth, { fontFamily: font(lang, 'extrabold') }]}>
              {monthLabel}
            </Text>

            {summary.total === 0 ? (
              <Text style={[styles.cardEmpty, { fontFamily: font(lang, 'regular') }]}>
                {t('wrapped.empty')}
              </Text>
            ) : (
              <>
                {summary.topCore ? (
                  <View style={styles.heroFeeling}>
                    <Text style={styles.heroEmoji}>{summary.topCore.emoji}</Text>
                    <View>
                      <Text style={[styles.heroLabel, { fontFamily: font(lang, 'semibold') }]}>
                        {t('wrapped.dominant')}
                      </Text>
                      <Text style={[styles.heroName, { fontFamily: font(lang, 'extrabold') }]}>
                        {lang === 'ar' ? summary.topCore.ar : summary.topCore.en}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Top feelings */}
                {summary.topFeelings.map((f, i) => (
                  <View key={f.name} style={styles.topRow}>
                    <Text style={[styles.topRank, { fontFamily: font(lang, 'extrabold') }]}>
                      {i + 1}
                    </Text>
                    <Text style={[styles.topName, { fontFamily: font(lang, 'bold') }]}>
                      {f.emoji} {f.name}
                    </Text>
                    <Text style={[styles.topCount, { fontFamily: font(lang, 'semibold') }]}>
                      ×{f.count}
                    </Text>
                  </View>
                ))}

                {/* Stats grid */}
                <View style={styles.grid}>
                  <View style={styles.gridItem}>
                    <Text style={[styles.gridValue, { fontFamily: font(lang, 'extrabold') }]}>
                      {summary.total}
                    </Text>
                    <Text style={[styles.gridLabel, { fontFamily: font(lang, 'semibold') }]}>
                      {t('wrapped.checkins')}
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={[styles.gridValue, { fontFamily: font(lang, 'extrabold') }]}>
                      {summary.daysLogged}
                    </Text>
                    <Text style={[styles.gridLabel, { fontFamily: font(lang, 'semibold') }]}>
                      {t('wrapped.daysLogged')}
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={[styles.gridValue, { fontFamily: font(lang, 'extrabold') }]}>
                      {summary.longestStreak}
                    </Text>
                    <Text style={[styles.gridLabel, { fontFamily: font(lang, 'semibold') }]}>
                      {t('wrapped.longestStreak')}
                    </Text>
                  </View>
                  {summary.avgIntensity != null ? (
                    <View style={styles.gridItem}>
                      <Text style={[styles.gridValue, { fontFamily: font(lang, 'extrabold') }]}>
                        {summary.avgIntensity.toFixed(1)}
                      </Text>
                      <Text style={[styles.gridLabel, { fontFamily: font(lang, 'semibold') }]}>
                        {t('wrapped.avgIntensity')}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {summary.topTag ? (
                  <Text style={[styles.topTag, { fontFamily: font(lang, 'semibold') }]}>
                    {t('wrapped.topTag')} #{summary.topTag}
                  </Text>
                ) : null}
              </>
            )}

            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={[styles.brand, { fontFamily: font(lang, 'bold') }]}>Roojifeel</Text>
            </View>
          </LinearGradient>
        </ViewShot>

        {summary.total > 0 ? (
          <Pressable onPress={share}>
            {({ pressed }) => (
              <LinearGradient
                colors={theme.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.shareBtn, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                <Text style={[styles.shareText, { fontFamily: font(lang, 'bold') }]}>
                  {t('wrapped.share')}
                </Text>
              </LinearGradient>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthLabel: {
    fontSize: 14,
    color: theme.colors.ink,
    minWidth: 120,
    textAlign: 'center',
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    overflow: 'hidden',
  },
  cardEyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  cardMonth: {
    fontSize: 30,
    letterSpacing: -0.6,
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  cardEmpty: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  heroFeeling: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  heroEmoji: {
    fontSize: 34,
  },
  heroLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  heroName: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  topRank: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    width: 18,
    fontVariant: ['tabular-nums'],
  },
  topName: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  topCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontVariant: ['tabular-nums'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: theme.spacing.md,
  },
  gridItem: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  gridValue: {
    fontSize: 22,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  gridLabel: {
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  topTag: {
    marginTop: theme.spacing.md,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.lg,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.tealSoft,
  },
  brand: {
    fontSize: 12,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.85)',
  },
  shareBtn: {
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.md,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...theme.shadow.glow,
  },
  shareText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
});
