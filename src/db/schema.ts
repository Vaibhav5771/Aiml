/**
 * The shape of the `scan` table, and the only sanctioned way it may change.
 *
 * Pure data. Nothing here imports a native module, so this file and
 * `map.ts` are the half of the data layer that `node --test` can reach
 * (spec 0006, AC-15). `index.ts` is the other half, and it holds no logic.
 *
 * [Spec 0006](../../docs/specs/0006-saved-scan-data-model/index.md) is the
 * authority over every column name and type below.
 */

/** The database file, created under the app's private storage on first open. */
export const DATABASE_NAME = 'recyclens.db';

/** The directory under `Paths.document` that holds one JPEG per saved scan. */
export const PHOTO_DIRECTORY = 'scans';

/**
 * The version stamped into every attribute payload this build writes.
 *
 * Two different kinds of change need two different mechanisms, which is why
 * this exists alongside `PRAGMA user_version`. The table version below handles
 * a real column change. This one handles the payload: adding a seventh
 * attribute needs no bump, because the reader already tolerates a key it does
 * not find, but renaming a code inside the payload would, and without a
 * version a later reader could not tell which spelling it was looking at.
 */
export const ATTRIBUTES_PAYLOAD_VERSION = 1;

/**
 * Payload versions this build knows how to read.
 *
 * A payload stamped with anything else is `row_unreadable` rather than a
 * silent misread, which is the whole point of stamping it (spec 0006, AC-16).
 */
export const READABLE_PAYLOAD_VERSIONS: readonly number[] = [ATTRIBUTES_PAYLOAD_VERSION];

/**
 * The migrations, in order. Index 0 takes `user_version` 0 to 1, index 1 takes
 * 1 to 2, and so on, which is the pattern Expo's SDK 57 SQLite docs show.
 *
 * Append only. Never edit a statement that has already shipped, because a
 * phone that ran it is past that version and will never run it again.
 *
 * Note what is NOT here: adding an attribute to the vocabulary. That lives
 * inside the `attributes` payload and needs no migration at all, which is the
 * requirement feature 5 exists to meet.
 */
export const MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS scan (
    id                   TEXT    PRIMARY KEY NOT NULL,
    scanned_at           INTEGER NOT NULL,
    photo_uri            TEXT    NOT NULL,
    item_name            TEXT    NOT NULL,
    verdict              TEXT    NOT NULL,
    action               TEXT    NOT NULL,
    confidence           INTEGER NOT NULL,
    note                 TEXT,
    rule_id              TEXT    NOT NULL,
    rule_text            TEXT    NOT NULL,
    rule_source_document TEXT    NOT NULL,
    rule_source_url      TEXT,
    region               TEXT    NOT NULL,
    rule_set_version     TEXT    NOT NULL,
    trust_score          REAL,
    model_version        TEXT    NOT NULL,
    gate_fired           INTEGER NOT NULL,
    attributes           TEXT    NOT NULL,
    attributes_version   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_scan_scanned_at ON scan (scanned_at DESC);`,

  /*
   * Spec 0007: the verdict screen needs two things a row written before it
   * never recorded.
   *
   * Both are nullable, and not for convenience. `ALTER TABLE ADD COLUMN`
   * cannot add a `NOT NULL` column without a default, and neither of these has
   * an honest default: a row written before this migration genuinely does not
   * know its authority scope or which attributes decided it. Null therefore
   * means "not recorded", and the screen answers that by showing no authority
   * chip and promoting no rows (AC-18), rather than by inventing a value.
   *
   * `decided_on` stores a derived value, against the general rule, and that is
   * deliberate. It is not stored for speed. Spec 0006's whole premise is that
   * a scan reopened in a month says exactly what it said on the day, and
   * recomputing which attributes decided it from the rule id against a
   * `pune.json` that has been edited since would silently promote the wrong
   * rows.
   */
  `ALTER TABLE scan ADD COLUMN rule_source_scope TEXT;
  ALTER TABLE scan ADD COLUMN decided_on TEXT;`,
];

/** The `user_version` a fully migrated database reports. */
export const SCHEMA_VERSION = MIGRATIONS.length;

/**
 * The columns `listScans` reads.
 *
 * Named here rather than inlined in the query so the summary type and the
 * select stay in step. The payload is deliberately absent: the history list
 * shows none of it, and parsing a blob per row is the one cost worth avoiding
 * on a list that grows (spec 0006, AC-8).
 */
export const SUMMARY_COLUMNS = 'id, photo_uri, item_name, scanned_at, verdict, confidence';
