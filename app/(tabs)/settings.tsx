/**
 * Settings — daily reminder, language (EN/AR with RTL), and data import/export.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { theme, font } from '../../src/theme';
import { saveLanguage } from '../../src/i18n';
import {
  cancelReminders,
  loadReminderPrefs,
  requestNotificationPermission,
  saveReminderPrefs,
  scheduleDailyReminder,
} from '../../src/notifications';
import { exportHistory, importHistory } from '../../src/exportImport';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadReminderPrefs().then((prefs) => {
      setReminderEnabled(prefs.enabled);
      setHour(prefs.hour);
      setMinute(prefs.minute);
    });
  }, []);

  const applyReminder = async (enabled: boolean, h: number, m: number) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(t('settings.permissionDenied'));
        setReminderEnabled(false);
        await saveReminderPrefs({ enabled: false, hour: h, minute: m });
        return;
      }
      await scheduleDailyReminder(h, m, t('settings.notifTitle'), t('settings.notifBody'));
    } else {
      await cancelReminders();
    }
    await saveReminderPrefs({ enabled, hour: h, minute: m });
  };

  const toggleReminder = async (value: boolean) => {
    Haptics.selectionAsync();
    setReminderEnabled(value);
    await applyReminder(value, hour, minute);
  };

  const shiftTime = async (deltaMinutes: number) => {
    Haptics.selectionAsync();
    let totalMinutes = hour * 60 + minute + deltaMinutes;
    totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    setHour(h);
    setMinute(m);
    if (reminderEnabled) {
      await applyReminder(true, h, m);
    } else {
      await saveReminderPrefs({ enabled: false, hour: h, minute: m });
    }
  };

  const switchLanguage = async (next: 'en' | 'ar') => {
    if (next === lang) return;
    Haptics.selectionAsync();
    await saveLanguage(next);
    await i18n.changeLanguage(next);
    // Layout direction is applied instantly via the per-screen `direction`
    // style; keep the native flag in sync for the next cold start.
    const wantRTL = next === 'ar';
    if (I18nManager.isRTL !== wantRTL) {
      I18nManager.allowRTL(wantRTL);
      I18nManager.forceRTL(wantRTL);
    }
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

  const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return (
    <SafeAreaView style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { fontFamily: font(lang, 'extrabold') }]}>
          {t('settings.title')}
        </Text>

        {/* Reminder */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { fontFamily: font(lang, 'bold') }]}>
                {t('settings.reminders')}
              </Text>
              <Text style={[styles.rowDesc, { fontFamily: font(lang, 'regular') }]}>
                {t('settings.remindersDesc')}
              </Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={toggleReminder}
              trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>

          {reminderEnabled ? (
            <View style={[styles.row, styles.timeRow]}>
              <Text style={[styles.rowTitle, { fontFamily: font(lang, 'semibold') }]}>
                {t('settings.reminderTime')}
              </Text>
              <View style={styles.timeControls}>
                <Pressable style={styles.timeBtn} onPress={() => shiftTime(-30)} hitSlop={8}>
                  <Ionicons name="remove" size={20} color={theme.colors.accent} />
                </Pressable>
                <Text style={[styles.timeText, { fontFamily: font(lang, 'extrabold') }]}>
                  {timeLabel}
                </Text>
                <Pressable style={styles.timeBtn} onPress={() => shiftTime(30)} hitSlop={8}>
                  <Ionicons name="add" size={20} color={theme.colors.accent} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {/* Language */}
        <Text style={[styles.sectionTitle, { fontFamily: font(lang, 'bold') }]}>
          {t('settings.language')}
        </Text>
        <View style={styles.langRow}>
          <Pressable
            style={[styles.langChip, lang === 'en' && styles.langChipActive]}
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
          </Pressable>
          <Pressable
            style={[styles.langChip, lang === 'ar' && styles.langChipActive]}
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
          </Pressable>
        </View>

        {/* Data */}
        <Text style={[styles.sectionTitle, { fontFamily: font(lang, 'bold') }]}>
          {t('settings.data')}
        </Text>
        <Pressable style={styles.card} onPress={onExport} disabled={busy}>
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
        </Pressable>
        <Pressable style={styles.card} onPress={onImport} disabled={busy}>
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
        </Pressable>

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
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    textAlign: 'left',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm + 4,
    ...theme.shadow.card,
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
  timeRow: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    justifyContent: 'space-between',
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surfaceHover,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 18,
    color: theme.colors.ink,
    minWidth: 64,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    color: theme.colors.ink,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm + 4,
    textAlign: 'left',
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
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
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  langText: {
    fontSize: 15,
    color: theme.colors.inkSoft,
  },
  langTextActive: {
    color: '#FFFFFF',
  },
  about: {
    marginTop: theme.spacing.xl,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.inkFaint,
    textAlign: 'center',
  },
});
