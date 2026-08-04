/**
 * Haptics wrapper — every vibration in the app goes through here so the
 * user can turn haptic feedback off. Preference persists across launches;
 * enabled by default. The flag is cached in memory so call sites stay sync.
 */
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAPTICS_KEY = 'roojifeel.haptics.enabled';

let enabled = true;

/** Load the persisted preference — call once at app start. */
export async function loadHapticsPref(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(HAPTICS_KEY);
    enabled = raw !== 'false';
  } catch {
    enabled = true;
  }
  return enabled;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

export async function setHapticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  await AsyncStorage.setItem(HAPTICS_KEY, String(value));
}

export function selection(): void {
  if (enabled) Haptics.selectionAsync();
}

export function impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium): void {
  if (enabled) Haptics.impactAsync(style);
}

export function success(): void {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
