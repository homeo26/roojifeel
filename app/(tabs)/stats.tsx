/**
 * Stats — Kibana-style dashboard over a configurable time range (default 14 days).
 * Donut of core distribution, gauges for check-in consistency and positivity,
 * daily activity bars, expandable branch-level breakdowns, top feelings.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { FeelingEntry, getEntriesBetween } from '../../src/db';
import {
  CoreFeeling,
  FEELINGS_WHEEL,
  getCore,
  getSecondary,
  getTertiary,
  label,
} from '../../src/data/feelings';
import { ActivityBars, Donut, Gauge } from '../../src/components/Charts';
import { theme, font } from '../../src/theme';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = [7, 14, 30, 90] as const;
const DEFAULT_RANGE = 14;
const fade = (delay = 0) => FadeIn.duration(theme.motion.base).delay(delay);
const layoutT = () => LinearTransition.duration(theme.motion.fast);

interface CoreStat {
  core: CoreFeeling;
  count: number;
  percent: number;
  secondaries: Array<{
    id: string;
    name: string;
    count: number;
    tertiaries: Array<{ id: string; name: string; count: number }>;
  }>;
}

export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [rangeDays, setRangeDays] = useState<number>(DEFAULT_RANGE);
  const [entries, setEntries] = useState<FeelingEntry[]>([]);
  const [expandedCore, setExpandedCore] = useState<string | null>(null);

  const reload = useCallback(() => {
    const to = Date.now();
    const from = to - rangeDays * DAY_MS;
    getEntriesBetween(from, to).then(setEntries);
  }, [rangeDays]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const total = entries.length;

  const coreStats: CoreStat[] = useMemo(() => {
    const stats: CoreStat[] = [];
    for (const core of FEELINGS_WHEEL) {
      const coreEntries = entries.filter((e) => e.coreId === core.id);
      if (coreEntries.length === 0) continue;

      const secondaryMap = new Map<string, Map<string, number>>();
      for (const e of coreEntries) {
        let terts = secondaryMap.get(e.secondaryId);
        if (!terts) {
          terts = new Map();
          secondaryMap.set(e.secondaryId, terts);
        }
        terts.set(e.tertiaryId, (terts.get(e.tertiaryId) ?? 0) + 1);
      }

      const secondaries = Array.from(secondaryMap.entries())
        .map(([secId, terts]) => {
          const secNode = getSecondary(core.id, secId);
          const tertiaries = Array.from(terts.entries())
            .map(([tertId, count]) => ({
              id: tertId,
              name: label(getTertiary(core.id, secId, tertId), lang),
              count,
            }))
            .sort((a, b) => b.count - a.count);
          return {
            id: secId,
            name: label(secNode, lang),
            count: tertiaries.reduce((sum, x) => sum + x.count, 0),
            tertiaries,
          };
        })
        .sort((a, b) => b.count - a.count);

      stats.push({
        core,
        count: coreEntries.length,
        percent: total > 0 ? Math.round((coreEntries.length / total) * 100) : 0,
        secondaries,
      });
    }
    return stats.sort((a, b) => b.count - a.count);
  }, [entries, total, lang]);

  const daysWithCheckin = useMemo(() => {
    const days = new Set<string>();
    for (const e of entries) {
      const d = new Date(e.createdAt);
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return days.size;
  }, [entries]);

  // Positivity: share of Happy + Surprised check-ins.
  const positivity = useMemo(() => {
    if (total === 0) return 0;
    const positive = entries.filter((e) => e.coreId === 'happy' || e.coreId === 'surprised').length;
    return positive / total;
  }, [entries, total]);

  // Daily activity, oldest first.
  const activity = useMemo(() => {
    const buckets = new Array(Math.min(rangeDays, 30)).fill(0) as number[];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    for (const e of entries) {
      const diffDays = Math.floor((startOfToday + DAY_MS - e.createdAt) / DAY_MS);
      if (diffDays >= 0 && diffDays < buckets.length) buckets[buckets.length - 1 - diffDays] += 1;
    }
    return buckets;
  }, [entries, rangeDays]);

  const topFeelings = useMemo(() => {
    const counts = new Map<string, { name: string; color: string; count: number }>();
    for (const e of entries) {
      const key = `${e.coreId}/${e.secondaryId}/${e.tertiaryId}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        const core = getCore(e.coreId);
        counts.set(key, {
          name: label(getTertiary(e.coreId, e.secondaryId, e.tertiaryId), lang),
          color: core?.color ?? theme.colors.purple,
          count: 1,
        });
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [entries, lang]);

  const maxCount = coreStats[0]?.count ?? 1;

  return (
    <SafeAreaView style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { fontFamily: font(lang, 'extrabold') }]}>
          {t('stats.title')}
        </Text>

        {/* Range selector */}
        <View style={styles.rangeRow}>
          {RANGES.map((days) => {
            const active = rangeDays === days;
            return (
              <Pressable
                key={days}
                style={[styles.rangeChip, active && styles.rangeChipActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setRangeDays(days);
                  setExpandedCore(null);
                }}
              >
                <Text
                  style={[
                    styles.rangeChipText,
                    { fontFamily: font(lang, 'semibold') },
                    active && styles.rangeChipTextActive,
                  ]}
                >
                  {t('stats.days', { count: days })}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {total === 0 ? (
          <Animated.View entering={fade()} style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={[styles.empty, { fontFamily: font(lang, 'regular') }]}>
              {t('stats.empty')}
            </Text>
          </Animated.View>
        ) : (
          <>
            {/* Donut + legend */}
            <Animated.View entering={fade()} style={styles.panel}>
              <Text style={[styles.panelLabel, { fontFamily: font(lang, 'semibold') }]}>
                {t('stats.coreBreakdown')}
              </Text>
              <View style={styles.donutRow}>
                <Donut
                  slices={coreStats.map((s) => ({ value: s.count, color: s.core.color }))}
                  label={String(total)}
                  caption={t('stats.checkinsCaption')}
                  labelFont={font(lang, 'extrabold')}
                  captionFont={font(lang, 'semibold')}
                />
                <View style={styles.legend}>
                  {coreStats.map((s) => (
                    <View key={s.core.id} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: s.core.color }]} />
                      <Text
                        style={[styles.legendName, { fontFamily: font(lang, 'semibold') }]}
                        numberOfLines={1}
                      >
                        {label(s.core, lang)}
                      </Text>
                      <Text style={[styles.legendPct, { fontFamily: font(lang, 'bold'), color: s.core.colorMid }]}>
                        {s.percent}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>

            {/* Gauges */}
            <Animated.View entering={fade(50)} style={styles.gaugeRow}>
              <View style={[styles.panel, styles.gaugePanel]}>
                <Text style={[styles.panelLabel, { fontFamily: font(lang, 'semibold') }]}>
                  {t('stats.gaugeConsistency')}
                </Text>
                <Gauge
                  value={daysWithCheckin / rangeDays}
                  color={theme.colors.teal}
                  label={`${daysWithCheckin}/${rangeDays}`}
                  caption={t('stats.gaugeDays')}
                  labelFont={font(lang, 'extrabold')}
                  captionFont={font(lang, 'semibold')}
                  size={132}
                />
              </View>
              <View style={[styles.panel, styles.gaugePanel]}>
                <Text style={[styles.panelLabel, { fontFamily: font(lang, 'semibold') }]}>
                  {t('stats.gaugePositivity')}
                </Text>
                <Gauge
                  value={positivity}
                  color={theme.colors.pink}
                  label={`${Math.round(positivity * 100)}%`}
                  caption={t('stats.gaugePositive')}
                  labelFont={font(lang, 'extrabold')}
                  captionFont={font(lang, 'semibold')}
                  size={132}
                />
              </View>
            </Animated.View>

            {/* Daily activity */}
            <Animated.View entering={fade(100)} style={styles.panel}>
              <Text style={[styles.panelLabel, { fontFamily: font(lang, 'semibold') }]}>
                {t('stats.activityLabel', { count: activity.length })}
              </Text>
              <ActivityBars values={activity} color={theme.colors.purple} height={64} />
            </Animated.View>

            {/* Core breakdown */}
            <View style={styles.sectionRow}>
              <View style={styles.sectionAccent} />
              <Text style={[styles.sectionTitle, { fontFamily: font(lang, 'bold') }]}>
                {t('stats.coreBreakdown')}
              </Text>
            </View>
            <Text style={[styles.hint, { fontFamily: font(lang, 'regular') }]}>
              {t('stats.branchDetail')}
            </Text>

            {coreStats.map((stat) => {
              const expanded = expandedCore === stat.core.id;
              return (
                <Animated.View
                  key={stat.core.id}
                  entering={fade()}
                  layout={layoutT()}
                  style={[styles.coreCard, expanded && { borderColor: stat.core.color }]}
                >
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setExpandedCore(expanded ? null : stat.core.id);
                    }}
                  >
                    <View style={styles.coreHeader}>
                      <Text style={styles.coreEmoji}>{stat.core.emoji}</Text>
                      <Text
                        style={[
                          styles.coreName,
                          { fontFamily: font(lang, 'bold'), color: stat.core.colorMid },
                        ]}
                      >
                        {label(stat.core, lang)}
                      </Text>
                      <Text style={[styles.coreCount, { fontFamily: font(lang, 'semibold') }]}>
                        {t('stats.timesFelt', { count: stat.count })}
                      </Text>
                      <Text
                        style={[
                          styles.corePercent,
                          { fontFamily: font(lang, 'extrabold'), color: stat.core.colorMid },
                        ]}
                      >
                        {stat.percent}%
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            backgroundColor: stat.core.color,
                            width: `${Math.max(4, (stat.count / maxCount) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>

                  {expanded
                    ? stat.secondaries.map((sec) => (
                        <Animated.View key={sec.id} entering={FadeIn.duration(theme.motion.fast)} style={styles.branch}>
                          <View style={styles.branchRow}>
                            <Text
                              style={[
                                styles.branchName,
                                { fontFamily: font(lang, 'bold'), color: stat.core.colorMid },
                              ]}
                            >
                              {sec.name}
                            </Text>
                            <Text style={[styles.branchCount, { fontFamily: font(lang, 'semibold') }]}>
                              {t('stats.timesFelt', { count: sec.count })}
                            </Text>
                          </View>
                          {sec.tertiaries.map((tert) => (
                            <View key={tert.id} style={[styles.branchRow, styles.leafRow]}>
                              <Text style={[styles.leafName, { fontFamily: font(lang, 'regular') }]}>
                                {tert.name}
                              </Text>
                              <Text style={[styles.leafCount, { fontFamily: font(lang, 'semibold') }]}>
                                {t('stats.timesFelt', { count: tert.count })}
                              </Text>
                            </View>
                          ))}
                        </Animated.View>
                      ))
                    : null}
                </Animated.View>
              );
            })}

            {/* Top tertiary feelings */}
            <View style={styles.sectionRow}>
              <View style={styles.sectionAccent} />
              <Text style={[styles.sectionTitle, { fontFamily: font(lang, 'bold') }]}>
                {t('stats.topFeelings')}
              </Text>
            </View>
            {topFeelings.map((f, i) => (
              <Animated.View key={`${f.name}-${i}`} entering={fade()} style={styles.topRow}>
                <Text style={[styles.topRank, { fontFamily: font(lang, 'extrabold'), color: f.color }]}>
                  {i + 1}
                </Text>
                <Text style={[styles.topName, { fontFamily: font(lang, 'semibold') }]}>
                  {f.name}
                </Text>
                <Text style={[styles.topCount, { fontFamily: font(lang, 'bold'), color: f.color }]}>
                  {t('stats.timesFelt', { count: f.count })}
                </Text>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
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
    paddingBottom: theme.spacing.xl * 2,
  },
  title: {
    fontSize: 28,
    letterSpacing: -0.6,
    color: theme.colors.ink,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    textAlign: 'left',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: theme.spacing.md,
  },
  rangeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rangeChipActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    borderColor: theme.colors.purple,
  },
  rangeChipText: {
    fontSize: 13,
    color: theme.colors.inkSoft,
  },
  rangeChipTextActive: {
    color: theme.colors.purpleSoft,
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm + 4,
  },
  panelLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.inkFaint,
    marginBottom: theme.spacing.sm + 4,
    textAlign: 'left',
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  legend: {
    flex: 1,
    gap: 7,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  legendName: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.inkSoft,
    textAlign: 'left',
  },
  legendPct: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  gaugeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gaugePanel: {
    flex: 1,
    alignItems: 'center',
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.lg,
    marginBottom: 4,
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
  hint: {
    fontSize: 12,
    color: theme.colors.inkFaint,
    marginBottom: theme.spacing.md,
    textAlign: 'left',
  },
  coreCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: 8,
  },
  coreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coreEmoji: {
    fontSize: 18,
  },
  coreName: {
    fontSize: 15,
    flex: 1,
    textAlign: 'left',
  },
  coreCount: {
    fontSize: 11,
    color: theme.colors.inkFaint,
    fontVariant: ['tabular-nums'],
  },
  corePercent: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    minWidth: 44,
    textAlign: 'right',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  branch: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  leafRow: {
    paddingStart: theme.spacing.md,
  },
  branchName: {
    fontSize: 14,
    textAlign: 'left',
  },
  branchCount: {
    fontSize: 11,
    color: theme.colors.inkSoft,
  },
  leafName: {
    fontSize: 13,
    color: theme.colors.inkSoft,
    textAlign: 'left',
  },
  leafCount: {
    fontSize: 11,
    color: theme.colors.inkFaint,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    marginTop: 8,
  },
  topRank: {
    fontSize: 16,
    width: 20,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  topName: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.ink,
    textAlign: 'left',
  },
  topCount: {
    fontSize: 12,
  },
});
