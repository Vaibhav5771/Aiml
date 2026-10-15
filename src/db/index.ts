/**
 * The data layer's native edge: SQLite rows and photo files on the device.
 *
 * Deliberately thin. Every decision about what a scan is, how it is written
 * and how it is read back lives in `map.ts` and `schema.ts`, which import
 * nothing native and are covered by `map.test.ts`. What is left here is the
 * part that can only be proved on a phone: opening the database, running the
 * migrations, copying a file, and five queries.
 *
 * Every expected failure is a returned value, never a throw, which is the
 * convention `AGENTS.md` sets and `proxy/api/` already follows.
 *
 * [Spec 0006](../../docs/specs/0006-saved-scan-data-model/index.md) is the
 * authority.
 */

import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import type {
  ScanLearnedFields,
  ScanSummary,
  StoredScan,
  Verdict,
  VisionRead,
} from '@/vision/types';

import {
  SCAN_COLUMNS,
  buildScan,
  fromRow,
  photoFileName,
  toRow,
  toSummary,
  type ScanRow,
  type SummaryRow,
} from './map';
import { DATABASE_NAME, MIGRATIONS, PHOTO_DIRECTORY, SUMMARY_COLUMNS } from './schema';
import { fail, isFailure, ok, type Result } from './types';

/**
 * What `saveScan` needs to write a scan.
 *
 * `sourcePhotoUri` is the downscaled JPEG that was already sent to the proxy,
 * not the camera's original. Feature 8 produces it, because SDK 57 made the
 * image manipulator a hook and a hook cannot be called from a plain async
 * function. This layer only copies what it is handed.
 */
export type SaveScanInput = {
  sourcePhotoUri: string;
  read: VisionRead;
  verdict: Verdict;
  learned: ScanLearnedFields;
  ruleSet: { readonly region: string; readonly version: string };
};

const INSERT_SQL = `INSERT INTO scan (${SCAN_COLUMNS.join(', ')}) VALUES (${SCAN_COLUMNS.map(
  () => '?',
).join(', ')})`;

/** Dev only. A storage failure is already a returned value; this is the detail behind it. */
function report(what: string, error: unknown): void {
  if (__DEV__) console.warn(`[db] ${what}`, error);
}

let opening: Promise<SQLite.SQLiteDatabase> | undefined;

/**
 * Bring the database up to the current shape.
 *
 * `PRAGMA user_version` is a plain integer SQLite keeps in the file header,
 * and stepping it through an ordered list is the pattern Expo's SDK 57 docs
 * show. A phone that already ran a migration is past that index and never runs
 * it again, which is why `MIGRATIONS` is append only.
 */
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = current?.user_version ?? 0;

  for (let index = version; index < MIGRATIONS.length; index += 1) {
    await db.execAsync(MIGRATIONS[index]);
    version = index + 1;
  }

  // A pragma cannot take a bound parameter, so this is interpolated. The value
  // is an array index, never anything a caller supplies.
  await db.execAsync(`PRAGMA user_version = ${version}`);
}

function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (opening === undefined) {
    opening = SQLite.openDatabaseAsync(DATABASE_NAME)
      .then(async (db) => {
        await migrate(db);
        return db;
      })
      .catch((error: unknown) => {
        // Forget the failure so the next call retries. Caching it would turn
        // one transient open error into history being dead for the session.
        opening = undefined;
        throw error;
      });
  }
  return opening;
}

/**
 * Run some work against the database, turning any unexpected throw into
 * `db_unavailable`.
 *
 * Expected failures (`scan_not_found` and friends) are returned by the work
 * itself and travel through untouched. Only something genuinely unforeseen
 * lands in the catch.
 *
 * The parameter is named `run` rather than `use` on purpose: `use` is a React
 * hook name, and the hooks lint rule reads any call to it as a hook call.
 */
async function withDb<T>(
  run: (db: SQLite.SQLiteDatabase) => Promise<Result<T>>,
): Promise<Result<T>> {
  let db: SQLite.SQLiteDatabase;
  try {
    db = await openDb();
  } catch (error) {
    report('could not open the database', error);
    return fail('db_unavailable');
  }

  try {
    return await run(db);
  } catch (error) {
    report('a query failed', error);
    return fail('db_unavailable');
  }
}

/** Where scan photos live. Does not have to exist yet. */
function photoDirectory(): Directory {
  return new Directory(Paths.document, PHOTO_DIRECTORY);
}

