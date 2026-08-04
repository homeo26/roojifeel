/**
 * Export / import the feelings journal as a JSON file.
 * Format v2 carries multi-feelings, intensity, and tags. v1 exports
 * (single feeling per entry) import transparently. Photo/voice
 * attachments are device-local files and are not embedded in exports.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { FeelingEntry, FeelingPath, NewFeelingEntry, getAllEntries, importEntries } from './db';
import { getCore, getSecondary, getTertiary } from './data/feelings';

const EXPORT_VERSION = 2;

interface ExportFeelingV2 {
  core: string;
  secondary: string;
  tertiary: string;
}

interface ExportEntryV2 {
  feelings: ExportFeelingV2[];
  note: string | null;
  intensity: number | null;
  tags: string[];
  createdAt: number;
}

interface ExportEntryV1 {
  core: string;
  secondary: string;
  tertiary: string;
  note: string | null;
  createdAt: number;
}

interface ExportFile {
  app: 'roojifeel';
  version: number;
  exportedAt: string;
  entries: Array<ExportEntryV2 | ExportEntryV1>;
}

/** Build the export payload from all entries (also used by auto-backup). */
export async function buildExportPayload(): Promise<{ json: string; count: number }> {
  const entries: FeelingEntry[] = await getAllEntries();
  const payload: ExportFile = {
    app: 'roojifeel',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    entries: entries.map((e) => ({
      feelings: e.feelings.map((f) => ({
        core: f.coreId,
        secondary: f.secondaryId,
        tertiary: f.tertiaryId,
      })),
      note: e.note,
      intensity: e.intensity,
      tags: e.tags,
      createdAt: e.createdAt,
    })),
  };
  return { json: JSON.stringify(payload, null, 2), count: entries.length };
}

/** Serialize all entries and open the platform share sheet. Returns entry count. */
export async function exportHistory(): Promise<number> {
  const { json, count } = await buildExportPayload();
  if (count === 0) return 0;

  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `roojifeel-export-${stamp}.json`);
  if (file.exists) file.delete();
  file.write(json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Roojifeel export',
    });
  }
  return count;
}

function validPath(core: string, secondary: string, tertiary: string): boolean {
  return (
    !!getCore(core) &&
    !!getSecondary(core, secondary) &&
    !!getTertiary(core, secondary, tertiary)
  );
}

/** Parse any supported export format into importable entries. */
export function parseExport(text: string): NewFeelingEntry[] {
  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as ExportFile).app !== 'roojifeel' ||
    !Array.isArray((parsed as ExportFile).entries)
  ) {
    throw new Error('invalid-format');
  }

  const valid: NewFeelingEntry[] = [];
  for (const raw of (parsed as ExportFile).entries) {
    if (typeof (raw as ExportEntryV2 | ExportEntryV1).createdAt !== 'number') continue;

    let feelings: FeelingPath[] = [];
    if (Array.isArray((raw as ExportEntryV2).feelings)) {
      // v2
      feelings = (raw as ExportEntryV2).feelings
        .filter(
          (f) =>
            typeof f.core === 'string' &&
            typeof f.secondary === 'string' &&
            typeof f.tertiary === 'string' &&
            validPath(f.core, f.secondary, f.tertiary),
        )
        .map((f) => ({ coreId: f.core, secondaryId: f.secondary, tertiaryId: f.tertiary }));
    } else if (typeof (raw as ExportEntryV1).core === 'string') {
      // v1
      const v1 = raw as ExportEntryV1;
      if (validPath(v1.core, v1.secondary, v1.tertiary)) {
        feelings = [{ coreId: v1.core, secondaryId: v1.secondary, tertiaryId: v1.tertiary }];
      }
    }
    if (feelings.length === 0) continue;

    const v2 = raw as ExportEntryV2;
    valid.push({
      feelings,
      note: typeof v2.note === 'string' ? v2.note : null,
      intensity:
        typeof v2.intensity === 'number' && v2.intensity >= 1 && v2.intensity <= 5
          ? v2.intensity
          : null,
      tags: Array.isArray(v2.tags) ? v2.tags.filter((t) => typeof t === 'string') : [],
      photoUri: null,
      audioUri: null,
      createdAt: v2.createdAt,
    });
  }
  return valid;
}

/**
 * Let the user pick a JSON export and merge it into the local journal.
 * Returns the number of newly imported entries, or null if the user cancelled.
 * Throws if the file is not a valid Roojifeel export.
 */
export async function importHistory(): Promise<number | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || picked.assets.length === 0) return null;

  const file = new File(picked.assets[0].uri);
  const text = file.textSync();
  return importEntries(parseExport(text));
}
