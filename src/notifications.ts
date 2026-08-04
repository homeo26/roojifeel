/**
 * Daily "What are you feeling right now?" reminders via local notifications.
 * Supports MULTIPLE reminders per day, each at an exact hour:minute.
 * Everything is on-device; no push server involved.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REMINDERS_KEY = 'roojifeel.reminders.v2';

export interface ReminderTime {
  hour: number;
  minute: number;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Daily reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

/** Persist the reminder list and re-sync the smart schedule. */
export async function applyReminders(
  reminders: ReminderTime[],
  title: string,
  body: string,
): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  await syncSmartReminders({ title, body });
}

export interface ReminderStrings {
  title: string;
  body: string;
  nudgeTitle?: string;
  nudgeBody?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Smart scheduling — recomputed on every app open and after every save:
 *  • For each reminder time, schedule concrete date triggers for the next
 *    7 days, SKIPPING the remaining reminders today if a feeling was
 *    already logged today ("don't nag me, I already checked in").
 *  • If the user has logged before, schedule a gentle nudge 3 days after
 *    the most recent entry (re-anchored on every new entry).
 */
export async function syncSmartReminders(strings: ReminderStrings): Promise<void> {
  const reminders = await loadReminders();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (reminders.length === 0 && !strings.nudgeTitle) return;

  // Lazy import to avoid a require cycle (db never imports notifications).
  const { getEntriesBetween, getAllEntries } = await import('./db');

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const loggedToday =
    (await getEntriesBetween(startOfToday, startOfToday + DAY_MS - 1)).length > 0;

  const channelId = Platform.OS === 'android' ? 'reminders' : undefined;

  for (const r of reminders) {
    for (let day = 0; day < 7; day++) {
      const fireAt = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + day,
        r.hour,
        r.minute,
        0,
      );
      if (fireAt.getTime() <= Date.now()) continue; // already past
      if (day === 0 && loggedToday) continue; // smart skip
      await Notifications.scheduleNotificationAsync({
        content: { title: strings.title, body: strings.body, sound: false },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId,
        },
      });
    }
  }

  // Inactivity nudge.
  if (strings.nudgeTitle && strings.nudgeBody) {
    const all = await getAllEntries();
    if (all.length > 0) {
      const last = all[0].createdAt; // newest first
      let nudgeAt = last + 3 * DAY_MS;
      if (nudgeAt <= Date.now()) nudgeAt = Date.now() + 4 * 60 * 60 * 1000; // already overdue → later today
      await Notifications.scheduleNotificationAsync({
        content: { title: strings.nudgeTitle, body: strings.nudgeBody, sound: false },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(nudgeAt),
          channelId,
        },
      });
    }
  }
}

export async function loadReminders(): Promise<ReminderTime[]> {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ReminderTime =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as ReminderTime).hour === 'number' &&
        typeof (r as ReminderTime).minute === 'number',
    );
  } catch {
    return [];
  }
}

/** Sort chronologically and drop duplicates. */
export function normalizeReminders(reminders: ReminderTime[]): ReminderTime[] {
  const seen = new Set<string>();
  return [...reminders]
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
    .filter((r) => {
      const key = `${r.hour}:${r.minute}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
