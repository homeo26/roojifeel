/**
 * Onboarding — a 3-screen cozy intro shown once on first launch:
 *  1. The wheel: name what you feel, three rings deep
 *  2. The promise: everything stays on your device
 *  3. The habit: pick gentle daily reminder times (optional)
 */
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FEELINGS_WHEEL } from '../src/data/feelings';
import { ReminderTime, applyReminders, requestNotificationPermission } from '../src/notifications';
import { theme, font, displayFont } from '../src/theme';
import * as haptics from '../src/haptics';

export const ONBOARDED_KEY = 'roojifeel.onboarded';

const PRESET_TIMES: ReminderTime[] = [
  { hour: 9, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 20, minute: 0 },
];

const { width: SCREEN_W } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [times, setTimes] = useState<ReminderTime[]>([{ hour: 20, minute: 0 }]);
  const [finishing, setFinishing] = useState(false);

  const goTo = (index: number) => {
    haptics.selection();
    scrollRef.current?.scrollTo({ x: index * SCREEN_W, animated: true });
    setPage(index);
  };

  const toggleTime = (preset: ReminderTime) => {
    haptics.selection();
    setTimes((prev) => {
      const exists = prev.some((r) => r.hour === preset.hour && r.minute === preset.minute);
      return exists
        ? prev.filter((r) => !(r.hour === preset.hour && r.minute === preset.minute))
        : [...prev, preset];
    });
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    haptics.success();
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
    if (times.length > 0) {
      const granted = await requestNotificationPermission();
      if (granted) {
        await applyReminders(times, t('settings.notifTitle'), t('settings.notifBody'));
      }
    }
    router.back();
  };

  const fmt = (r: ReminderTime) =>
    `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`;

  return (
    <SafeAreaView
      style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{ width: SCREEN_W * 3 }}
      >
        {/* Page 1 — the wheel */}
        <View style={styles.page}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.pageBody}>
            <View style={styles.orbCluster}>
              {FEELINGS_WHEEL.map((c, i) => (
                <View
                  key={c.id}
                  style={[
                    styles.clusterOrb,
                    {
                      backgroundColor: c.tint,
                      borderColor: c.color,
                      shadowColor: c.color,
                      transform: [{ translateY: i % 2 === 0 ? 0 : 16 }],
                    },
                  ]}
                >
                  <Text style={styles.clusterEmoji}>{c.emoji}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.title, { fontFamily: displayFont(lang) }]}>
              {t('onboarding.title1')}
            </Text>
            <Text style={[styles.body, { fontFamily: font(lang, 'regular') }]}>
              {t('onboarding.body1')}
            </Text>
          </Animated.View>
        </View>

        {/* Page 2 — privacy */}
        <View style={styles.page}>
          <View style={styles.pageBody}>
            <View style={styles.lockCircle}>
              <Ionicons name="lock-closed" size={44} color={theme.colors.tealSoft} />
            </View>
            <Text style={[styles.title, { fontFamily: displayFont(lang) }]}>
              {t('onboarding.title2')}
            </Text>
            <Text style={[styles.body, { fontFamily: font(lang, 'regular') }]}>
              {t('onboarding.body2')}
            </Text>
          </View>
        </View>

        {/* Page 3 — reminders */}
        <View style={styles.page}>
          <View style={styles.pageBody}>
            <Text style={styles.bellEmoji}>🔔</Text>
            <Text style={[styles.title, { fontFamily: displayFont(lang) }]}>
              {t('onboarding.title3')}
            </Text>
            <Text style={[styles.body, { fontFamily: font(lang, 'regular') }]}>
              {t('onboarding.body3')}
            </Text>
            <View style={styles.timeRow}>
              {PRESET_TIMES.map((preset) => {
                const active = times.some(
                  (r) => r.hour === preset.hour && r.minute === preset.minute,
                );
                return (
                  <Pressable
                    key={preset.hour}
                    style={[styles.timeChip, active && styles.timeChipActive]}
                    onPress={() => toggleTime(preset)}
                  >
                    <Text
                      style={[
                        styles.timeText,
                        { fontFamily: font(lang, 'bold') },
                        active && styles.timeTextActive,
                      ]}
                    >
                      {fmt(preset)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.hint, { fontFamily: font(lang, 'regular') }]}>
              {t('onboarding.hint3')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer: dots + button */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          onPress={() => (page < 2 ? goTo(page + 1) : finish())}
          disabled={finishing}
        >
          {({ pressed }) => (
            <LinearGradient
              colors={theme.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.nextBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.nextText, { fontFamily: font(lang, 'bold') }]}>
                {page < 2 ? t('onboarding.next') : t('onboarding.start')}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color="#FFFFFF"
                style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
              />
            </LinearGradient>
          )}
        </Pressable>
        {page === 2 && times.length > 0 ? null : page === 2 ? (
          <Text style={[styles.skipNote, { fontFamily: font(lang, 'regular') }]}>
            {t('onboarding.noReminders')}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  page: {
    width: SCREEN_W,
    paddingHorizontal: theme.spacing.xl,
  },
  pageBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  orbCluster: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  clusterOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  clusterEmoji: {
    fontSize: 19,
  },
  lockCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(20, 184, 166, 0.10)',
    borderWidth: 1.5,
    borderColor: theme.colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  bellEmoji: {
    fontSize: 56,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 30,
    letterSpacing: -0.8,
    color: theme.colors.ink,
    textAlign: 'center',
    lineHeight: 36,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: theme.spacing.sm,
  },
  timeChip: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  timeChipActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: theme.colors.purple,
  },
  timeText: {
    fontSize: 15,
    color: theme.colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  timeTextActive: {
    color: theme.colors.purpleSoft,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.inkFaint,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    width: 22,
    backgroundColor: theme.colors.purpleSoft,
  },
  nextBtn: {
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...theme.shadow.glow,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  skipNote: {
    fontSize: 11,
    color: theme.colors.inkFaint,
    textAlign: 'center',
  },
});
