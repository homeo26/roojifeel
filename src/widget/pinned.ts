/**
 * Pinned memory — one cherished entry pinned to a home-screen widget.
 * The display data is snapshotted (both languages) at pin time so the
 * widget task handlers can render headlessly without the app runtime.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeelingEntry } from '../db';
import { getCore, getTertiary, label } from '../data/feelings';

const PINNED_KEY = 'roojifeel.widget.pinned';

export interface PinnedMemory {
  entryId: number;
  emoji: string;
  feelingEn: string;
  feelingAr: string;
  note: string | null;
  intensity: number | null;
  dateEn: string;
  dateAr: string;
  lang: string;
}

function dateLabel(ms: number, locale: string): string {
  const d = new Date(ms);
  return (
    d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · ' +
    d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  );
}

export function buildPinnedMemory(entry: FeelingEntry, lang: string): PinnedMemory {
  const primary = entry.feelings[0];
  const core = primary ? getCore(primary.coreId) : undefined;
  const tertEn = primary
    ? label(getTertiary(primary.coreId, primary.secondaryId, primary.tertiaryId), 'en')
    : '';
  const tertAr = primary
    ? label(getTertiary(primary.coreId, primary.secondaryId, primary.tertiaryId), 'ar')
    : '';
  return {
    entryId: entry.id,
    emoji: core?.emoji ?? '💜',
    feelingEn: tertEn || (core?.en ?? ''),
    feelingAr: tertAr || (core?.ar ?? ''),
    note: entry.note,
    intensity: entry.intensity,
    dateEn: dateLabel(entry.createdAt, 'en-GB'),
    dateAr: dateLabel(entry.createdAt, 'ar'),
    lang,
  };
}

export async function getPinnedMemory(): Promise<PinnedMemory | null> {
  try {
    const raw = await AsyncStorage.getItem(PINNED_KEY);
    return raw ? (JSON.parse(raw) as PinnedMemory) : null;
  } catch {
    return null;
  }
}

export async function setPinnedMemory(memory: PinnedMemory | null): Promise<void> {
  if (memory) await AsyncStorage.setItem(PINNED_KEY, JSON.stringify(memory));
  else await AsyncStorage.removeItem(PINNED_KEY);
}
