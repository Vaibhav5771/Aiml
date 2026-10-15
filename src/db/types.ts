/**
 * How the data layer reports failure.
 *
 * An expected failure is a value here, never a thrown exception, which is the
 * convention `AGENTS.md` sets and the one `proxy/api/` already follows. The
 * practical effect is that a caller cannot forget about a failure: the type
 * will not let it read `value` without checking first.
 *
 * Pure. Nothing here imports a native module.
 */

/**
 * Every way a data layer call can fail.
 *
 * Deliberately coarse. A caller only ever needs to know which of these five
 * happened, and a finer code would be a distinction no screen acts on.
 */
export type DbErrorCode =
  /** The database could not be opened, or a migration failed. History is unavailable; the scan path still works. */
  | 'db_unavailable'
  /** The photo could not be copied into app storage, so nothing was written. */
  | 'photo_copy_failed'
  /** No scan with that id. Expected after a delete, or on a stale link. */
  | 'scan_not_found'
  /** The row is there but could not be read: a corrupt payload, or one stamped with a version this build does not know. */
  | 'row_unreadable'
  /** The row was removed but its photo file could not be. The startup sweep will catch the file. */
  | 'delete_failed';

export type Failure = { readonly error: DbErrorCode };

export type Result<T> = { readonly ok: true; readonly value: T } | Failure;

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = (error: DbErrorCode): Failure => ({ error });

/** Narrows a result to its failure arm, so a caller can branch without a cast. */
export const isFailure = <T>(result: Result<T>): result is Failure => 'error' in result;
