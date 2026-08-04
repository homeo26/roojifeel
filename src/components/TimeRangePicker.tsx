/**
 * TimeRangePicker — Kibana-style time selection, phone-friendly.
 * A compact trigger shows the current range; tapping opens a bottom sheet
 * with two modes:
 *   • Quick    — Today, Yesterday, Last N days, All time
 *   • Absolute — explicit From / To dates via native date pickers
 */
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import * as haptics from '../haptics';
import { theme, font } from '../theme';

const DAY_MS = 24 * 60 * 60 * 1000;

export type TimeRange =
  | { kind: 'last'; days: number }
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'all' }
  | { kind: 'absolute'; from: number; to: number };

export const DEFAULT_RANGE: TimeRange = { kind: 'last', days: 14 };

/** Resolve a TimeRange into inclusive [from, to] epoch-ms bounds. */
export function resolveRange(range: TimeRange): { from: number; to: number } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (range.kind) {
    case 'today':
      return { from: startOfToday, to: startOfToday + DAY_MS - 1 };
    case 'yesterday':
      return { from: startOfToday - DAY_MS, to: startOfToday - 1 };
    case 'last':
      return { from: startOfToday - (range.days - 1) * DAY_MS, to: Date.now() };
    case 'all':
      return { from: 0, to: Date.now() };
    case 'absolute': {
      const from = new Date(range.from);
      const to = new Date(range.to);
      return {
        from: new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime(),
        to: new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime() + DAY_MS - 1,
      };
    }
  }
}

/** Number of days covered by the range (>= 1). */
export function rangeDayCount(range: TimeRange): number {
  const { from, to } = resolveRange(range);
  return Math.max(1, Math.ceil((to - from) / DAY_MS));
}

function formatDate(ms: number, lang: string): string {
  return new Date(ms).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function rangeLabel(range: TimeRange, t: TFunction, lang: string): string {
  switch (range.kind) {
    case 'today':
      return t('range.today');
    case 'yesterday':
      return t('range.yesterday');
    case 'last':
      return t('range.lastDays', { count: range.days });
    case 'all':
      return t('range.allTime');
    case 'absolute':
      return `${formatDate(range.from, lang)} → ${formatDate(range.to, lang)}`;
  }
}

const QUICK: TimeRange[] = [
  { kind: 'today' },
  { kind: 'yesterday' },
  { kind: 'last', days: 7 },
  { kind: 'last', days: 14 },
  { kind: 'last', days: 30 },
  { kind: 'last', days: 90 },
  { kind: 'all' },
];

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangePicker({ value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'quick' | 'absolute'>(
    value.kind === 'absolute' ? 'absolute' : 'quick',
  );
  const [absFrom, setAbsFrom] = useState<number>(
    value.kind === 'absolute' ? value.from : Date.now() - 13 * DAY_MS,
  );
  const [absTo, setAbsTo] = useState<number>(value.kind === 'absolute' ? value.to : Date.now());
  const [androidPicker, setAndroidPicker] = useState<'from' | 'to' | null>(null);

  const dir = lang === 'ar' ? ('rtl' as const) : ('ltr' as const);

  const applyQuick = (range: TimeRange) => {
    haptics.selection();
    onChange(range);
    setOpen(false);
  };

  const applyAbsolute = () => {
    haptics.selection();
    const from = Math.min(absFrom, absTo);
    const to = Math.max(absFrom, absTo);
    onChange({ kind: 'absolute', from, to });
    setOpen(false);
  };

  const isActive = (r: TimeRange) =>
    JSON.stringify(r) === JSON.stringify(value);

  const onPick = (which: 'from' | 'to') => (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setAndroidPicker(null);
    if (event.type !== 'set' || !date) return;
    if (which === 'from') setAbsFrom(date.getTime());
    else setAbsTo(date.getTime());
  };

  return (
    <>
      {/* Trigger */}
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Ionicons name="time-outline" size={15} color={theme.colors.tealSoft} />
        <Text style={[styles.triggerText, { fontFamily: font(lang, 'semibold') }]}>
          {rangeLabel(value, t, lang)}
        </Text>
        <Ionicons name="chevron-down" size={13} color={theme.colors.inkFaint} />
      </Pressable>

      {/* Sheet */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { direction: dir }]} onPress={() => {}}>
            <View style={styles.grabber} />
            {/* Mode tabs */}
            <View style={styles.modeRow}>
              {(['quick', 'absolute'] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.modeTab, mode === m && styles.modeTabActive]}
                  onPress={() => {
                    haptics.selection();
                    setMode(m);
                  }}
                >
                  <Text
                    style={[
                      styles.modeText,
                      { fontFamily: font(lang, 'bold') },
                      mode === m && styles.modeTextActive,
                    ]}
                  >
                    {t(`range.${m}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === 'quick' ? (
              <View style={styles.quickWrap}>
                {QUICK.map((r, i) => (
                  <Pressable
                    key={i}
                    style={[styles.quickChip, isActive(r) && styles.quickChipActive]}
                    onPress={() => applyQuick(r)}
                  >
                    <Text
                      style={[
                        styles.quickText,
                        { fontFamily: font(lang, 'semibold') },
                        isActive(r) && styles.quickTextActive,
                      ]}
                    >
                      {rangeLabel(r, t, lang)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.absWrap}>
                {(['from', 'to'] as const).map((which) => {
                  const ms = which === 'from' ? absFrom : absTo;
                  return (
                    <View key={which} style={styles.absRow}>
                      <Text style={[styles.absLabel, { fontFamily: font(lang, 'semibold') }]}>
                        {t(`range.${which}`)}
                      </Text>
                      {Platform.OS === 'ios' ? (
                        <DateTimePicker
                          value={new Date(ms)}
                          mode="date"
                          display="compact"
                          themeVariant="dark"
                          maximumDate={new Date()}
                          onChange={onPick(which)}
                        />
                      ) : (
                        <Pressable
                          style={styles.absValueBtn}
                          onPress={() => setAndroidPicker(which)}
                        >
                          <Text style={[styles.absValue, { fontFamily: font(lang, 'bold') }]}>
                            {formatDate(ms, lang)}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                {androidPicker != null ? (
                  <DateTimePicker
                    value={new Date(androidPicker === 'from' ? absFrom : absTo)}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={onPick(androidPicker)}
                  />
                ) : null}
                <Pressable style={styles.applyBtn} onPress={applyAbsolute}>
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  <Text style={[styles.applyText, { fontFamily: font(lang, 'bold') }]}>
                    {t('range.apply')}
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
  },
  triggerText: {
    fontSize: 13,
    color: theme.colors.ink,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surfaceSolid,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl + 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderBright,
    marginBottom: theme.spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: theme.radius.sm,
    padding: 3,
    marginBottom: theme.spacing.md,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radius.sm - 2,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
  },
  modeText: {
    fontSize: 13,
    color: theme.colors.inkSoft,
  },
  modeTextActive: {
    color: theme.colors.purpleSoft,
  },
  quickWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickChipActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: theme.colors.purple,
  },
  quickText: {
    fontSize: 13,
    color: theme.colors.inkSoft,
  },
  quickTextActive: {
    color: theme.colors.purpleSoft,
  },
  absWrap: {
    gap: 12,
  },
  absRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  absLabel: {
    fontSize: 13,
    color: theme.colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  absValueBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
  },
  absValue: {
    fontSize: 14,
    color: theme.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  applyBtn: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.purple,
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
});
