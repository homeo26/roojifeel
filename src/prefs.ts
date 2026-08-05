/**
 * Small user preferences (AsyncStorage-backed).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEEK_START_KEY = 'roojifeel.weekStart';
const DEFAULT_RANGE_KEY = 'roojifeel.defaultRangeDays';

export type WeekStart = 'mon' | 'sun';

export async function getWeekStart(): Promise<WeekStart> {
  const raw = await AsyncStorage.getItem(WEEK_START_KEY);
  return raw === 'sun' ? 'sun' : 'mon';
}

export async function setWeekStart(value: WeekStart): Promise<void> {
  await AsyncStorage.setItem(WEEK_START_KEY, value);
}

export async function getDefaultRangeDays(): Promise<number> {
  const raw = await AsyncStorage.getItem(DEFAULT_RANGE_KEY);
  const n = raw ? Number(raw) : 14;
  return [7, 14, 30].includes(n) ? n : 14;
}

export async function setDefaultRangeDays(days: number): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_RANGE_KEY, String(days));
}
