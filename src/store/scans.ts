/**
 * The scan store: what every screen reads instead of touching the database.
 *
 * SQLite stays the source of truth, as spec 0001 decided. This holds only what
 * is worth not refetching, the history list, and it hands screens a scan by
 * its id rather than passing the object around. A fresh scan and a reopened
 * past one therefore take the identical path through the code.
 *
 * It also absorbs failure. `db_unavailable` becomes a piece of state the
 * history screen can render, never an exception reaching a screen, which is
 * what keeps a storage problem from touching the scan to verdict path at all
 * (spec 0006, AC-12).
 */

import { create } from 'zustand';

import {
  buildScan,
  deleteScan,
  getScan,
  isFailure,
  listScans,
  ok,
  saveScan,
  toDisplayScan,
  type DbErrorCode,
  type Result,
  type SaveScanInput,
} from '@/db';
import type { Scan, ScanSummary, StoredScan } from '@/vision/types';

type ScansState = {
  /** The history list, newest first. Empty until `refresh` has run once. */
  readonly summaries: readonly ScanSummary[];
  /** True while a read is in flight, so the list can show it is working. */
  readonly loading: boolean;
  /** The last failure, or `undefined`. Only history is ever affected by it. */
  readonly error: DbErrorCode | undefined;

  /**
   * The scan that could not be saved, held in memory so its answer is not lost
   * with it.
   *
   * A storage failure must never swallow an answer (spec 0007, invariant 6).
   * The engine has already decided; the only thing that went wrong is that the
   * row did not land, and refusing to show a verdict over a database problem
   * would be punishing the reader for something the database did.
   *
   * `/result/unsaved` is the only screen that reads it, and it is written
   * nowhere but `save` below.
   */
  readonly pending: Scan | undefined;

  refresh: () => Promise<void>;
  save: (input: SaveScanInput) => Promise<Result<StoredScan>>;
  open: (id: string) => Promise<Result<Scan>>;
  remove: (id: string) => Promise<Result<void>>;
};

/**
 * The save in flight, if there is one.
 *
 * This is what makes "at most one row per read" structural rather than a rule
 * someone has to remember (AC-2). A second call while the first is still
 * running gets the same promise back, so a double tap, a re-render or a fast
 * refresh in development cannot produce two rows for one photo.
 *
 * Module level rather than store state on purpose: it is a guard, not
 * something a screen should ever render.
 */
let inFlightSave: Promise<Result<StoredScan>> | undefined;

export const useScans = create<ScansState>((set, get) => ({
  summaries: [],
  loading: false,
  error: undefined,
  pending: undefined,

  refresh: async () => {
    set({ loading: true });
    const result = await listScans();

    if (isFailure(result)) {
      set({ loading: false, error: result.error });
      return;
    }
    set({ loading: false, error: undefined, summaries: result.value });
  },

  save: async (input) => {
    if (inFlightSave !== undefined) return inFlightSave;

    inFlightSave = (async () => {
      const result = await saveScan(input);

      if (isFailure(result)) {
        /*
         * The row did not land, so nothing can reopen this scan by id. Keeping
         * the verdict here is what lets `/result/unsaved` show it in full
         * anyway (spec 0007, AC-13).
         *
         * The photo uri is the source JPEG rather than a copy in app storage,
         * because either the copy never happened or it was deleted again when
         * the insert failed. It is still on disk wherever the camera left it,
         * which is enough for this one viewing and nothing longer.
         *
         * `buildScan` and `toDisplayScan` are the same two functions the
         * stored path uses, so a scan shown from memory and the same scan read
         * back from a row are assembled by identical code and cannot look
         * different on screen.
         */
        set({
          error: result.error,
          pending: toDisplayScan(
            buildScan({
              // Never persisted, so there is no id to give it. An empty one
              // cannot collide with a real scan's.
              id: '',
              scannedAt: Date.now(),
              photoUri: input.sourcePhotoUri,
              read: input.read,
              verdict: input.verdict,
              learned: input.learned,
              ruleSet: input.ruleSet,
            }),
          ),
        });
        return result;
      }

      // A save that worked clears the last one that did not, so a stale
      // verdict can never be sitting in `pending` waiting to be shown as
      // though it were this scan.
      set({ pending: undefined });

      // Refreshing here, rather than when the history tab next gets focus, is
      // what feature 11 means by a scan appearing straight after you take it.
      await get().refresh();
      return result;
    })();

    try {
      return await inFlightSave;
    } finally {
      inFlightSave = undefined;
    }
  },

  open: async (id) => {
    const result = await getScan(id);
    // The projection happens here, so no screen is ever handed the stored
    // object and no screen can reach a raw score.
    return isFailure(result) ? result : ok(toDisplayScan(result.value));
  },

  remove: async (id) => {
    const result = await deleteScan(id);
    // The row is gone even when the photo delete failed, so the list is stale
    // either way and refreshes regardless of the outcome.
    await get().refresh();
    return result;
  },
}));
