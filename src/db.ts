/**
 * Roojifeel local storage — SQLite on device. No data ever leaves the phone.
 *
 * Schema v2:
 *   entries(id, note, created_at, edited, intensity, photo_uri, audio_uri)
 *   entry_feelings(id, entry_id, core_id, secondary_id, tertiary_id, position)
 *   entry_tags(entry_id, tag)
 *
 * v1 databases (core/secondary/tertiary columns on entries) migrate
 * automatically on first open.
 */
import * as SQLite from 'expo-sqlite';

export interface FeelingPath {
  coreId: string;
  secondaryId: string;
  tertiaryId: string;
}

export interface FeelingEntry {
  id: number;
  /** One or more feelings, in the order they were picked. */
  feelings: FeelingPath[];
  note: string | null;
  /** 1..5 — how strongly it was felt. Null for pre-v2 entries. */
  intensity: number | null;
  tags: string[];
  photoUri: string | null;
  audioUri: string | null;
  /** Epoch milliseconds of when the feeling was logged. */
  createdAt: number;
  /** True when the entry was modified after creation. */
  edited: boolean;
}

export type NewFeelingEntry = Omit<FeelingEntry, 'id' | 'edited'>;

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('roojifeel.db');
    db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    migrate(db);
  }
  return db;
}

