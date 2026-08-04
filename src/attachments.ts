/**
 * Attachment storage — copies picked photos and recorded voice memos from
 * temporary locations into the app's document directory so they survive
 * cache cleanup. Files live in <documents>/attachments/.
 */
import { Directory, File, Paths } from 'expo-file-system';

function attachmentsDir(): Directory {
  const dir = new Directory(Paths.document, 'attachments');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Copy a temporary file into permanent attachment storage; returns new URI. */
export function persistAttachment(tempUri: string, kind: 'photo' | 'audio'): string {
  const ext = tempUri.split('.').pop()?.split('?')[0] ?? (kind === 'photo' ? 'jpg' : 'm4a');
  const name = `${kind}-${Date.now()}.${ext}`;
  const src = new File(tempUri);
  const dest = new File(attachmentsDir(), name);
  src.copy(dest);
  return dest.uri;
}

/** Delete an attachment file if it exists (best-effort). */
export function deleteAttachment(uri: string | null): void {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Best-effort cleanup; an orphaned file is harmless.
  }
}

/** True if the URI already lives in permanent attachment storage. */
export function isPersisted(uri: string): boolean {
  return uri.includes('/attachments/');
}
