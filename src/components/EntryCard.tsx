/**
 * EntryCard — a glassy journal card for one feeling entry,
 * color-coded with the wheel colors of its core feeling.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { FeelingEntry } from '../db';
import { getCore, getSecondary, getTertiary, label } from '../data/feelings';
import { theme, font } from '../theme';
import { relativeTime, formatClock } from '../timeFormat';

interface Props {
  entry: FeelingEntry;
  index?: number;
  onLongPress?: () => void;
}

export function EntryCard({ entry, index = 0, onLongPress }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();

  const core = getCore(entry.coreId);
  const secondary = getSecondary(entry.coreId, entry.secondaryId);
  const tertiary = getTertiary(entry.coreId, entry.secondaryId, entry.tertiaryId);
  if (!core) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(theme.motion.base).delay(Math.min(index, 6) * 40)}
    >
      <Pressable
        onPress={() => router.push({ pathname: '/log', params: { editId: String(entry.id) } })}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={[styles.stripe, { backgroundColor: core.color }]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: core.tint, borderRadius: theme.radius.md }]} />
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text style={styles.emoji}>{core.emoji}</Text>
            <View style={styles.pathRow}>
              <Text style={[styles.pathCore, { fontFamily: font(lang, 'bold'), color: core.colorMid }]}>
                {label(core, lang)}
              </Text>
              {secondary ? (
                <>
                  <Text style={styles.pathSep}>›</Text>
                  <Text style={[styles.pathMid, { fontFamily: font(lang, 'semibold') }]}>
                    {label(secondary, lang)}
                  </Text>
                </>
              ) : null}
              {tertiary ? (
                <>
                  <Text style={styles.pathSep}>›</Text>
                  <Text style={[styles.pathLeaf, { fontFamily: font(lang, 'bold'), color: core.colorMid }]}>
                    {label(tertiary, lang)}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          {entry.note ? (
            <Text style={[styles.note, { fontFamily: font(lang, 'regular') }]}>{entry.note}</Text>
          ) : null}
          <View style={styles.footerRow}>
            <Text style={[styles.time, { fontFamily: font(lang, 'semibold') }]}>
              {relativeTime(entry.createdAt, t, lang)} · {formatClock(entry.createdAt, lang)}
            </Text>
            {entry.edited ? (
              <View style={styles.editedTag}>
                <Text style={[styles.editedTagText, { fontFamily: font(lang, 'semibold') }]}>
                  {t('entry.edited')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSolid,
    marginBottom: 10,
    overflow: 'hidden',
  },
  stripe: {
    width: 3,
    zIndex: 1,
  },
  body: {
    flex: 1,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 18,
  },
  pathRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pathCore: {
    fontSize: 13,
  },
  pathMid: {
    fontSize: 13,
    color: theme.colors.inkSoft,
  },
  pathLeaf: {
    fontSize: 14,
  },
  pathSep: {
    fontSize: 12,
    color: theme.colors.inkFaint,
  },
  note: {
    marginTop: 6,
    fontSize: 13,
    color: theme.colors.ink,
    lineHeight: 19,
    textAlign: 'left',
  },
  cardPressed: {
    opacity: 0.8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  time: {
    fontSize: 11,
    color: theme.colors.inkFaint,
    fontVariant: ['tabular-nums'],
    textAlign: 'left',
  },
  editedTag: {
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  editedTagText: {
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.inkSoft,
  },
});
