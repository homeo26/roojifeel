/**
 * EntryCard — a glassy journal card for one feeling entry.
 * v2: renders multiple feelings, intensity dots, tags, a photo
 * thumbnail, and inline voice-memo playback.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import { FeelingEntry } from '../db';
import { getCore, getSecondary, getTertiary, label } from '../data/feelings';
import { theme, font } from '../theme';
import { relativeTime, formatClock } from '../timeFormat';
import * as haptics from '../haptics';

/** One shared player so cards never overlap audio. */
let sharedPlayer: AudioPlayer | null = null;
function playAudio(uri: string) {
  try {
    sharedPlayer?.release();
  } catch {
    // released already
  }
  sharedPlayer = createAudioPlayer(uri);
  sharedPlayer.play();
}

interface Props {
  entry: FeelingEntry;
  index?: number;
  onLongPress?: () => void;
}

export function EntryCard({ entry, index = 0, onLongPress }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();

  const primary = entry.feelings[0];
  const core = primary ? getCore(primary.coreId) : undefined;
  if (!core || !primary) return null;

  return (
    <Animated.View entering={FadeIn.duration(theme.motion.base).delay(Math.min(index, 6) * 40)}>
      <Pressable
        onPress={() => router.push({ pathname: '/log', params: { editId: String(entry.id) } })}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={[styles.stripe, { backgroundColor: core.color }]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: core.tint, borderRadius: theme.radius.md }]} />
        <View style={styles.body}>
          {/* Feelings */}
          {entry.feelings.map((f, i) => {
            const c = getCore(f.coreId);
            const sec = getSecondary(f.coreId, f.secondaryId);
            const tert = getTertiary(f.coreId, f.secondaryId, f.tertiaryId);
            if (!c) return null;
            return (
              <View key={`${f.coreId}-${f.tertiaryId}-${i}`} style={[styles.headerRow, i > 0 && styles.extraFeeling]}>
                <Text style={styles.emoji}>{c.emoji}</Text>
                <View style={styles.pathRow}>
                  <Text style={[styles.pathCore, { fontFamily: font(lang, 'bold'), color: c.colorMid }]}>
                    {label(c, lang)}
                  </Text>
                  <Text style={styles.pathSep}>›</Text>
                  <Text style={[styles.pathMid, { fontFamily: font(lang, 'semibold') }]}>
                    {label(sec, lang)}
                  </Text>
                  <Text style={styles.pathSep}>›</Text>
                  <Text style={[styles.pathLeaf, { fontFamily: font(lang, 'bold'), color: c.colorMid }]}>
                    {label(tert, lang)}
                  </Text>
                </View>
                {i === 0 && entry.intensity != null ? (
                  <View style={styles.intensityRow}>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <View
                        key={d}
                        style={[
                          styles.intensityDot,
                          { backgroundColor: d <= (entry.intensity ?? 0) ? c.color : 'rgba(255,255,255,0.12)' },
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}

          {entry.note ? (
            <Text style={[styles.note, { fontFamily: font(lang, 'regular') }]}>{entry.note}</Text>
          ) : null}

          {/* Tags */}
          {entry.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {entry.tags.map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={[styles.tagText, { fontFamily: font(lang, 'semibold') }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={[styles.time, { fontFamily: font(lang, 'semibold') }]}>
              {relativeTime(entry.createdAt, t, lang)} · {formatClock(entry.createdAt, lang)}
            </Text>
            {entry.audioUri ? (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  haptics.selection();
                  playAudio(entry.audioUri!);
                }}
              >
                <Ionicons name="play-circle" size={18} color={theme.colors.tealSoft} />
              </Pressable>
            ) : null}
            {entry.edited ? (
              <View style={styles.editedTag}>
                <Text style={[styles.editedTagText, { fontFamily: font(lang, 'semibold') }]}>
                  {t('entry.edited')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {entry.photoUri ? <Image source={{ uri: entry.photoUri }} style={styles.photo} /> : null}
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
  cardPressed: {
    opacity: 0.8,
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
  extraFeeling: {
    marginTop: 4,
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
  intensityRow: {
    flexDirection: 'row',
    gap: 3,
  },
  intensityDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  note: {
    marginTop: 6,
    fontSize: 13,
    color: theme.colors.ink,
    lineHeight: 19,
    textAlign: 'left',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
  },
  tagText: {
    fontSize: 10,
    color: theme.colors.purpleSoft,
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
  photo: {
    width: 72,
    alignSelf: 'stretch',
    borderStartWidth: 1,
    borderStartColor: theme.colors.border,
  },
});