/**
 * Save a scan: the photo first, then the row.
 *
 * That order is the whole reliability story. A row can therefore never point
 * at a file that is not there, so features 11 and 12 may treat `photoUri` as
 * trustworthy. The failure mode it leaves behind is the harmless one, a file
 * with no row, which `sweepOrphanPhotos` collects at the next app start.
 */
export async function saveScan(input: SaveScanInput): Promise<Result<StoredScan>> {
  const id = Crypto.randomUUID();

  let destination: File;
  try {
    const directory = photoDirectory();
    // `idempotent` makes a second call a no-op instead of a throw, and
    // `intermediates` covers a fresh install where nothing exists yet.
    directory.create({ intermediates: true, idempotent: true });

    destination = new File(directory, photoFileName(id));
    await new File(input.sourcePhotoUri).copy(destination);
  } catch (error) {
    report('could not copy the photo into app storage', error);
    return fail('photo_copy_failed');
  }

  const scan = buildScan({
    id,
    scannedAt: Date.now(),
    photoUri: destination.uri,
    read: input.read,
    verdict: input.verdict,
    learned: input.learned,
    ruleSet: input.ruleSet,
  });

  const written = await withDb(async (db) => {
    const row = toRow(scan);
    // Both the column list and the values come from `SCAN_COLUMNS`, so the two
    // cannot fall out of order however many columns the table grows.
    await db.runAsync(
      INSERT_SQL,
      SCAN_COLUMNS.map((column) => row[column]),
    );
    return ok(scan);
  });

  if (isFailure(written)) {
    // The row did not land, so the copy must not outlive it (AC-13).
    try {
      destination.delete();
    } catch (error) {
      report('left an orphan photo behind after a failed insert', error);
    }
  }

  return written;
}

/**
 * Every scan, newest first, as summaries.
 *
 * Six columns and no payload parsing, so the cost of this call does not grow
 * with how much a scan records (AC-8).
 */
export async function listScans(): Promise<Result<readonly ScanSummary[]>> {
  return withDb(async (db) => {
    const rows = await db.getAllAsync<SummaryRow>(
      `SELECT ${SUMMARY_COLUMNS} FROM scan ORDER BY scanned_at DESC`,
    );
    return ok(rows.map(toSummary));
  });
}

/** One scan at full fidelity. Screens get `toDisplayScan` of this, never this. */
export async function getScan(id: string): Promise<Result<StoredScan>> {
  return withDb(async (db) => {
    const row = await db.getFirstAsync<ScanRow>('SELECT * FROM scan WHERE id = ?', [id]);
    return row === null ? fail('scan_not_found') : fromRow(row);
  });
}

/**
 * Delete a scan and its photo, in that order.
 *
 * The row goes first because that is what the user asked for: the scan should
 * stop existing the moment they say so. A file that will not delete is
 * reported and left to the sweep rather than holding the scan hostage, and the
 * caller still hears about it as `delete_failed`.
 */
export async function deleteScan(id: string): Promise<Result<void>> {
  return withDb(async (db) => {
    const row = await db.getFirstAsync<Pick<ScanRow, 'photo_uri'>>(
      'SELECT photo_uri FROM scan WHERE id = ?',
      [id],
    );
    if (row === null) return fail('scan_not_found');

    await db.runAsync('DELETE FROM scan WHERE id = ?', [id]);

    try {
      const file = new File(row.photo_uri);
      if (file.exists) file.delete();
    } catch (error) {
      report('removed the row but could not delete its photo', error);
      return fail('delete_failed');
    }

    return ok(undefined);
  });
}

/**
 * Delete any photo with no row behind it, and report how many went.
 *
 * One mechanism covers both orphan cases: a photo copied just before an insert
 * failed, and a photo whose delete failed after its row was already gone
 * (AC-10). Run once at app start.
 */
export async function sweepOrphanPhotos(): Promise<Result<number>> {
  return withDb(async (db) => {
    const directory = photoDirectory();
    if (!directory.exists) return ok(0);

    const rows = await db.getAllAsync<Pick<ScanRow, 'photo_uri'>>('SELECT photo_uri FROM scan');
    const live = new Set(rows.map((row) => row.photo_uri));

    let removed = 0;
    for (const entry of directory.list()) {
      if (entry instanceof Directory) continue;
      if (live.has(entry.uri)) continue;
      try {
        entry.delete();
        removed += 1;
      } catch (error) {
        report('could not sweep an orphan photo', error);
      }
    }

    return ok(removed);
  });
}

// Re-exported so callers reach the whole data layer through one import.
export { fail, isFailure, ok } from './types';
export type { DbErrorCode, Failure, Result } from './types';
export { buildScan, toDisplayScan } from './map';
