/**
 * Settings — multiple daily reminders at exact times, language (EN/AR
 * with instant RTL), and data import/export.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import * as haptics from '../haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { theme, font } from '../theme';
import { Pressy } from '../components/Pressy';
import { saveLanguage } from '../i18n';
import {
  ReminderTime,
  applyReminders,
  loadReminders,
  normalizeReminders,
  requestNotificationPermission,
} from '../notifications';
import { exportHistory, importHistory } from '../exportImport';
import { disableBackup, enableBackup, getBackupStatus } from '../backup';

const layoutT = () => LinearTransition.duration(theme.motion.fast);

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [reminders, setReminders] = useState<ReminderTime[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingTime, setPendingTime] = useState<Date>(new Date(2024, 0, 1, 20, 0));
  const [busy, setBusy] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(haptics.hapticsEnabled());
  const [backupOn, setBackupOn] = useState(false);
  const [lastBackup, setLastBackup] = useState<number | null>(null);

  useEffect(() => {
    getBackupStatus().then((st) => {
      setBackupOn(st.enabled);
      setLastBackup(st.lastBackupAt);
    });
  }, []);

  const toggleBackup = async (value: boolean) => {
    haptics.selection();
    if (value) {
      const ok = await enableBackup();
      setBackupOn(ok);
      if (ok) getBackupStatus().then((st) => setLastBackup(st.lastBackupAt));
    } else {
      await disableBackup();
      setBackupOn(false);
    }
  };

  const toggleHaptics = async (value: boolean) => {
    setHapticsOn(value);
    await haptics.setHapticsEnabled(value);
    if (value) haptics.selection(); // confirm with a tick only when enabling
  };

  useEffect(() => {
    loadReminders().then(setReminders);
  }, []);

  const persist = async (next: ReminderTime[]) => {
    const normalized = normalizeReminders(next);
    setReminders(normalized);
    if (normalized.length > 0) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(t('settings.permissionDenied'));
        return;
      }
    }
    await applyReminders(normalized, t('settings.notifTitle'), t('settings.notifBody'));
  };

  const onTimePicked = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      // Android's dialog has its own OK / Cancel — apply on OK.
      setShowTimePicker(false);
      if (event.type !== 'set' || !date) return;
      haptics.success();
      persist([...reminders, { hour: date.getHours(), minute: date.getMinutes() }]);
      return;
    }
    // iOS spinner fires on every wheel move — just track the pending value.
    if (date) setPendingTime(date);
  };

  const confirmPendingTime = () => {
    haptics.success();
    setShowTimePicker(false);
    persist([...reminders, { hour: pendingTime.getHours(), minute: pendingTime.getMinutes() }]);
  };

  const removeReminder = (index: number) => {
    haptics.selection();
    persist(reminders.filter((_, i) => i !== index));
  };

  const switchLanguage = (next: 'en' | 'ar') => {
    if (next === lang) return;
    haptics.selection();
    // Let the press animation render before the app-wide re-render that
    // changeLanguage triggers (it would otherwise freeze the JS thread
    // mid-animation and make the button feel stuck).
    setTimeout(async () => {
      await saveLanguage(next);
      await i18n.changeLanguage(next);
      // Layout direction is fully handled in JS (per-screen `direction`
      // styles + custom tab bar) — no native flag, no restart needed.
    }, 120);
  };

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const count = await exportHistory();
      if (count === 0) Alert.alert(t('settings.exportEmpty'));
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const count = await importHistory();
      if (count !== null) {
        Alert.alert(t('settings.imported', { count }));
      }
    } catch {
      Alert.alert(t('settings.importError'));
    } finally {
      setBusy(false);
    }
  };

  const fmtTime = (r: ReminderTime) =>
    `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`;

  return (
    <SafeAreaView style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { fontFamily: font(lang, 'extrabold') }]}>
          {t('settings.title')}
        </Text>

        {/* Reminders */}
        <Text style={[styles.sectionTitle, { fontFamily: font(lang, 'bold') }]}>
          {t('settings.reminders')}
        </Text>
        <Text style={[styles.sectionDesc, { fontFamily: font(lang, 'regular') }]}>
          {t('settings.remindersDesc')}
        </Text>

        <Animated.View layout={layoutT()} style={styles.card}>
          {reminders.length === 0 ? (
            <Text style={[styles.noReminders, { fontFamily: font(lang, 'regular') }]}>
              {t('settings.noReminders')}
            </Text>
          ) : (
            reminders.map((r, i) => (
              <Animated.View
                key={`${r.hour}-${r.minute}`}
                entering={FadeIn.duration(theme.motion.fast)}
                layout={layoutT()}
                style={[styles.reminderRow, i > 0 && styles.reminderRowBorder]}
              >
                <Ionicons name="alarm-outline" size={18} color={theme.colors.tealSoft} />
                <Text style={[styles.reminderTime, { fontFamily: font(lang, 'bold') }]}>
                  {fmtTime(r)}
                </Text>
                <Pressy hitSlop={10} scaleTo={0.8} onPress={() => removeReminder(i)}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                </Pressy>
              </Animated.View>
            ))
          )}

          <Pressy
            style={styles.addBtn}
            scaleTo={0.97}
            onPress={() => {
              haptics.selection();
              // Mounting the native time spinner is heavy — let the press
              // animation finish first so the button doesn't stutter.
              setTimeout(() => setShowTimePicker(true), 120);
            }}
          >
            <Ionicons name="add" size={18} color={theme.colors.purpleSoft} />
            <Text style={[styles.addBtnText, { fontFamily: font(lang, 'bold') }]}>
              {t('settings.addReminder')}
            </Text>
          </Pressy>

          {showTimePicker ? (
            <Animated.View
              entering={FadeInDown.duration(380).springify().damping(20).stiffness(90)}
              exiting={FadeOut.duration(180)}
              layout={layoutT()}
              style={styles.pickerWrap}
            >
              <DateTimePicker
                value={Platform.OS === 'ios' ? pendingTime : new Date(2024, 0, 1, 20, 0)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="dark"
                onChange={onTimePicked}
              />
              {Platform.OS === 'ios' ? (
                <View style={styles.pickerActions}>
                  <Pressy style={styles.pickerCancel} onPress={() => setShowTimePicker(false)}>
                    <Text style={[styles.pickerCancelText, { fontFamily: font(lang, 'semibold') }]}>
                      {t('history.cancel')}
                    </Text>
                  </Pressy>
                  <Pressy style={styles.pickerApply} scaleTo={0.94} onPress={confirmPendingTime}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={[styles.pickerApplyText, { fontFamily: font(lang, 'bold') }]}>
                      {t('range.apply')}
                    </Text>
                  </Pressy>
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>

        {/* Language */}
        <Text style={[styles.sectionTitle, { fontFamily: font(lang, 'bold') }]}>
          {t('settings.language')}
        </Text>
        <View style={styles.langRow}>
          <Pressy
            style={[styles.langChip, lang === 'en' && styles.langChipActive]}
            scaleTo={0.96}
            onPress={() => switchLanguage('en')}
          >
            <Text
              style={[
                styles.langText,
                { fontFamily: theme.fonts.bold },
                lang === 'en' && styles.langTextActive,
              ]}
            >
              {t('settings.english')}
            </Text>
          </Pressy>
          <Pressy
            style={[styles.langChip, lang === 'ar' && styles.langChipActive]}
            scaleTo={0.96}
            onPress={() => switchLanguage('ar')}
          >
            <Text
              style={[
                styles.langText,
                { fontFamily: theme.fonts.arBold },
                lang === 'ar' && styles.langTextActive,
              ]}
            >
              {t('settings.arabic')}
            </Text>
          </Pressy>
        </View>

        {/* Haptics */}
        <Text style={[styles.sectionTitle, { fontFamily: font(lang, 'bold') }]}>
          {t('settings.haptics')}
        </Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="radio-outline" size={24} color={theme.colors.accent} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { fontFamily: font(lang, 'bold') }]}>
                {t('settings.hapticsTitle')}
              </Text>
              <Text style={[styles.rowDesc, { fontFamily: font(lang, 'regular') }]}>
                {t('settings.hapticsDesc')}
              </Text>
            </View>
            <Switch
              value={hapticsOn}
              onValueChange={toggleHaptics}
              trackColor={{ true: theme.colors.purple, false: theme.colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Data */}
        <Text style={[styles.sectionTitle, { fontFamily: font(lang, 'bold') }]}>
          {t('settings.data')}
        </Text>
        <Pressy style={styles.card} scaleTo={0.98} onPress={onExport} disabled={busy}>
          <View style={styles.row}>
            <Ionicons name="share-outline" size={24} color={theme.colors.accent} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { fontFamily: font(lang, 'bold') }]}>
                {t('settings.export')}
              </Text>
              <Text style={[styles.rowDesc, { fontFamily: font(lang, 'regular') }]}>
                {t('settings.exportDesc')}
              </Text>
            </View>
          </View>
        </Pressy>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="cloud-upload-outline" size={24} color={theme.colors.accent} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { fontFamily: font(lang, 'bold') }]}>
                {t('settings.autoBackup')}
              </Text>
              <Text style={[styles.rowDesc, { fontFamily: font(lang, 'regular') }]}>
                {lastBackup != null
                  ? t('settings.autoBackupLast', {
                      date: new Date(lastBackup).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })
                  : t('settings.autoBackupDesc')}
              </Text>
            </View>
            <Switch
              value={backupOn}
              onValueChange={toggleBackup}
              trackColor={{ true: theme.colors.purple, false: theme.colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        <Pressy style={styles.card} scaleTo={0.98} onPress={onImport} disabled={busy}>
          <View style={styles.row}>
            <Ionicons name="download-outline" size={24} color={theme.colors.accent} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { fontFamily: font(lang, 'bold') }]}>
                {t('settings.import')}
              </Text>
              <Text style={[styles.rowDesc, { fontFamily: font(lang, 'regular') }]}>
                {t('settings.importDesc')}
              </Text>
            </View>
          </View>
        </Pressy>

        <Text style={[styles.about, { fontFamily: font(lang, 'regular') }]}>
          {t('settings.about')}
        </Text>
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
    marginBottom: theme.spacing.sm,
    textAlign: 'left',
  },
  sectionTitle: {
    fontSize: 16,
    color: theme.colors.ink,
    marginTop: theme.spacing.lg,
    marginBottom: 2,
    textAlign: 'left',
  },
  sectionDesc: {
    fontSize: 12,
    color: theme.colors.inkFaint,
    marginBottom: theme.spacing.sm,
    textAlign: 'left',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm + 4,
    marginTop: theme.spacing.sm,
  },
  noReminders: {
    fontSize: 13,
    color: theme.colors.inkFaint,
    textAlign: 'center',
    paddingVertical: theme.spacing.sm,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  reminderRowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  reminderTime: {
    flex: 1,
    fontSize: 17,
    color: theme.colors.ink,
    fontVariant: ['tabular-nums'],
    textAlign: 'left',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingVertical: 11,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderBright,
  },
  addBtnText: {
    fontSize: 14,
    color: theme.colors.purpleSoft,
  },
  pickerWrap: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },
  pickerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  pickerCancel: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  pickerCancelText: {
    fontSize: 13,
    color: theme.colors.inkSoft,
  },
  pickerApply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
  },
  pickerApplyText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    color: theme.colors.ink,
    textAlign: 'left',
  },
  rowDesc: {
    fontSize: 13,
    color: theme.colors.inkSoft,
    marginTop: 2,
    textAlign: 'left',
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: theme.spacing.sm,
  },
  langChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  langChipActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: theme.colors.purple,
  },
  langText: {
    fontSize: 15,
    color: theme.colors.inkSoft,
  },
  langTextActive: {
    color: theme.colors.purpleSoft,
  },
  about: {
    marginTop: theme.spacing.xl,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.inkFaint,
    textAlign: 'center',
  },
});
