/**
 * Roojifeel local storage — SQLite on device. No data ever leaves the phone.
 */
import * as SQLite from 'expo-sqlite';

export interface FeelingEntry {
  id: number;
  coreId: string;
  secondaryId: string;
  tertiaryId: string;
  note: string | null;
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
    db.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        core_id TEXT NOT NULL,
        secondary_id TEXT NOT NULL,
        tertiary_id TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries (created_at);
    `);
    // Migration: add the edited flag to databases created before it existed.
    const cols = db.getAllSync<{ name: string }>('PRAGMA table_info(entries)');
    if (!cols.some((c) => c.name === 'edited')) {
      db.execSync('ALTER TABLE entries ADD COLUMN edited INTEGER NOT NULL DEFAULT 0');
    }
  }
  return db;
}

interface Row {
  id: number;
  core_id: string;
  secondary_id: string;
  tertiary_id: string;
  note: string | null;
  created_at: number;
  edited: number;
}

const rowToEntry = (r: Row): FeelingEntry => ({
  id: r.id,
  coreId: r.core_id,
  secondaryId: r.secondary_id,
  tertiaryId: r.tertiary_id,
  note: r.note,
  createdAt: r.created_at,
  edited: r.edited === 1,
});

/** Insert a new feeling entry; returns the created row id. */
export async function addEntry(entry: NewFeelingEntry): Promise<number> {
  const result = await getDb().runAsync(
    'INSERT INTO entries (core_id, secondary_id, tertiary_id, note, created_at) VALUES (?, ?, ?, ?, ?)',
    entry.coreId,
    entry.secondaryId,
    entry.tertiaryId,
    entry.note,
    entry.createdAt,
  );
  return result.lastInsertRowId;
}

/** All entries, newest first. */
export async function getAllEntries(): Promise<FeelingEntry[]> {
  const rows = await getDb().getAllAsync<Row>('SELECT * FROM entries ORDER BY created_at DESC');
  return rows.map(rowToEntry);
}

/** Entries within [fromMs, toMs], newest first. */
export async function getEntriesBetween(fromMs: number, toMs: number): Promise<FeelingEntry[]> {
  const rows = await getDb().getAllAsync<Row>(
    'SELECT * FROM entries WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC',
    fromMs,
    toMs,
  );
  return rows.map(rowToEntry);
}

export async function deleteEntry(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM entries WHERE id = ?', id);
}

/** Fetch a single entry by id. */
export async function getEntry(id: number): Promise<FeelingEntry | null> {
  const row = await getDb().getFirstAsync<Row>('SELECT * FROM entries WHERE id = ?', id);
  return row ? rowToEntry(row) : null;
}

/**
 * Update an existing entry's feeling path and note, marking it as edited.
 * The original createdAt timestamp is preserved.
 */
export async function updateEntry(
  id: number,
  changes: Pick<FeelingEntry, 'coreId' | 'secondaryId' | 'tertiaryId' | 'note'>,
): Promise<void> {
  await getDb().runAsync(
    'UPDATE entries SET core_id = ?, secondary_id = ?, tertiary_id = ?, note = ?, edited = 1 WHERE id = ?',
    changes.coreId,
    changes.secondaryId,
    changes.tertiaryId,
    changes.note,
    id,
  );
}

/**
 * Bulk import entries (from a JSON export). Skips exact duplicates
 * (same path + same minute) to make re-imports idempotent.
 * Returns the number of entries actually inserted.
 */
export async function importEntries(entries: NewFeelingEntry[]): Promise<number> {
  const database = getDb();
  let inserted = 0;
  await database.withTransactionAsync(async () => {
    for (const e of entries) {
      const dup = await database.getFirstAsync<{ c: number }>(
        'SELECT COUNT(*) AS c FROM entries WHERE core_id = ? AND secondary_id = ? AND tertiary_id = ? AND created_at = ?',
        e.coreId,
        e.secondaryId,
        e.tertiaryId,
        e.createdAt,
      );
      if (dup && dup.c > 0) continue;
      await database.runAsync(
        'INSERT INTO entries (core_id, secondary_id, tertiary_id, note, created_at) VALUES (?, ?, ?, ?, ?)',
        e.coreId,
        e.secondaryId,
        e.tertiaryId,
        e.note,
        e.createdAt,
      );
      inserted += 1;
    }
  });
  return inserted;
}
