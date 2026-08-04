/**
 * Export / import the feelings journal as a JSON file.
 * Format is versioned so future schema changes can migrate old exports.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { FeelingEntry, NewFeelingEntry, getAllEntries, importEntries } from './db';
import { getCore, getSecondary, getTertiary } from './data/feelings';

const EXPORT_VERSION = 1;

interface ExportFile {
  app: 'roojifeel';
  version: number;
  exportedAt: string;
  entries: Array<{
    core: string;
    secondary: string;
    tertiary: string;
    note: string | null;
    createdAt: number;
  }>;
}

/** Serialize all entries and open the platform share sheet. Returns entry count. */
export async function exportHistory(): Promise<number> {
  const entries: FeelingEntry[] = await getAllEntries();
  if (entries.length === 0) return 0;

  const payload: ExportFile = {
    app: 'roojifeel',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    entries: entries.map((e) => ({
      core: e.coreId,
      secondary: e.secondaryId,
      tertiary: e.tertiaryId,
      note: e.note,
      createdAt: e.createdAt,
    })),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `roojifeel-export-${stamp}.json`);
  if (file.exists) file.delete();
  file.write(JSON.stringify(payload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Roojifeel export',
    });
  }
  return entries.length;
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
    if (
      typeof raw.core !== 'string' ||
      typeof raw.secondary !== 'string' ||
      typeof raw.tertiary !== 'string' ||
      typeof raw.createdAt !== 'number'
    ) {
      continue;
    }
    // Only accept feelings that exist in the wheel.
    if (!getCore(raw.core)) continue;
    if (!getSecondary(raw.core, raw.secondary)) continue;
    if (!getTertiary(raw.core, raw.secondary, raw.tertiary)) continue;
    valid.push({
      coreId: raw.core,
      secondaryId: raw.secondary,
      tertiaryId: raw.tertiary,
      note: typeof raw.note === 'string' ? raw.note : null,
      createdAt: raw.createdAt,
    });
  }
  return importEntries(valid);
}
