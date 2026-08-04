/**
 * Auto-backup — writes a rolling JSON backup of the journal to storage the
 * USER owns, with no server involved:
 *  • iOS: the app's Documents folder, exposed in the Files app (and included
 *    in the user's own iCloud device backup).
 *  • Android: a folder the user picks once via the Storage Access Framework
 *    (can live on Google Drive, SD card, etc.).
 * Runs opportunistically on app start, at most every 6 hours.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import { buildExportPayload } from './exportImport';

const ENABLED_KEY = 'roojifeel.backup.enabled';
const DIR_KEY = 'roojifeel.backup.android.dir';
const LAST_KEY = 'roojifeel.backup.last';
const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FILE_NAME = 'roojifeel-backup.json';

export interface BackupStatus {
  enabled: boolean;
  lastBackupAt: number | null;
  /** Android: the SAF directory chosen by the user (null = not chosen). */
  androidDirUri: string | null;
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const [enabled, last, dir] = await Promise.all([
    AsyncStorage.getItem(ENABLED_KEY),
    AsyncStorage.getItem(LAST_KEY),
    AsyncStorage.getItem(DIR_KEY),
  ]);
  return {
    enabled: enabled === 'true',
    lastBackupAt: last ? Number(last) : null,
    androidDirUri: dir,
  };
}

/**
 * Enable auto-backup. On Android this prompts the user to pick the backup
 * folder (once). Returns true when enabling succeeded.
 */
export async function enableBackup(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const perm = await LegacyFS.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return false;
    await AsyncStorage.setItem(DIR_KEY, perm.directoryUri);
  }
  await AsyncStorage.setItem(ENABLED_KEY, 'true');
  await runBackup(true);
  return true;
}

export async function disableBackup(): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, 'false');
}

/** Write the backup now. Returns true on success. */
export async function runBackup(force = false): Promise<boolean> {
  const status = await getBackupStatus();
  if (!status.enabled && !force) return false;
  if (
    !force &&
    status.lastBackupAt != null &&
    Date.now() - status.lastBackupAt < MIN_INTERVAL_MS
  ) {
    return false;
  }

  const { json, count } = await buildExportPayload();
  if (count === 0) return false;

  try {
    if (Platform.OS === 'android') {
      const dirUri = status.androidDirUri ?? (await AsyncStorage.getItem(DIR_KEY));
      if (!dirUri) return false;
      // Replace the previous rolling backup if present.
      const existing = await LegacyFS.StorageAccessFramework.readDirectoryAsync(dirUri);
      const prev = existing.find((uri) => decodeURIComponent(uri).endsWith(FILE_NAME));
      if (prev) {
        await LegacyFS.deleteAsync(prev, { idempotent: true });
      }
      const fileUri = await LegacyFS.StorageAccessFramework.createFileAsync(
        dirUri,
        FILE_NAME,
        'application/json',
      );
      await LegacyFS.writeAsStringAsync(fileUri, json);
    } else {
      // iOS: Documents/Backups — visible in the Files app.
      const dir = new Directory(Paths.document, 'Backups');
      if (!dir.exists) dir.create({ intermediates: true });
      const file = new File(dir, FILE_NAME);
      if (file.exists) file.delete();
      file.write(json);
    }
    await AsyncStorage.setItem(LAST_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}
