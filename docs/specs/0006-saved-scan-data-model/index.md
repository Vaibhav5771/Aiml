# 0006. Keep a scan as one SQLite row with its attributes as a tolerant payload

**Date**: 2026-10-13
**Status**: In Progress

## Summary

A scan is kept as a single row in SQLite on the phone, with its photo as a file beside it. The six attribute reads go into that row as one JSON payload (a block of text holding a whole object), read back by a parser that copes with a key that is not there. That is what lets you add a seventh attribute later without breaking a scan saved before it existed. The rule that decided the verdict is copied into the row rather than looked up later, so a scan reopened in a month still says exactly what it said on the day, even after `pune.json` has been edited since. Saving happens by itself the moment the rule engine answers, and a read that produced no verdict is never stored.

## Requirements

**User stories**:

- As someone who just scanned a tub, I want the answer kept without being asked for it, so history is a record of what I actually scanned rather than what I remembered to save.
- As someone reopening a scan from last month, I want it to read exactly as it did on the day, even though the rules have been edited since.
- As the person building features 11 and 12, I want one data layer that lists, reopens and deletes, so neither screen invents storage of its own.
- As the person building feature 13, I want the raw scores kept on disk, so the gate survival audit can run against history I already have instead of a separate collection run.
- As the person adding a seventh attribute some time next month, I want scans saved before it existed to keep opening, so a change to the vocabulary is not a migration.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: A scan saved on the device survives the app being closed and reopened, and comes back with its attributes, its rule, its verdict, its confidence and its photo intact.
- **AC-2**: `saveScan` writes at most one row per read. The result screen reaches a scan by its id and never by being handed the object, so a fresh scan and a reopened one take the identical path. Wiring the call into the capture flow belongs to feature 8; this spec owns the guarantee and the contract.
- **AC-3**: Only a read that produced a verdict is stored. A failed vision call, a network failure, and a photo with no packaging in it all write no row and leave no file.
- **AC-4**: A saved scan records `trustScore`, `modelVersion` and `gateFired`, satisfying spec 0005's **AC-14**. `trustScore` is null when no model was consulted and `modelVersion` then reads `unavailable`.
- **AC-5**: A saved scan records the id of the gate or rule that decided it, alongside the snapshot of that record's text and source. This closes the follow-up spec 0005 left open.
- **AC-6**: Attributes are stored with their 0 to 100 score. The type a screen is handed carries no `score` field, so printing one stays a compile error, preserving spec 0003's guarantee.
- **AC-7**: A scan saved before a seventh attribute existed still opens afterwards. The attribute is reported as absent rather than invented or thrown on, and a test reads a payload written without a key to prove it.
- **AC-8**: `listScans` returns one summary per scan, newest first, selecting only the columns the history list shows and never parsing the stored attribute payload.
- **AC-9**: `deleteScan` removes the row and then the photo file. After it returns, neither the row nor the file is on the device.
- **AC-10**: A file in the scans directory with no matching row is deleted at app start, which covers both a photo copied just before a failed insert and a photo whose delete failed.
- **AC-11**: Every data layer call returns a value or an explicit error object and never throws for an expected failure. The codes are `db_unavailable`, `photo_copy_failed`, `scan_not_found`, `row_unreadable` and `delete_failed`.
- **AC-12**: When the database cannot be opened or a migration fails, the scan to verdict path still works end to end. Only history is affected, and it reports `db_unavailable` rather than failing silently.
- **AC-13**: A save that fails part way leaves no photo file behind, and returns an error the verdict screen can use to say plainly that the scan was not kept.
- **AC-14**: The photo kept on disk is the downscaled JPEG that was sent to the proxy, copied into app private storage, and the row's `photo_uri` points at that copy rather than at the camera's cache.
- **AC-15**: The row mapping, the tolerant payload reader and the migration list run under `node --test` with no device and no native module, using the project's existing test command.
- **AC-16**: The table records its shape version through `PRAGMA user_version`, and the stored attribute payload carries a version integer of its own.
- **AC-17**: A saved scan records the region and the rule set version that decided it, so a verdict can be reproduced against the exact rules that produced it.
- **AC-18**: Nothing is deleted on its own. History grows until the user removes a scan.

## Decision

**Chosen option**: Option 2: one denormalised `scan` table with the attribute reads as a versioned JSON payload.