function migrate(database: SQLite.SQLiteDatabase): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note TEXT,
      created_at INTEGER NOT NULL,
      edited INTEGER NOT NULL DEFAULT 0,
      intensity INTEGER,
      photo_uri TEXT,
      audio_uri TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries (created_at);
    CREATE TABLE IF NOT EXISTS entry_feelings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      core_id TEXT NOT NULL,
      secondary_id TEXT NOT NULL,
      tertiary_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_entry_feelings_entry ON entry_feelings (entry_id);
    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (entry_id, tag)
    );
  `);

  // v1 → v2: entries used to carry core_id/secondary_id/tertiary_id directly.
  const cols = database.getAllSync<{ name: string }>('PRAGMA table_info(entries)');
  const names = cols.map((c) => c.name);
  const isV1 = names.includes('core_id');
  if (!names.includes('intensity')) {
    database.execSync('ALTER TABLE entries ADD COLUMN intensity INTEGER');
  }
  if (!names.includes('photo_uri')) {
    database.execSync('ALTER TABLE entries ADD COLUMN photo_uri TEXT');
  }
  if (!names.includes('audio_uri')) {
    database.execSync('ALTER TABLE entries ADD COLUMN audio_uri TEXT');
  }
  if (!names.includes('edited')) {
    database.execSync('ALTER TABLE entries ADD COLUMN edited INTEGER NOT NULL DEFAULT 0');
  }
  if (isV1) {
    database.execSync(`
      INSERT INTO entry_feelings (entry_id, core_id, secondary_id, tertiary_id, position)
      SELECT id, core_id, secondary_id, tertiary_id, 0 FROM entries
      WHERE id NOT IN (SELECT DISTINCT entry_id FROM entry_feelings);
    `);
    // SQLite can drop columns from 3.35; expo-sqlite ships a recent build.
    database.execSync(`
      ALTER TABLE entries DROP COLUMN core_id;
      ALTER TABLE entries DROP COLUMN secondary_id;
      ALTER TABLE entries DROP COLUMN tertiary_id;
    `);
  }
}

interface EntryRow {
  id: number;
  note: string | null;
  created_at: number;
  edited: number;
  intensity: number | null;
  photo_uri: string | null;
  audio_uri: string | null;
}

interface FeelingRow {
  entry_id: number;
  core_id: string;
  secondary_id: string;
  tertiary_id: string;
  position: number;
}

interface TagRow {
  entry_id: number;
  tag: string;
}

async function hydrate(rows: EntryRow[]): Promise<FeelingEntry[]> {
  if (rows.length === 0) return [];
  const database = getDb();
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const feelingRows = await database.getAllAsync<FeelingRow>(
    `SELECT * FROM entry_feelings WHERE entry_id IN (${placeholders}) ORDER BY position ASC`,
    ...ids,
  );
  const tagRows = await database.getAllAsync<TagRow>(
    `SELECT * FROM entry_tags WHERE entry_id IN (${placeholders}) ORDER BY tag ASC`,
    ...ids,
  );
  const feelingsByEntry = new Map<number, FeelingPath[]>();
  for (const f of feelingRows) {
    const list = feelingsByEntry.get(f.entry_id) ?? [];
    list.push({ coreId: f.core_id, secondaryId: f.secondary_id, tertiaryId: f.tertiary_id });
    feelingsByEntry.set(f.entry_id, list);
  }
  const tagsByEntry = new Map<number, string[]>();
  for (const t of tagRows) {
    const list = tagsByEntry.get(t.entry_id) ?? [];
    list.push(t.tag);
    tagsByEntry.set(t.entry_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    feelings: feelingsByEntry.get(r.id) ?? [],
    note: r.note,
    intensity: r.intensity,
    tags: tagsByEntry.get(r.id) ?? [],
    photoUri: r.photo_uri,
    audioUri: r.audio_uri,
    createdAt: r.created_at,
    edited: r.edited === 1,
  }));
}

async function writeFeelingsAndTags(
  entryId: number,
  feelings: FeelingPath[],
  tags: string[],
): Promise<void> {
  const database = getDb();
  await database.runAsync('DELETE FROM entry_feelings WHERE entry_id = ?', entryId);
  await database.runAsync('DELETE FROM entry_tags WHERE entry_id = ?', entryId);
  for (let i = 0; i < feelings.length; i++) {
    const f = feelings[i];
    await database.runAsync(
      'INSERT INTO entry_feelings (entry_id, core_id, secondary_id, tertiary_id, position) VALUES (?, ?, ?, ?, ?)',
      entryId,
      f.coreId,
      f.secondaryId,
      f.tertiaryId,
      i,
    );
  }
  for (const tag of tags) {
    await database.runAsync(
      'INSERT OR IGNORE INTO entry_tags (entry_id, tag) VALUES (?, ?)',
      entryId,
      tag,
    );
  }
}

/** Insert a new feeling entry; returns the created row id. */
export async function addEntry(entry: NewFeelingEntry): Promise<number> {
  const database = getDb();
  const result = await database.runAsync(
    'INSERT INTO entries (note, created_at, intensity, photo_uri, audio_uri) VALUES (?, ?, ?, ?, ?)',
    entry.note,
    entry.createdAt,
    entry.intensity,
    entry.photoUri,
    entry.audioUri,
  );
  const id = result.lastInsertRowId;
  await writeFeelingsAndTags(id, entry.feelings, entry.tags);
  return id;
}

/** Update an existing entry, marking it as edited. createdAt is preserved. */
export async function updateEntry(
  id: number,
  changes: Omit<NewFeelingEntry, 'createdAt'>,
): Promise<void> {
  await getDb().runAsync(
    'UPDATE entries SET note = ?, intensity = ?, photo_uri = ?, audio_uri = ?, edited = 1 WHERE id = ?',
    changes.note,
    changes.intensity,
    changes.photoUri,
    changes.audioUri,
    id,
  );
  await writeFeelingsAndTags(id, changes.feelings, changes.tags);
}

/** All entries, newest first. */
export async function getAllEntries(): Promise<FeelingEntry[]> {
  const rows = await getDb().getAllAsync<EntryRow>(
    'SELECT * FROM entries ORDER BY created_at DESC',
  );
  return hydrate(rows);
}

/** Entries within [fromMs, toMs], newest first. */
export async function getEntriesBetween(fromMs: number, toMs: number): Promise<FeelingEntry[]> {
  const rows = await getDb().getAllAsync<EntryRow>(
    'SELECT * FROM entries WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC',
    fromMs,
    toMs,
  );
  return hydrate(rows);
}

/** Fetch a single entry by id. */
export async function getEntry(id: number): Promise<FeelingEntry | null> {
  const row = await getDb().getFirstAsync<EntryRow>('SELECT * FROM entries WHERE id = ?', id);
  if (!row) return null;
  const [entry] = await hydrate([row]);
  return entry ?? null;
}

export async function deleteEntry(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM entries WHERE id = ?', id);
}

/** All distinct tags ever used, most frequent first (for suggestions). */
export async function getAllTags(): Promise<string[]> {
  const rows = await getDb().getAllAsync<{ tag: string }>(
    'SELECT tag, COUNT(*) AS c FROM entry_tags GROUP BY tag ORDER BY c DESC, tag ASC',
  );
  return rows.map((r) => r.tag);
}

/**
 * Bulk import entries (from a JSON export). Skips duplicates
 * (same first feeling + same timestamp) to make re-imports idempotent.
 * Returns the number of entries actually inserted.
 */
export async function importEntries(entries: NewFeelingEntry[]): Promise<number> {
  let inserted = 0;
  for (const e of entries) {
    if (e.feelings.length === 0) continue;
    const first = e.feelings[0];
    const dup = await getDb().getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM entries e
       JOIN entry_feelings f ON f.entry_id = e.id AND f.position = 0
       WHERE f.core_id = ? AND f.secondary_id = ? AND f.tertiary_id = ? AND e.created_at = ?`,
      first.coreId,
      first.secondaryId,
      first.tertiaryId,
      e.createdAt,
    );
    if (dup && dup.c > 0) continue;
    await addEntry(e);
    inserted += 1;
  }
  return inserted;
}
