/**
 * Log flow — three steps through the feelings wheel (core → secondary → tertiary),
 * with a connected path trail showing exactly where you've been,
 * then an optional note, saved with the exact date and minute.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CoreFeeling,
  FEELINGS_WHEEL,
  FeelingNode,
  getCore,
  getSecondary,
  getTertiary,
  label,
} from '../src/data/feelings';
import { addEntry, deleteEntry, getEntry, updateEntry } from '../src/db';
import { theme, font } from '../src/theme';

type Step = 0 | 1 | 2 | 3;

const fadeIn = () => FadeIn.duration(theme.motion.fast);
const fadeOut = () => FadeOut.duration(100);
const layoutT = () => LinearTransition.duration(theme.motion.fast);

export default function LogScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editingId = editId ? Number(editId) : null;

  const [step, setStep] = useState<Step>(0);
  const [core, setCore] = useState<CoreFeeling | null>(null);
  const [secondary, setSecondary] = useState<FeelingNode | null>(null);
  const [tertiary, setTertiary] = useState<FeelingNode | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit mode: prefill from the existing entry and jump to the note step.
  // The user can walk back through the steps to change the feeling path.
  useEffect(() => {
    if (editingId == null) return;
    getEntry(editingId).then((entry) => {
      if (!entry) return;
      const c = getCore(entry.coreId) ?? null;
      setCore(c);
      setSecondary(getSecondary(entry.coreId, entry.secondaryId) ?? null);
      setTertiary(getTertiary(entry.coreId, entry.secondaryId, entry.tertiaryId) ?? null);
      setNote(entry.note ?? '');
      setStep(3);
    });
  }, [editingId]);

  const stepTitle = [t('log.stepCore'), t('log.stepSecondary'), t('log.stepTertiary'), t('log.noteTitle')][step];
  const accent = core?.color ?? theme.colors.purple;

  const options: FeelingNode[] = useMemo(() => {
    if (step === 0) return FEELINGS_WHEEL;
    if (step === 1) return core?.children ?? [];
    if (step === 2) return secondary?.children ?? [];
    return [];
  }, [step, core, secondary]);

  const pick = (nodeIndex: number) => {
    Haptics.selectionAsync();
    if (step === 0) {
      setCore(FEELINGS_WHEEL[nodeIndex]);
      setSecondary(null);
      setTertiary(null);
      setStep(1);
    } else if (step === 1) {
      setSecondary(options[nodeIndex]);
      setTertiary(null);
      setStep(2);
    } else if (step === 2) {
      setTertiary(options[nodeIndex]);
      setStep(3);
    }
  };

  const goBack = () => {
    Haptics.selectionAsync();
    if (step === 0) {
      router.back();
    } else {
      if (step === 1) setCore(null);
      if (step === 2) setSecondary(null);
      if (step === 3) setTertiary(null);
      setStep((step - 1) as Step);
    }
  };

  const save = async () => {
    if (!core || !secondary || !tertiary || saving) return;
    setSaving(true);
    const payload = {
      coreId: core.id,
      secondaryId: secondary.id,
      tertiaryId: tertiary.id,
      note: note.trim() === '' ? null : note.trim(),
    };
    if (editingId != null) {
      await updateEntry(editingId, payload);
    } else {
      await addEntry({ ...payload, createdAt: Date.now() });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const confirmDelete = () => {
    if (editingId == null) return;
    Haptics.selectionAsync();
    Alert.alert(t('history.deleteTitle'), t('history.deleteMessage'), [
      { text: t('history.cancel'), style: 'cancel' },
      {
        text: t('history.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(editingId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  };

  /** The traversal trail: [core, secondary, tertiary] as far as chosen. */
  const trail: Array<{ node: FeelingNode; ring: string }> = [];
  if (core) trail.push({ node: core, ring: t('log.ringCore') });
  if (secondary) trail.push({ node: secondary, ring: t('log.ringSecondary') });
  if (tertiary) trail.push({ node: tertiary, ring: t('log.ringTertiary') });

  return (
    <SafeAreaView style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
            <Ionicons
              name={step === 0 ? 'close' : 'chevron-back'}
              size={24}
              color={theme.colors.ink}
              style={{ transform: [{ scaleX: lang === 'ar' && step !== 0 ? -1 : 1 }] }}
            />
          </Pressable>
          {/* Segmented progress */}
          <View style={styles.segments}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  { backgroundColor: i <= step ? accent : 'rgba(255,255,255,0.10)' },
                ]}
              />
            ))}
          </View>
          <View style={styles.backBtn} />
        </View>

        {/* Path trail */}
        {trail.length > 0 ? (
          <Animated.View layout={layoutT()} style={styles.trail}>
            {trail.map((item, i) => (
              <Animated.View key={item.node.id} entering={fadeIn()} style={styles.trailItem}>
                {i > 0 ? (
                  <View style={[styles.trailConnector, { backgroundColor: accent }]} />
                ) : null}
                <View
                  style={[
                    styles.trailChip,
                    {
                      borderColor: accent,
                      backgroundColor: core?.tint ?? theme.colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.trailRing, { fontFamily: font(lang, 'semibold') }]}>
                    {item.ring}
                  </Text>
                  <Text
                    style={[
                      styles.trailLabel,
                      { fontFamily: font(lang, 'bold'), color: core?.colorMid ?? theme.colors.ink },
                    ]}
                  >
                    {i === 0 ? `${core?.emoji} ` : ''}
                    {label(item.node, lang)}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </Animated.View>
        ) : null}

        <Animated.Text
          key={`title-${step}`}
          entering={fadeIn()}
          style={[styles.title, { fontFamily: font(lang, 'extrabold') }]}
        >
          {stepTitle}
        </Animated.Text>

        {step < 3 ? (
          <Animated.ScrollView
            key={`step-${step}`}
            entering={fadeIn()}
            exiting={fadeOut()}
            contentContainerStyle={styles.options}
            showsVerticalScrollIndicator={false}
          >
            {options.map((node, index) => {
              const bg =
                step === 0
                  ? (node as CoreFeeling).tint
                  : core?.tint ?? theme.colors.surface;
              const border =
                step === 0 ? (node as CoreFeeling).color : core?.color ?? theme.colors.border;
              const fg =
                step === 0 ? (node as CoreFeeling).colorMid : core?.colorMid ?? theme.colors.ink;
              return (
                <Pressable
                  key={node.id}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: bg, borderColor: pressed ? border : theme.colors.border },
                    pressed && styles.optionPressed,
                  ]}
                  onPress={() => pick(index)}
                >
                  {step === 0 ? (
                    <Text style={styles.optionEmoji}>{(node as CoreFeeling).emoji}</Text>
                  ) : (
                    <View style={[styles.optionDot, { backgroundColor: border }]} />
                  )}
                  <Text style={[styles.optionText, { color: fg, fontFamily: font(lang, 'bold') }]}>
                    {label(node, lang)}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.colors.inkFaint}
                    style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
                  />
                </Pressable>
              );
            })}
          </Animated.ScrollView>
        ) : (
          <Animated.View entering={fadeIn()} style={styles.noteWrap}>
            <TextInput
              style={[
                styles.noteInput,
                { fontFamily: font(lang, 'regular'), borderColor: theme.colors.borderBright },
              ]}
              placeholder={t('log.notePlaceholder')}
              placeholderTextColor={theme.colors.inkFaint}
              value={note}
              onChangeText={setNote}
              multiline
              textAlignVertical="top"
              textAlign={lang === 'ar' ? 'right' : 'left'}
              maxLength={2000}
              selectionColor={accent}
            />
            <Pressable onPress={save} disabled={saving}>
              {({ pressed }) => (
                <LinearGradient
                  colors={theme.gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.saveBtn, pressed && styles.optionPressed]}
                >
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={[styles.saveText, { fontFamily: font(lang, 'bold') }]}>
                    {editingId != null ? t('log.update') : t('log.save')}
                  </Text>
                </LinearGradient>
              )}
            </Pressable>
            {editingId != null ? (
              <Pressable
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.optionPressed]}
                onPress={confirmDelete}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                <Text style={[styles.deleteText, { fontFamily: font(lang, 'bold') }]}>
                  {t('log.delete')}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        )}
      </KeyboardAvoidingView>
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    maxWidth: 180,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  trail: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    rowGap: 8,
  },
  trailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailConnector: {
    width: 14,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 2,
  },
  trailChip: {
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  trailRing: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.inkFaint,
  },
  trailLabel: {
    fontSize: 13,
  },
  title: {
    fontSize: 24,
    letterSpacing: -0.5,
    color: theme.colors.ink,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    textAlign: 'left',
  },
  options: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: 8,
  },
  option: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionEmoji: {
    fontSize: 20,
  },
  optionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionText: {
    fontSize: 16,
    flex: 1,
    textAlign: 'left',
  },
  noteWrap: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  noteInput: {
    backgroundColor: theme.colors.surfaceSolid,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    minHeight: 140,
    padding: theme.spacing.md,
    fontSize: 15,
    color: theme.colors.ink,
    lineHeight: 22,
  },
  saveBtn: {
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...theme.shadow.glow,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  deleteBtn: {
    marginTop: theme.spacing.sm + 4,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  deleteText: {
    color: theme.colors.danger,
    fontSize: 15,
  },
});
