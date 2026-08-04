/**
 * Human-friendly timestamps for the journal.
 */
import type { TFunction } from 'i18next';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "just now", "12 min ago", "3 hours ago", else localized date. */
export function relativeTime(ms: number, t: TFunction, lang: string): string {
  const now = Date.now();
  const diff = now - ms;
  if (diff < MINUTE) return t('time.justNow');
  if (diff < HOUR) return t('time.minutesAgo', { count: Math.floor(diff / MINUTE) });
  const date = new Date(ms);
  const today = new Date();
  if (isSameDay(date, today) && diff < 12 * HOUR) {
    return t('time.hoursAgo', { count: Math.floor(diff / HOUR) });
  }
  return formatDayLabel(date, t, lang);
}

/** "Today", "Yesterday" or a localized date like "12 Mar 2026". */
export function formatDayLabel(date: Date, t: TFunction, lang: string): string {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * HOUR);
  if (isSameDay(date, today)) return t('time.today');
  if (isSameDay(date, yesterday)) return t('time.yesterday');
  return date.toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "18:42" style clock time. */
export function formatClock(ms: number, lang: string): string {
  return new Date(ms).toLocaleTimeString(lang === 'ar' ? 'ar' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
