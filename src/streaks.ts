/**
 * Streaks & milestones — cozy, not aggressive. A milestone celebrates
 * once, ever, when first reached. State persists in AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeelingEntry } from './db';

const CELEBRATED_KEY = 'roojifeel.milestones.celebrated';
const DAY_MS = 24 * 60 * 60 * 1000;

export const MILESTONES = [3, 7, 14, 30, 60, 100, 365] as const;

/** Consecutive days (ending today or yesterday) with >= 1 check-in. */
export function computeStreak(entries: FeelingEntry[]): number {
  const days = new Set(
    entries.map((e) => {
      const d = new Date(e.createdAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let cursor = new Date();
  if (!days.has(key(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  let count = 0;
  while (days.has(key(cursor))) {
    count += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return count;
}

/** The next milestone ahead of the current streak, if any. */
export function nextMilestone(streak: number): number | null {
  return MILESTONES.find((m) => m > streak) ?? null;
}

/**
 * Returns a milestone number when the current streak has just reached one
 * that was never celebrated before — and marks it celebrated. Null otherwise.
 */
export async function claimMilestone(streak: number): Promise<number | null> {
  const reached = MILESTONES.filter((m) => m <= streak);
  if (reached.length === 0) return null;
  let celebrated: number[] = [];
  try {
    const raw = await AsyncStorage.getItem(CELEBRATED_KEY);
    if (raw) celebrated = JSON.parse(raw);
  } catch {
    celebrated = [];
  }
  const fresh = reached.filter((m) => !celebrated.includes(m));
  if (fresh.length === 0) return null;
  const milestone = Math.max(...fresh);
  await AsyncStorage.setItem(
    CELEBRATED_KEY,
    JSON.stringify([...celebrated, ...fresh]),
  );
  return milestone;
}