A scan is one row in one table, carrying the verdict, the snapshot of its deciding rule, the three learned fields and a JSON payload of the six attribute reads, with the photo as a file in app private storage named after the row id (basis: spec 0001's choice of `expo-sqlite` and `expo-file-system`, and schema on read, the practice of letting the reader rather than the table absorb an added field).

**Implementation skills**: `expo-project-structure` (`expo/skills`, `.agents/skills/expo-project-structure/`) · `react-native-best-practices` (`callstackincubator/agent-skills`, `.agents/skills/react-native-best-practices/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

One table, `scan`. No child tables and no foreign keys, because a scan has no related entity on the device. `PRAGMA user_version` starts at 1.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | TEXT | no | Primary key. A UUID v4 from `expo-crypto`'s `randomUUID()`. Travels in the `/result/[id]` route. |
| `scanned_at` | INTEGER | no | Epoch milliseconds from the device clock. Indexed descending. |
| `photo_uri` | TEXT | no | Absolute path to `<Paths.document>/scans/<id>.jpg`. Stored rather than derived, so a later change to the naming scheme cannot orphan old rows. |
| `item_name` | TEXT | no | From `VisionRead.itemName`. |
| `verdict` | TEXT | no | `recyclable`, `notRecyclable` or `checkManually`. |
| `action` | TEXT | no | The one line action the engine composed. |
| `confidence` | INTEGER | no | 0 to 100. |
| `note` | TEXT | **yes** | The optional caveat. Absent means there was none. |
| `rule_id` | TEXT | no | The id of the `Gate` or `Rule` that decided it, e.g. `gate-photo-unreadable`. New to the stored shape. |
| `rule_text` | TEXT | no | Snapshot of `AppliedRule.text`. |
| `rule_source_document` | TEXT | no | Snapshot of the cited document's name. |
| `rule_source_url` | TEXT | **yes** | Snapshot. Absent means a name only citation, per spec 0004's **AC-3**. |
| `region` | TEXT | no | From `RuleSet.region`, e.g. `Pune, India`. |
| `rule_set_version` | TEXT | no | From `RuleSet.version`, e.g. `1.1.0`. |
| `trust_score` | REAL | **yes** | 0 to 1 from spec 0005. Null means the model was not consulted. |
| `model_version` | TEXT | no | The artifact's version, or the literal `unavailable`. |
| `gate_fired` | INTEGER | no | 0 or 1. SQLite has no boolean type. |
| `attributes` | TEXT | no | JSON. The whole `VisionAttributes` object including every `score`. |
| `attributes_version` | INTEGER | no | The payload's own version. `ATTRIBUTES_PAYLOAD_VERSION`, which starts at 1. |

Index: `idx_scan_scanned_at` on `scan(scanned_at DESC)`, which serves the only ordering the history list uses.

**Types**, in `src/vision/types.ts` beside the vocabulary they extend:

- `StoredScan`: full fidelity. `attributes` is `Partial<VisionAttributes>`, so a key absent from an old payload is representable rather than faked. Returned by `saveScan` and `getScan`.
- `Scan`: the existing name, kept. Its `attributes` becomes `Partial<DisplayAttributes>`, which has no `score` field. Produced from a `StoredScan` by the pure `toDisplayScan()`. This is what screens receive, so spec 0003's compile error guarantee survives storing the scores.
- `ScanSummary`: `{ id, photoUri, itemName, scannedAt, verdict, confidence }`. What `listScans` returns.

The keys are optional rather than required because `PhotoQualityCode` has no `unknown` member, by spec 0003's deliberate choice, so there is no honest value a reader could substitute for a missing `photoQuality`. An absent key is the truthful record of "this scan predates that attribute", and a screen iterating `ATTRIBUTE_ORDER` simply skips it.

**State transitions**:

A scan has one lifecycle and no in between states: `saved` on insert, then `deleted`. There is no draft, no pending and no archived state, because a row is only ever written once a verdict already exists and deletion is permanent. The two failure paths produce no state at all: a failed photo copy and a failed insert both leave nothing behind.

**API surface** (module functions, not HTTP; this app has no server side store):

| Function | Call | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `saveScan` | `src/db` | `sourcePhotoUri: string` (req), `read: VisionRead` (req), `verdict: Verdict` (req), `learned: ScanLearnedFields` (req), `ruleSet: { region, version }` (req) | `StoredScan` | none, local device | `photo_copy_failed`, `db_unavailable` |
| `listScans` | `src/db` | none | `readonly ScanSummary[]`, newest first | none | `db_unavailable` |
| `getScan` | `src/db` | `id: string` (req) | `StoredScan` | none | `scan_not_found`, `row_unreadable`, `db_unavailable` |
| `deleteScan` | `src/db` | `id: string` (req) | `void` | none | `scan_not_found`, `delete_failed`, `db_unavailable` |
| `sweepOrphanPhotos` | `src/db` | none | `number`, how many files were removed | none | `db_unavailable` |

Every one returns `{ ok: true, value: T }` or `{ error: '<code>' }`, mirroring the proxy's convention that a failure is an explicit value and never a partial result.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| `saveScan` | `id` | `randomUUID()` from `expo-crypto`, generated inside `saveScan` |
| `saveScan` | `scanned_at` | `Date.now()` at save time, the device clock, stored as epoch milliseconds |
| `saveScan` | `photo_uri` | Composed as `<Paths.document>/scans/<id>.jpg`, written by copying `sourcePhotoUri` there |
| `saveScan` | the file `sourcePhotoUri` points at | The downscaled JPEG feature 8 already produced to send to the proxy. Feature 5 does not downscale: `useImageManipulator` is a React hook in SDK 57 and cannot be called from a plain async function, so the resize belongs in the capture flow, which is already a component |
| `saveScan` | `item_name` | `VisionRead.itemName`, decided in spec 0003 |
| `saveScan` | `verdict`, `action`, `confidence`, `note` | The `Verdict` returned by `decide()`, decided in spec 0004 |
| `saveScan` | `rule_id` | `AppliedRule.id`, new in this spec, carried out of `decidingRecord().record.id`, which already selects the winning record |
| `saveScan` | `rule_text`, `rule_source_document`, `rule_source_url` | Snapshot of `AppliedRule`, decided in spec 0004 |
| `saveScan` | `region`, `rule_set_version` | The `ruleSet` argument, supplied by the caller from `PUNE_RULES` |
| `saveScan` | `trust_score`, `model_version`, `gate_fired` | `assess()` in `src/rules/index.ts`, decided in spec 0005 |
| `saveScan` | `attributes` | `VisionRead.attributes` serialised whole, every `score` included |
| `saveScan` | `attributes_version` | `ATTRIBUTES_PAYLOAD_VERSION`, a constant in `src/db/schema.ts` |
| `listScans` | each summary | Six selected columns. The payload is never parsed on this path |
| `listScans` | the order | `ORDER BY scanned_at DESC`, served by `idx_scan_scanned_at` |
| `getScan` | an attribute key absent from the payload | Nothing. The reader omits the key, and `Partial<VisionAttributes>` makes that representable |
| `getScan` | an attribute code the enum no longer knows | Kept as read and left to the screen, which renders `display`. The reader never coerces a code it does not recognise |
| screens | `Scan` | `toDisplayScan(stored)`, a pure projection that drops every `score` |
| `deleteScan` | which file to remove | The row's `photo_uri`, read before the row is deleted |
| `sweepOrphanPhotos` | the set of live files | Every `photo_uri` in `scan`, compared against a listing of the scans directory |
| verdict screen | that a save failed | The `{ error }` returned by `saveScan`, passed through the store. Feature 9 owns the wording |

**Key invariants**:

- Every row has a verdict, a rule id, a rule text and a source document. There is no stored scan with no rule behind it, which is the product's whole claim.
- `photo_uri` always points at a file that existed when the row was written, because the copy completes before the insert runs.
- A file in the scans directory either matches a row's `photo_uri` or is an orphan to be swept. There is no third case.
- `confidence` is 0 to 100. `trust_score`, when present, is 0 to 1. They are different scales on purpose and must never be compared or merged.
- `model_version` is never empty. Absence of a model is the literal `unavailable`, never null, so a row can always say something about the model.
- `attributes_version` is written on every insert and read on every parse. A payload carrying a version the reader does not know is `row_unreadable` rather than a silent misread.
- Nothing writes to `scan` except `saveScan`, and nothing deletes except `deleteScan` and `sweepOrphanPhotos`.

**Security model**:

Single user, single device, no accounts and no server side store, so there are no roles, no ownership rules and no authorisation surface. Everything written here lives in app private storage, which other apps on the device cannot read. The database holds no credentials and no personal data beyond photographs of packaging the user chose to take.

No compliance scope applies. The photo does leave the device on its way to the proxy, which spec 0003 owns, but nothing in this spec sends anything anywhere. The scope's deferred privacy note still stands and is not resolved here.

Deletion is a real delete, not a flag. A deleted scan leaves no row and no file, which is what feature 12 promises and what makes the promise checkable.

**Configuration required**:

No new environment variables and no credentials. Four packages must be installed before this builds, all first party Expo modules or a small library, all confirmed to run inside Expo Go on SDK 57:

- `expo-sqlite`: the rows
- `expo-file-system`: the photo files, through the `File`, `Directory` and `Paths` object API that is primary in SDK 57
- `expo-crypto`: `randomUUID()` for the scan id
- `zustand`: the store, as spec 0001 decided

Install each with `npx expo install <package>`, never `npm install`, so the version stays SDK compatible.

**Critical test scenarios**:

- Happy path: a scan is saved, the app is closed and reopened, and the scan comes back from `getScan` with every attribute, its rule and its photo path intact, verifies **AC-1**.
- Forward compatibility: the reader is handed a payload written without a `photoQuality` key and returns the other five attributes with that key absent, rather than throwing or inventing a value, verifies **AC-7**.
- Failure case: the photo copy succeeds and the insert then fails, and afterwards neither a row nor a file exists and the caller receives `db_unavailable`, verifies **AC-13**, **AC-11**.
- Failure case: the database cannot be opened, and the scan to verdict path still completes while `listScans` returns `db_unavailable`, verifies **AC-12**.
- Delete: a saved scan is deleted, and afterwards `getScan` returns `scan_not_found` and the photo file is gone from the device, verifies **AC-9**.
- Orphan: a file is placed in the scans directory with no matching row, the app restarts, and the file is gone, verifies **AC-10**.
- Compile time: a screen holding a `Scan` cannot reference `.score` on any attribute, verifies **AC-6**.
- Auth and permission: not applicable. The app is single user and local, with no accounts, no roles and nothing to deny.

## Build plan

The project builds by Journey, so this plan drives one scan all the way through the layer before widening to the other three operations, rather than building the whole schema and then the whole query set. Step 5 is the point where a scan genuinely round trips.

1. Install `expo-sqlite`, `expo-file-system`, `expo-crypto` and `zustand` with `npx expo install`, then write `src/db/schema.ts`: the `CREATE TABLE` and index statements, the ordered migration list keyed on `PRAGMA user_version`, and the `ATTRIBUTES_PAYLOAD_VERSION` constant. Pure strings and data, no native import. Satisfies **AC-16**.
2. Widen the types in `src/vision/types.ts`: add `id` to `AppliedRule`, add `StoredScan`, `ScanSummary` and the `region` and `ruleSetVersion` fields, and change `Scan.attributes` to `Partial<DisplayAttributes>`. Update `src/vision/mock.ts` and the result screen to iterate `ATTRIBUTE_ORDER` and skip an absent key. Satisfies **AC-4**, **AC-5**, **AC-6**, **AC-17**.
3. Carry the rule id through `src/rules/`: `decidingRecord()` already selects the winning `Gate` or `Rule`, so put `record.id` into the `AppliedRule` that `verdictFrom` builds. Extend the rule set test to assert every gate, rule and note id is unique. Satisfies **AC-5**.
4. Write `src/db/map.ts`, pure and importing nothing native: row to `StoredScan`, `StoredScan` to row, the tolerant payload reader that survives a missing key and refuses an unknown `attributes_version`, and `toDisplayScan()`. Write `src/db/map.test.ts` beside it, including the payload written without a key, and add both to the `test` script. Satisfies **AC-6**, **AC-7**, **AC-11**, **AC-15**, **AC-16**.
5. Write the native edge in `src/db/index.ts`: open the database, run the migrations, then `saveScan`. Copy the photo to `<Paths.document>/scans/<id>.jpg` first, insert second, and delete the copy if the insert fails. Return explicit error values throughout. Satisfies **AC-1**, **AC-11**, **AC-13**, **AC-14**.
6. Add `getScan` and `listScans`, the latter selecting only the six summary columns and never parsing the payload. Satisfies **AC-1**, **AC-8**, **AC-11**.
7. Add `deleteScan`, removing the row and then the file, and `sweepOrphanPhotos`, run once at app start from `src/app/_layout.tsx`. Satisfies **AC-9**, **AC-10**, **AC-18**.
8. Write the Zustand store in `src/store/scans.ts`: it owns the save, exposes the list and a scan by id, and surfaces `db_unavailable` as state rather than letting it reach a screen as an exception. Satisfies **AC-2**, **AC-3**, **AC-12**.
9. Add the throwaway route `src/app/dev-data.tsx` with four actions, seeding from `src/vision/mock.ts`, commented as feature 5 scaffolding that feature 11 deletes. Run it on the real device and confirm save, list, reopen and delete. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-9**, **AC-12**.

## Consequences

**Positive**:

- Adding a seventh attribute costs nothing. No migration, no backfill, and scans saved before it simply lack the key.
- A reopened scan is faithful forever. Editing `pune.json` cannot retroactively change what a past scan claimed, and with `rule_id`, `region` and `rule_set_version` on the row, a historical verdict can be traced to the exact rules that produced it.
- Spec 0005's open follow-up is closed rather than worked around. `AppliedRule` carries an id, so nothing has to match on rule text to find out which record fired.
- Storing the scores makes spec 0005's gate survival audit runnable against ordinary history, so the first 50 photos you scan normally become usable evidence without a separate collection run.
- The logic that can actually be wrong, the mapping, the tolerant reader and the version handling, is testable with your existing `node --test` command on no device.
- A storage failure degrades to losing history, never to losing the answer. The product's core flow does not depend on the database at all.

**Negative / tradeoffs**:

- `Scan.attributes` becomes partial, so every screen reading attributes has to iterate `ATTRIBUTE_ORDER` and handle an absent key. That touches `src/vision/mock.ts` and the result screen now, and features 9, 11 and 12 inherit it. It is the honest price of forward compatibility, but it is a real change to code that already works.
- You cannot ask SQL a question about an attribute. "Every scan whose material was PET" means reading and parsing every row in TypeScript. Nothing in the scope asks for it, but the first time you want it, it is an awkward loop rather than an index.
- The rule text and source are duplicated into every row. That is deliberate denormalisation for historical fidelity, and it does mean a typo fixed in `pune.json` stays wrong in every scan saved before the fix.
- `listScans` is unpaginated by design. That is right at the hundreds of scans this app will hold and wrong at the thousands; the trigger for revisiting it is history feeling slow, not a number decided now.
- Two types now describe a stored scan, `StoredScan` and `Scan`, with a projection between them. That is one more thing to keep in step, accepted to preserve spec 0003's compile error guarantee that a screen cannot print a raw score.
- Four new packages, where the project currently has none for storage. All four are small, first party or well understood, and all run in Expo Go, but the dependency count does go up.

**Neutral**:

- The app gains a `src/db/` and a `src/store/` directory, exactly as spec 0001's layout anticipated.
- `src/app/dev-data.tsx` is throwaway by design. Feature 11 deletes it, and the file says so.
- Epoch milliseconds in the column and an ISO string on the type means one conversion at the boundary, in `map.ts`, tested there.
- `expo-image-manipulator` is not installed by this feature. The downscale belongs to feature 8, because SDK 57 made the manipulator a hook.

## Follow-up

- [ ] Feature 8 owns producing the downscaled JPEG that `saveScan` copies, and owns calling `saveScan` before routing to `/result/<id>`. This spec defines the contract but cannot wire it, because the capture flow does not exist yet.
- [ ] Feature 9 owns the wording of the quiet line that says a scan was not saved. This spec guarantees the error value reaches the screen and nothing more.
- [ ] Feature 11 deletes `src/app/dev-data.tsx` when it builds the real history list.
- [ ] `Source.scope` (municipal, state, national) is still dropped on the way into `AppliedRule`, so a saved scan does not record how far its cited document's authority reached. Deliberately left alone here to keep the boundary spec 0004 drew; worth revisiting when feature 9 decides whether a screen shows a national citation differently from a Pune one.
- [ ] Revisit pagination in `listScans` if the history list starts feeling slow. The summary projection buys a lot of headroom, so this is a symptom driven change, not a scheduled one.
- [ ] Root `AGENTS.md` does not yet name `src/db/` or `src/store/` conventions. Once this is built, `/sync` should record where storage code lives and that the data layer returns error values rather than throwing.
