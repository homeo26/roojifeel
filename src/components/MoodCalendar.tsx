/**
 * MoodCalendar — a month grid where each day is tinted by the dominant
 * core feeling logged that day. Swipe months with the chevrons.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FeelingEntry, getEntriesBetween } from '../db';
import { getCore, label as feelingLabel } from '../data/feelings';
import { CoreLegend } from './CoreLegend';
import { WeekStart, getWeekStart } from '../prefs';
import { theme, font } from '../theme';
import * as haptics from '../haptics';
import { Pressy } from './Pressy';

const DAY_MS = 24 * 60 * 60 * 1000;

export function MoodCalendar() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [entries, setEntries] = useState<FeelingEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [weekStart, setWeekStartState] = useState<WeekStart>('mon');

  useEffect(() => {
    getWeekStart().then(setWeekStartState);
  }, []);

  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime() - 1;

  useEffect(() => {
    setSelectedDay(null);
    getEntriesBetween(monthStart, monthEnd).then(setEntries);
  }, [monthStart, monthEnd]);

  /** Dominant core color per day-of-month. */
  const dayColors = useMemo(() => {
    const byDay = new Map<number, Map<string, number>>();
    for (const e of entries) {
      const day = new Date(e.createdAt).getDate();
      let counts = byDay.get(day);
      if (!counts) {
        counts = new Map();
        byDay.set(day, counts);
      }
      for (const f of e.feelings) counts.set(f.coreId, (counts.get(f.coreId) ?? 0) + 1);
    }
    const result = new Map<
      number,
      { color: string; tint: string; emoji: string; coreId: string; total: number }
    >();
    for (const [day, counts] of byDay) {
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      const core = getCore(top[0]);
      const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
      if (core)
        result.set(day, {
          color: core.color,
          tint: core.tint,
          emoji: core.emoji,
          coreId: core.id,
          total,
        });
    }
    return result;
  }, [entries]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Offset of the 1st, respecting the week-start preference.
  const firstWeekday =
    weekStart === 'sun'
      ? new Date(year, month, 1).getDay()
      : (new Date(year, month, 1).getDay() + 6) % 7;

  const weekdayNames = useMemo(() => {
    const base = weekStart === 'sun' ? new Date(2023, 11, 31) : new Date(2024, 0, 1); // Sunday or Monday
    return new Array(7).fill(0).map((_, i) =>
      new Date(base.getTime() + i * DAY_MS).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', {
        weekday: 'narrow',
      }),
    );
  }, [lang, weekStart]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    lang === 'ar' ? 'ar' : 'en-GB',
    { month: 'long', year: 'numeric' },
  );

  const shift = (delta: number) => {
    haptics.selection();
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const cells: Array<number | null> = [
    ...new Array(firstWeekday).fill(null),
    ...new Array(daysInMonth).fill(0).map((_, i) => i + 1),
  ];

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <Text style={[styles.panelLabel, { fontFamily: font(lang, 'semibold') }]}>
          {t('stats.moodCalendar')}
        </Text>
        <View style={styles.navRow}>
          <Pressy hitSlop={8} scaleTo={0.75} onPress={() => shift(-1)}>
            <Ionicons
              name="chevron-back"
              size={18}
              color={theme.colors.inkSoft}
              style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
            />
          </Pressy>
          <Text style={[styles.monthLabel, { fontFamily: font(lang, 'bold') }]}>{monthLabel}</Text>
          <Pressy hitSlop={8} scaleTo={0.75} onPress={() => shift(1)} disabled={isCurrentMonth}>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isCurrentMonth ? theme.colors.border : theme.colors.inkSoft}
              style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
            />
          </Pressy>
        </View>
      </View>

      <View style={styles.grid}>
        {weekdayNames.map((n, i) => (
          <Text key={`h-${i}`} style={[styles.weekday, { fontFamily: font(lang, 'semibold') }]}>
            {n}
          </Text>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <View key={`e-${i}`} style={styles.cell} />;
          const mood = dayColors.get(day);
          const isToday = isCurrentMonth && day === now.getDate();
          return (
            <Pressable
              key={`d-${day}`}
              disabled={!mood}
              onPress={() => {
                haptics.selection();
                setSelectedDay(selectedDay === day ? null : day);
              }}
              style={[
                styles.cell,
                styles.dayCell,
                mood ? { backgroundColor: mood.tint, borderColor: mood.color } : null,
                isToday && styles.today,
                selectedDay === day && styles.daySelected,
              ]}
            >
              <Text
                style={[
                  styles.dayNum,
                  { fontFamily: font(lang, 'semibold') },
                  mood ? { color: theme.colors.ink } : null,
                ]}
              >
                {day}
              </Text>
              {mood ? <Text style={styles.dayEmoji}>{mood.emoji}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {selectedDay != null && dayColors.get(selectedDay) ? (
        <View style={[styles.dayDetail, { borderColor: dayColors.get(selectedDay)!.color }]}>
          <Text style={styles.dayDetailEmoji}>{dayColors.get(selectedDay)!.emoji}</Text>
          <Text style={[styles.dayDetailText, { fontFamily: font(lang, 'bold') }]}>
            {t('stats.dayDetail', {
              day: selectedDay,
              feeling: feelingLabel(getCore(dayColors.get(selectedDay)!.coreId), lang),
              count: dayColors.get(selectedDay)!.total,
            })}
          </Text>
        </View>
      ) : null}

      <CoreLegend
        coreIds={[...new Set(Array.from(dayColors.values()).map((m) => m.coreId))]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm + 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  panelLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.inkFaint,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthLabel: {
    fontSize: 13,
    color: theme.colors.ink,
    minWidth: 110,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 10,
    color: theme.colors.inkFaint,
    paddingVertical: 4,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 1,
  },
  today: {
    borderWidth: 1.5,
    borderColor: theme.colors.purpleSoft,
  },
  daySelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dayDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    backgroundColor: theme.o(0.04),
  },
  dayDetailEmoji: {
    fontSize: 16,
  },
  dayDetailText: {
    flex: 1,
    fontSize: 12.5,
    color: theme.colors.ink,
    textAlign: 'left',
  },
  dayNum: {
    fontSize: 11,
    color: theme.colors.inkFaint,
    fontVariant: ['tabular-nums'],
  },
  dayEmoji: {
    fontSize: 12,
  },
});
