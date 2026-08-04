/**
 * Log flow v2 — three steps through the feelings wheel per feeling, with
 * support for MULTIPLE feelings per check-in, then a details step:
 * intensity slider, tags, photo, voice memo, and an optional note.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
import * as haptics from '../src/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import {
  AudioModule,
  RecordingPresets,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import {
  CoreFeeling,
  FEELINGS_WHEEL,
  FeelingNode,
  getCore,
  getSecondary,
  getTertiary,
  label,
} from '../src/data/feelings';
import { FeelingPath, addEntry, deleteEntry, getAllTags, getEntry, updateEntry } from '../src/db';
import { deleteAttachment, isPersisted, persistAttachment } from '../src/attachments';
import { syncSmartReminders } from '../src/notifications';
import { theme, font } from '../src/theme';

type Step = 0 | 1 | 2 | 3;

const fadeIn = () => FadeIn.duration(theme.motion.fast);
const fadeOut = () => FadeOut.duration(100);
const layoutT = () => LinearTransition.duration(theme.motion.fast);

export default function LogScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const { editId, coreId } = useLocalSearchParams<{ editId?: string; coreId?: string }>();
  const editingId = editId ? Number(editId) : null;

  const [step, setStep] = useState<Step>(0);
  // Wheel selection in progress:
  const [core, setCore] = useState<CoreFeeling | null>(null);
  const [secondary, setSecondary] = useState<FeelingNode | null>(null);
  // Accumulated feelings for this check-in:
  const [feelings, setFeelings] = useState<FeelingPath[]>([]);
  const [intensity, setIntensity] = useState(3);
  const [intensityTouched, setIntensityTouched] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Voice memo recording/playback.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer(audioUri ?? undefined);

  useEffect(() => {
    getAllTags().then(setTagSuggestions);
  }, []);

  // Edit mode: prefill from the existing entry and jump to details.
  useEffect(() => {
    if (editingId == null) return;
    getEntry(editingId).then((entry) => {
      if (!entry) return;
      setFeelings(entry.feelings);
      setNote(entry.note ?? '');
      setTags(entry.tags);
      setPhotoUri(entry.photoUri);
      setAudioUri(entry.audioUri);
      if (entry.intensity != null) {
        setIntensity(entry.intensity);
        setIntensityTouched(true);
      }
      setStep(3);
    });
  }, [editingId]);

  // Quick-log: a core was chosen on the home screen.
  useEffect(() => {
    if (editingId != null || !coreId) return;
    const c = getCore(coreId);
    if (c) {
      setCore(c);
      setStep(1);
    }
  }, [coreId, editingId]);

  const stepTitle = [
    feelings.length > 0 ? t('log.stepCoreAnother') : t('log.stepCore'),
    t('log.stepSecondary'),
    t('log.stepTertiary'),
    t('log.detailsTitle'),
  ][step];
  const accent = core?.color ?? getCore(feelings[0]?.coreId)?.color ?? theme.colors.purple;

  const options: FeelingNode[] = useMemo(() => {
    if (step === 0) return FEELINGS_WHEEL;
    if (step === 1) return core?.children ?? [];
    if (step === 2) return secondary?.children ?? [];
    return [];
  }, [step, core, secondary]);

  const pick = (index: number) => {
    haptics.selection();
    if (step === 0) {
      setCore(FEELINGS_WHEEL[index]);
      setSecondary(null);
      setStep(1);
    } else if (step === 1) {
      setSecondary(options[index]);
      setStep(2);
    } else if (step === 2 && core && secondary) {
      const path: FeelingPath = {
        coreId: core.id,
        secondaryId: secondary.id,
        tertiaryId: options[index].id,
      };
      setFeelings((prev) => [...prev, path]);
      setCore(null);
      setSecondary(null);
      setStep(3);
    }
  };

  const goBack = () => {
    haptics.selection();
    if (step === 0) {
      if (feelings.length > 0) setStep(3);
      else router.back();
    } else if (step === 3) {
      router.back();
    } else {
      if (step === 1) setCore(null);
      if (step === 2) setSecondary(null);
      setStep((step - 1) as Step);
    }
  };

  const removeFeeling = (index: number) => {
    haptics.selection();
    setFeelings((prev) => prev.filter((_, i) => i !== index));
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '');
    if (!tag) return;
    haptics.selection();
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setTagInput('');
  };

  const pickPhoto = async () => {
    haptics.selection();
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  };

  const toggleRecording = async () => {
    haptics.selection();
    if (recorderState.isRecording) {
      await recorder.stop();
      if (recorder.uri) setAudioUri(recorder.uri);
      return;
    }
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('log.micDenied'));
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const save = async () => {
    if (feelings.length === 0 || saving) return;
    setSaving(true);
    // Move fresh attachments into permanent storage.
    const finalPhoto = photoUri && !isPersisted(photoUri) ? persistAttachment(photoUri, 'photo') : photoUri;
    const finalAudio = audioUri && !isPersisted(audioUri) ? persistAttachment(audioUri, 'audio') : audioUri;
    const payload = {
      feelings,
      note: note.trim() === '' ? null : note.trim(),
      intensity: intensityTouched ? intensity : null,
      tags,
      photoUri: finalPhoto,
      audioUri: finalAudio,
    };
    if (editingId != null) {
      await updateEntry(editingId, payload);
    } else {
      await addEntry({ ...payload, createdAt: Date.now() });
    }
    haptics.success();
    syncSmartReminders({
      title: t('settings.notifTitle'),
      body: t('settings.notifBody'),
      nudgeTitle: t('settings.nudgeTitle'),
      nudgeBody: t('settings.nudgeBody'),
    }).catch(() => {});
    router.back();
  };

  const confirmDelete = () => {
    if (editingId == null) return;
    haptics.selection();
    Alert.alert(t('history.deleteTitle'), t('history.deleteMessage'), [
      { text: t('history.cancel'), style: 'cancel' },
      {
        text: t('history.delete'),
        style: 'destructive',
        onPress: async () => {
          const entry = await getEntry(editingId);
          await deleteEntry(editingId);
          deleteAttachment(entry?.photoUri ?? null);
          deleteAttachment(entry?.audioUri ?? null);
          haptics.success();
          router.back();
        },
      },
    ]);
  };

  /** Wheel trail while picking. */
  const trail: Array<{ node: FeelingNode; ring: string }> = [];
  if (core) trail.push({ node: core, ring: t('log.ringCore') });
  if (secondary) trail.push({ node: secondary, ring: t('log.ringSecondary') });

  const intensityLabels = [
    t('log.intensity1'),
    t('log.intensity2'),
    t('log.intensity3'),
    t('log.intensity4'),
    t('log.intensity5'),
  ];

  return (
    <SafeAreaView
      style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
            <Ionicons
              name={step === 0 && feelings.length === 0 ? 'close' : step === 3 ? 'close' : 'chevron-back'}
              size={24}
              color={theme.colors.ink}
              style={{ transform: [{ scaleX: lang === 'ar' && step !== 3 && step !== 0 ? -1 : 1 }] }}
            />
          </Pressable>
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

        {/* Wheel trail while picking */}
        {step < 3 && trail.length > 0 ? (
          <Animated.View layout={layoutT()} style={styles.trail}>
            {trail.map((item, i) => (
              <Animated.View key={item.node.id} entering={fadeIn()} style={styles.trailItem}>
                {i > 0 ? <View style={[styles.trailConnector, { backgroundColor: accent }]} /> : null}
                <View
                  style={[
                    styles.trailChip,
                    { borderColor: accent, backgroundColor: core?.tint ?? theme.colors.surface },
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
              const bg = step === 0 ? (node as CoreFeeling).tint : core?.tint ?? theme.colors.surface;
              const border = step === 0 ? (node as CoreFeeling).color : core?.color ?? theme.colors.border;
              const fg = step === 0 ? (node as CoreFeeling).colorMid : core?.colorMid ?? theme.colors.ink;
              return (
                <Pressable
                  key={node.id}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: bg, borderColor: pressed ? border : theme.colors.border },
                    pressed && styles.pressed,
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
          <Animated.ScrollView
            entering={fadeIn()}
            contentContainerStyle={styles.details}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Chosen feelings */}
            <View style={styles.feelingsWrap}>
              {feelings.map((f, i) => {
                const c = getCore(f.coreId);
                const tert = getTertiary(f.coreId, f.secondaryId, f.tertiaryId);
                const sec = getSecondary(f.coreId, f.secondaryId);
                if (!c) return null;
                return (
                  <Animated.View
                    key={`${f.coreId}-${f.tertiaryId}-${i}`}
                    entering={fadeIn()}
                    layout={layoutT()}
                    style={[styles.feelingChip, { backgroundColor: c.tint, borderColor: c.color }]}
                  >
                    <Text style={styles.feelingChipEmoji}>{c.emoji}</Text>
                    <View>
                      <Text style={[styles.feelingChipPath, { fontFamily: font(lang, 'semibold') }]}>
                        {label(c, lang)} › {label(sec, lang)}
                      </Text>
                      <Text style={[styles.feelingChipLeaf, { fontFamily: font(lang, 'bold'), color: c.colorMid }]}>
                        {label(tert, lang)}
                      </Text>
                    </View>
                    <Pressable hitSlop={8} onPress={() => removeFeeling(i)}>
                      <Ionicons name="close-circle" size={18} color={theme.colors.inkFaint} />
                    </Pressable>
                  </Animated.View>
                );
              })}
              <Pressable
                style={({ pressed }) => [styles.addFeelingChip, pressed && styles.pressed]}
                onPress={() => {
                  haptics.selection();
                  setStep(0);
                }}
              >
                <Ionicons name="add" size={16} color={theme.colors.purpleSoft} />
                <Text style={[styles.addFeelingText, { fontFamily: font(lang, 'bold') }]}>
                  {t('log.addFeeling')}
                </Text>
              </Pressable>
            </View>

            {/* Intensity */}
            <Text style={[styles.fieldLabel, { fontFamily: font(lang, 'semibold') }]}>
              {t('log.intensity')}
            </Text>
            <View style={styles.intensityCard}>
              <Slider
                style={{ width: '100%', height: 36 }}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={intensity}
                onValueChange={(v: number) => {
                  if (v !== intensity) haptics.selection();
                  setIntensity(v);
                  setIntensityTouched(true);
                }}
                minimumTrackTintColor={accent}
                maximumTrackTintColor="rgba(255,255,255,0.10)"
                thumbTintColor={accent}
              />
              <Text style={[styles.intensityLabel, { fontFamily: font(lang, 'bold'), color: accent }]}>
                {intensityLabels[intensity - 1]}
              </Text>
            </View>

            {/* Tags */}
            <Text style={[styles.fieldLabel, { fontFamily: font(lang, 'semibold') }]}>
              {t('log.tags')}
            </Text>
            <View style={styles.tagsWrap}>
              {tags.map((tag) => (
                <Pressable
                  key={tag}
                  style={styles.tagChipActive}
                  onPress={() => {
                    haptics.selection();
                    setTags((prev) => prev.filter((x) => x !== tag));
                  }}
                >
                  <Text style={[styles.tagTextActive, { fontFamily: font(lang, 'semibold') }]}>
                    #{tag}
                  </Text>
                  <Ionicons name="close" size={12} color={theme.colors.purpleSoft} />
                </Pressable>
              ))}
              <TextInput
                style={[styles.tagInput, { fontFamily: font(lang, 'regular') }]}
                placeholder={t('log.tagPlaceholder')}
                placeholderTextColor={theme.colors.inkFaint}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={() => addTag(tagInput)}
                returnKeyType="done"
                autoCapitalize="none"
              />
            </View>
            {tagSuggestions.filter((s) => !tags.includes(s)).length > 0 ? (
              <View style={styles.tagsWrap}>
                {tagSuggestions
                  .filter((s) => !tags.includes(s))
                  .slice(0, 8)
                  .map((s) => (
                    <Pressable key={s} style={styles.tagChip} onPress={() => addTag(s)}>
                      <Text style={[styles.tagText, { fontFamily: font(lang, 'semibold') }]}>#{s}</Text>
                    </Pressable>
                  ))}
              </View>
            ) : null}

            {/* Attachments */}
            <Text style={[styles.fieldLabel, { fontFamily: font(lang, 'semibold') }]}>
              {t('log.attachments')}
            </Text>
            <View style={styles.attachRow}>
              {photoUri ? (
                <View style={styles.photoWrap}>
                  <Image source={{ uri: photoUri }} style={styles.photoThumb} />
                  <Pressable
                    style={styles.attachRemove}
                    hitSlop={8}
                    onPress={() => {
                      haptics.selection();
                      setPhotoUri(null);
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={theme.colors.ink} />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={({ pressed }) => [styles.attachBtn, pressed && styles.pressed]} onPress={pickPhoto}>
                  <Ionicons name="image-outline" size={20} color={theme.colors.tealSoft} />
                  <Text style={[styles.attachText, { fontFamily: font(lang, 'semibold') }]}>
                    {t('log.addPhoto')}
                  </Text>
                </Pressable>
              )}

              {audioUri ? (
                <View style={[styles.attachBtn, styles.audioReady]}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      haptics.selection();
                      player.seekTo(0);
                      player.play();
                    }}
                  >
                    <Ionicons name="play-circle" size={22} color={theme.colors.tealSoft} />
                  </Pressable>
                  <Text style={[styles.attachText, { fontFamily: font(lang, 'semibold') }]}>
                    {t('log.voiceMemo')}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      haptics.selection();
                      setAudioUri(null);
                    }}
                  >
                    <Ionicons name="close-circle" size={18} color={theme.colors.inkFaint} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.attachBtn,
                    recorderState.isRecording && styles.recording,
                    pressed && styles.pressed,
                  ]}
                  onPress={toggleRecording}
                >
                  <Ionicons
                    name={recorderState.isRecording ? 'stop-circle' : 'mic-outline'}
                    size={20}
                    color={recorderState.isRecording ? theme.colors.danger : theme.colors.pinkSoft}
                  />
                  <Text
                    style={[
                      styles.attachText,
                      { fontFamily: font(lang, 'semibold') },
                      recorderState.isRecording && { color: theme.colors.danger },
                    ]}
                  >
                    {recorderState.isRecording ? t('log.stopRecording') : t('log.recordVoice')}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Note */}
            <Text style={[styles.fieldLabel, { fontFamily: font(lang, 'semibold') }]}>
              {t('log.noteTitle')}
            </Text>
            <TextInput
              style={[styles.noteInput, { fontFamily: font(lang, 'regular') }]}
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

            {/* Save / delete */}
            <Pressable onPress={save} disabled={saving || feelings.length === 0}>
              {({ pressed }) => (
                <LinearGradient
                  colors={theme.gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.saveBtn, (pressed || feelings.length === 0) && styles.pressed]}
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
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                onPress={confirmDelete}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                <Text style={[styles.deleteText, { fontFamily: font(lang, 'bold') }]}>
                  {t('log.delete')}
                </Text>
              </Pressable>
            ) : null}
          </Animated.ScrollView>
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
  pressed: {
    opacity: 0.8,
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
  details: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  feelingsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  feelingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  feelingChipEmoji: {
    fontSize: 18,
  },
  feelingChipPath: {
    fontSize: 10,
    color: theme.colors.inkSoft,
  },
  feelingChipLeaf: {
    fontSize: 14,
  },
  addFeelingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderBright,
  },
  addFeelingText: {
    fontSize: 13,
    color: theme.colors.purpleSoft,
  },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.inkFaint,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    textAlign: 'left',
  },
  intensityCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  intensityLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginBottom: 6,
  },
  tagChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagChipActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    borderWidth: 1,
    borderColor: theme.colors.purple,
  },
  tagText: {
    fontSize: 12,
    color: theme.colors.inkSoft,
  },
  tagTextActive: {
    fontSize: 12,
    color: theme.colors.purpleSoft,
  },
  tagInput: {
    minWidth: 120,
    flexGrow: 1,
    backgroundColor: theme.colors.surfaceSolid,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 13,
    color: theme.colors.ink,
  },
  attachRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  recording: {
    borderColor: theme.colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  audioReady: {
    borderColor: theme.colors.teal,
  },
  attachText: {
    fontSize: 13,
    color: theme.colors.inkSoft,
  },
  photoWrap: {
    position: 'relative',
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
  },
  attachRemove: {
    position: 'absolute',
    top: -8,
    end: -8,
  },
  noteInput: {
    backgroundColor: theme.colors.surfaceSolid,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    minHeight: 110,
    padding: theme.spacing.md,
    fontSize: 15,
    color: theme.colors.ink,
    lineHeight: 22,
  },
  saveBtn: {
    marginTop: theme.spacing.lg,
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
