/**
 * Share feelings as neatly formatted text through the native share sheet
 * (Messages, WhatsApp, mail — anywhere text goes).
 *
 * Single entry:
 *   😊 Happy › Proud › Successful
 *   Wednesday, 5 August · 16:45
 *   Intensity: ●●●●○
 *   “Finished the project milestone!”
 *   #work #coding
 *
 *   — Roojifeel, my feelings journal
 *
 * Multiple entries get a count header and compact blocks per entry.
 */
import { Share } from 'react-native';
import type { TFunction } from 'i18next';
import { FeelingEntry } from './db';
import { getCore, getSecondary, getTertiary, label } from './data/feelings';

function intensityDots(intensity: number): string {
  return '●'.repeat(intensity) + '○'.repeat(5 - intensity);
}

function feelingLines(entry: FeelingEntry, lang: string): string[] {
  return entry.feelings.map((f) => {
    const core = getCore(f.coreId);
    const sec = getSecondary(f.coreId, f.secondaryId);
    const tert = getTertiary(f.coreId, f.secondaryId, f.tertiaryId);
    if (!core) return '';
    return `${core.emoji} ${label(core, lang)} › ${label(sec, lang)} › ${label(tert, lang)}`;
  });
}

function dateLine(ms: number, lang: string): string {
  const locale = lang === 'ar' ? 'ar' : 'en-GB';
  const date = new Date(ms).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const time = new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

/** Full template for a single entry. */
export function formatEntry(entry: FeelingEntry, lang: string, t: TFunction): string {
  const lines: string[] = [];
  lines.push(...feelingLines(entry, lang));
  lines.push(dateLine(entry.createdAt, lang));
  if (entry.intensity != null) {
    lines.push(`${t('share.intensity')}: ${intensityDots(entry.intensity)}`);
  }
  if (entry.note) {
    lines.push(`“${entry.note}”`);
  }
  if (entry.tags.length > 0) {
    lines.push(entry.tags.map((tag) => `#${tag}`).join(' '));
  }
  return lines.join('\n');
}

/** Compact block used inside a multi-entry share. */
function formatEntryCompact(entry: FeelingEntry, lang: string, t: TFunction): string {
  const lines: string[] = [];
  lines.push(`• ${dateLine(entry.createdAt, lang)}`);
  for (const fl of feelingLines(entry, lang)) lines.push(`  ${fl}`);
  if (entry.intensity != null) lines.push(`  ${intensityDots(entry.intensity)}`);
  if (entry.note) lines.push(`  “${entry.note}”`);
  if (entry.tags.length > 0) lines.push(`  ${entry.tags.map((tag) => `#${tag}`).join(' ')}`);
  return lines.join('\n');
}

/** Build the shareable message for one or many entries. */
export function buildShareText(entries: FeelingEntry[], lang: string, t: TFunction): string {
  if (entries.length === 0) return '';
  const footer = `— ${t('share.footer')}`;
  if (entries.length === 1) {
    return `${formatEntry(entries[0], lang, t)}\n\n${footer}`;
  }
  const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt);
  const header = t('share.header', { count: entries.length });
  const blocks = sorted.map((e) => formatEntryCompact(e, lang, t));
  return `${header}\n\n${blocks.join('\n\n')}\n\n${footer}`;
}

/** Open the native share sheet with the formatted text. */
export async function shareEntries(
  entries: FeelingEntry[],
  lang: string,
  t: TFunction,
): Promise<void> {
  const message = buildShareText(entries, lang, t);
  if (!message) return;
  await Share.share({ message });
}
