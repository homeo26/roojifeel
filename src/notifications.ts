/**
 * Daily "What are you feeling right now?" reminder via local notifications.
 * Everything is on-device; no push server involved.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const REMINDER_ENABLED_KEY = 'roojifeel.reminder.enabled';
export const REMINDER_HOUR_KEY = 'roojifeel.reminder.hour';
export const REMINDER_MINUTE_KEY = 'roojifeel.reminder.minute';

export const DEFAULT_REMINDER_HOUR = 20;
export const DEFAULT_REMINDER_MINUTE = 0;

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

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  title: string,
  body: string,
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === 'android' ? 'reminders' : undefined,
    },
  });
}

export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export interface ReminderPrefs {
  enabled: boolean;
  hour: number;
  minute: number;
}

export async function loadReminderPrefs(): Promise<ReminderPrefs> {
  const [enabled, hour, minute] = await Promise.all([
    AsyncStorage.getItem(REMINDER_ENABLED_KEY),
    AsyncStorage.getItem(REMINDER_HOUR_KEY),
    AsyncStorage.getItem(REMINDER_MINUTE_KEY),
  ]);
  return {
    enabled: enabled === 'true',
    hour: hour != null ? Number(hour) : DEFAULT_REMINDER_HOUR,
    minute: minute != null ? Number(minute) : DEFAULT_REMINDER_MINUTE,
  };
}

export async function saveReminderPrefs(prefs: ReminderPrefs): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(REMINDER_ENABLED_KEY, String(prefs.enabled)),
    AsyncStorage.setItem(REMINDER_HOUR_KEY, String(prefs.hour)),
    AsyncStorage.setItem(REMINDER_MINUTE_KEY, String(prefs.minute)),
  ]);
}
