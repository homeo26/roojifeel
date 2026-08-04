/**
 * Stats — Kibana-style dashboard over a flexible time range.
 * Range: quick presets or absolute from/to dates (TimeRangePicker).
 * Panels: summary tiles, core distribution donut, consistency & positivity
 * gauges, daily activity, time-of-day and weekday breakdowns, per-core
 * branch drill-down, top feelings.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as haptics from '../../src/haptics';
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
import {
  DEFAULT_RANGE,
  TimeRange,
  TimeRangePicker,
  rangeDayCount,
  resolveRange,
} from '../../src/components/TimeRangePicker';
import { theme, font } from '../../src/theme';

const DAY_MS = 24 * 60 * 60 * 1000;
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

/** Simple labeled horizontal bar row. */
function HBar({
  name,
  count,
  max,
  color,
  fontFamily,
}: {
  name: string;
  count: number;
  max: number;
  color: string;
  fontFamily: string;
}) {
  return (
    <View style={styles.hbarRow}>
      <Text style={[styles.hbarName, { fontFamily }]} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.hbarTrack}>
        <View
          style={[
            styles.hbarFill,
            { backgroundColor: color, width: `${max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0}%` },
          ]}
        />
      </View>
      <Text style={[styles.hbarCount, { fontFamily }]}>{count}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [range, setRange] = useState<TimeRange>(DEFAULT_RANGE);
  const [entries, setEntries] = useState<FeelingEntry[]>([]);
  const [expandedCore, setExpandedCore] = useState<string | null>(null);

  const reload = useCallback(() => {
    const { from, to } = resolveRange(range);
    getEntriesBetween(from, to).then(setEntries);
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const total = entries.length;

  // Effective day count: for "all time", measure from the first entry.
  const effectiveDays = useMemo(() => {
    if (range.kind === 'all') {
      if (entries.length === 0) return 1;
      const first = Math.min(...entries.map((e) => e.createdAt));
      return Math.max(1, Math.ceil((Date.now() - first) / DAY_MS));
    }
    return rangeDayCount(range);
  }, [range, entries]);

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

  const positivity = useMemo(() => {
    if (total === 0) return 0;
    const positive = entries.filter((e) => e.coreId === 'happy' || e.coreId === 'surprised').length;
    return positive / total;
  }, [entries, total]);

  const withNotesPct = useMemo(() => {
    if (total === 0) return 0;
    return Math.round((entries.filter((e) => e.note != null).length / total) * 100);
  }, [entries, total]);

  const avgPerDay = useMemo(() => {
    if (daysWithCheckin === 0) return '0';
    return (total / effectiveDays).toFixed(1);
  }, [total, effectiveDays, daysWithCheckin]);

  // Daily activity, oldest first (capped at 30 bars).
  const activity = useMemo(() => {
    const buckets = new Array(Math.min(effectiveDays, 30)).fill(0) as number[];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    for (const e of entries) {
      const diffDays = Math.floor((startOfToday + DAY_MS - e.createdAt) / DAY_MS);
      if (diffDays >= 0 && diffDays < buckets.length) buckets[buckets.length - 1 - diffDays] += 1;
    }
    return buckets;
  }, [entries, effectiveDays]);

  // Time-of-day buckets.
  const timeOfDay = useMemo(() => {
    const buckets = [0, 0, 0, 0]; // morning, afternoon, evening, night
    for (const e of entries) {
      const h = new Date(e.createdAt).getHours();
      if (h >= 6 && h < 12) buckets[0] += 1;
      else if (h >= 12 && h < 17) buckets[1] += 1;
      else if (h >= 17 && h < 22) buckets[2] += 1;
      else buckets[3] += 1;
    }
    return buckets;
  }, [entries]);

  // Weekday breakdown, Monday-first.
  const weekdays = useMemo(() => {
    const buckets = new Array(7).fill(0) as number[];
    for (const e of entries) {
      const jsDay = new Date(e.createdAt).getDay(); // 0=Sun
      buckets[(jsDay + 6) % 7] += 1;
    }
    return buckets;
  }, [entries]);

  const weekdayNames = useMemo(() => {
    // Monday-first localized short names (Mon 2024-01-01).
    const base = new Date(2024, 0, 1);
    return new Array(7).fill(0).map((_, i) => {
      const d = new Date(base.getTime() + i * DAY_MS);
      return d.toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { weekday: 'short' });
    });
  }, [lang]);

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
  const todNames = [t('stats.morning'), t('stats.afternoon'), t('stats.evening'), t('stats.night')];
  const todColors = [theme.colors.warning, theme.colors.teal, theme.colors.purple, theme.colors.blue];
  const maxTod = Math.max(...timeOfDay, 1);
  const maxWd = Math.max(...weekdays, 1);

  return (
    <SafeAreaView style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { fontFamily: font(lang, 'extrabold') }]}>
          {t('stats.title')}
        </Text>

        <TimeRangePicker value={range} onChange={setRange} />

        {total === 0 ? (
          <Animated.View entering={fade()} style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={[styles.empty, { fontFamily: font(lang, 'regular') }]}>
              {t('stats.empty')}
            </Text>
          </Animated.View>
        ) : (
          <>
            {/* Summary tiles */}
            <Animated.View entering={fade()} style={styles.tileRow}>
              {[
                { label: t('stats.tileTotal'), value: String(total) },
                { label: t('stats.tileDaysLogged'), value: `${daysWithCheckin}/${effectiveDays}` },
                { label: t('stats.tileAvgPerDay'), value: avgPerDay },
                { label: t('stats.tileWithNotes'), value: `${withNotesPct}%` },
              ].map((tile) => (
                <View key={tile.label} style={styles.tile}>
                  <Text style={[styles.tileValue, { fontFamily: font(lang, 'extrabold') }]}>
                    {tile.value}
                  </Text>
                  <Text style={[styles.tileLabel, { fontFamily: font(lang, 'semibold') }]}>
                    {tile.label}
                  </Text>
                </View>
              ))}
            </Animated.View>

            {/* Donut + legend */}
            <Animated.View entering={fade(40)} style={styles.panel}>
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
            <Animated.View entering={fade(80)} style={styles.gaugeRow}>
              <View style={[styles.panel, styles.gaugePanel]}>
                <Text style={[styles.panelLabel, { fontFamily: font(lang, 'semibold') }]}>
                  {t('stats.gaugeConsistency')}
                </Text>
                <Gauge
                  value={daysWithCheckin / effectiveDays}
                  color={theme.colors.teal}
                  label={`${daysWithCheckin}/${effectiveDays}`}
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
            <Animated.View entering={fade(120)} style={styles.panel}>
              <Text style={[styles.panelLabel, { fontFamily: font(lang, 'semibold') }]}>
                {t('stats.activityLabel', { count: activity.length })}
              </Text>
              <ActivityBars values={activity} color={theme.colors.purple} height={64} />
            </Animated.View>

            {/* Time of day */}
            <Animated.View entering={fade(160)} style={styles.panel}>
              <Text style={[styles.panelLabel, { fontFamily: font(lang, 'semibold') }]}>
                {t('stats.byTimeOfDay')}
              </Text>
              {todNames.map((name, i) => (
                <HBar
                  key={name}
                  name={name}
                  count={timeOfDay[i]}
                  max={maxTod}
                  color={todColors[i]}
                  fontFamily={font(lang, 'semibold')}
                />
              ))}
            </Animated.View>

            {/* Weekdays */}
            <Animated.View entering={fade(200)} style={styles.panel}>
              <Text style={[styles.panelLabel, { fontFamily: font(lang, 'semibold') }]}>
                {t('stats.byWeekday')}
              </Text>
              {weekdayNames.map((name, i) => (
                <HBar
                  key={name}
                  name={name}
                  count={weekdays[i]}
                  max={maxWd}
                  color={theme.colors.tealSoft}
                  fontFamily={font(lang, 'semibold')}
                />
              ))}
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
                      haptics.selection();
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
                        <Animated.View
                          key={sec.id}
                          entering={FadeIn.duration(theme.motion.fast)}
                          style={styles.branch}
                        >
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
  tileRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.md,
  },
  tile: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  tileValue: {
    fontSize: 17,
    color: theme.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: {
    fontSize: 8.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.inkFaint,
    textAlign: 'center',
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm + 4,
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
    marginTop: theme.spacing.sm + 4,
  },
  gaugePanel: {
    flex: 1,
    alignItems: 'center',
    marginTop: 0,
  },
  hbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  hbarName: {
    width: 76,
    fontSize: 12,
    color: theme.colors.inkSoft,
    textAlign: 'left',
  },
  hbarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  hbarFill: {
    height: '100%',
    borderRadius: 4,
  },
  hbarCount: {
    minWidth: 26,
    fontSize: 12,
    color: theme.colors.ink,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
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
