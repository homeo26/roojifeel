/**
 * Theme boot — reads the persisted theme mode SYNCHRONOUSLY (file-based)
 * and applies it before any screen module creates its StyleSheets.
 * Called from index.js ahead of expo-router/entry.
 */
import { File, Paths } from 'expo-file-system';
import { ThemeMode, initTheme } from './theme';

const MODES: ThemeMode[] = ['dark', 'light', 'system'];

function prefFile(): File {
  return new File(Paths.document, 'theme-mode.txt');
}

export function getThemeMode(): ThemeMode {
  try {
    const f = prefFile();
    if (f.exists) {
      const raw = f.textSync().trim() as ThemeMode;
      if (MODES.includes(raw)) return raw;
    }
  } catch {
    // fall through to default
  }
  return 'dark';
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    const f = prefFile();
    if (f.exists) f.delete();
    f.write(mode);
  } catch {
    // best effort
  }
}

/** Apply the persisted mode. Safe to call exactly once at JS boot. */
export function bootTheme(): void {
  try {
    initTheme(getThemeMode());
  } catch {
    initTheme('dark');
  }
}
