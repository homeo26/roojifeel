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

/** Persist the reminder list and (re)schedule a daily notification per time. */
export async function applyReminders(
  reminders: ReminderTime[],
  title: string,
  body: string,
): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of reminders) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: r.hour,
        minute: r.minute,
        channelId: Platform.OS === 'android' ? 'reminders' : undefined,
      },
    });
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
