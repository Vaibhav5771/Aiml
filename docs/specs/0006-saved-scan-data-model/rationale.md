# 0006. Rationale: keep a scan as one SQLite row with its attributes as a tolerant payload

Reasoning, options and sources for [index.md](index.md), which is the build spec. This file is the decision record and a build can skip it.

## Context

> ⚠️ Premise note: this spec defines a contract that feature 8 has to honour, and feature 8 has no spec. Two acceptance criteria depend on it: **AC-14** assumes the capture flow hands `saveScan` a downscaled JPEG, and **AC-2** assumes the capture flow calls `saveScan` once, before routing to the result screen. That ordering is deliberate rather than accidental, because spec 0005 asked for `/architect data model` to run before feature 5 was built, and because the shape of a saved scan is what features 8, 9, 11 and 12 all build against. The assumption is stated here and enrolled as a follow-up rather than left implicit, so that if feature 8 ends up downscaling somewhere else, or saving somewhere else, this spec is what gets revisited.

Recyclens can produce a verdict today and cannot remember one. Spec 0003 made a photo come back as six named observations, spec 0004 turned those into a cited Pune verdict, and spec 0005 put a learned reliability gate in front of the rules. All three produce values that vanish the moment the screen is dismissed. The scan history list, the past scan detail screen and the learned stage's evidence gathering all need a scan to exist as a thing on the device rather than as a value in memory, and none of them can be built until that thing has a shape.

The forces are narrow and specific. The app is single user and local, running through Expo Go on one Android phone, with no accounts, no server side store and no sync, so nothing here has to reason about concurrency between users, tenancy, or reconciliation. The data volume is small: a few hundred scans over the life of the project, each with one photograph. The project is four people with roughly two weeks, which means a design that can be read and operated by whoever picks it up, not one that is clever.

Against that, two constraints pull harder than the size of the problem suggests. The first is that the attribute vocabulary is expected to move. Spec 0003 fixed six observations and the scope's deferred list contemplates more, so the scope's own Done when for this feature is written as a forward compatibility requirement: adding a new attribute later must not break scans saved before it existed. A schema that makes a vocabulary change into a migration fails the requirement as written. The second is that the product's claim is that an answer can be traced to a document rather than to a model's opinion. A stored verdict that cannot say which rule produced it, or that silently changes its wording when `pune.json` is edited, quietly breaks that claim without anything visibly failing.

There is also an inherited debt. Spec 0005 recorded that `AppliedRule` carries no id, so a stored scan could not say which rule fired except by matching on its text, and it explicitly left closing that to whoever designed this feature. The engine already selects the deciding record in one place, `decidingRecord()`, so the id exists and is simply dropped on the way out. Not deciding here means features 11, 12 and 13 each build against a shape that is known to be missing something.

## Options considered

### Option 1: Flat typed columns, one pair per attribute

Give the `scan` table a `material_code` and `material_score` column, a `form_code` and `form_score` column, and so on through all six observations, alongside the verdict and rule columns. The database holds the full shape, typed, with no serialisation anywhere.

**Pros**:

- Every value is a real column, so SQLite can index, filter and order on any of them. Questions like "every scan whose material was PET and whose verdict was not recyclable" are one query.
- No parsing on any read path, and no class of bug where a payload is written in one shape and read in another.
- The schema documents itself. Opening the database in any viewer shows exactly what a scan is.

**Cons**:

- Every new attribute is an `ALTER TABLE` and a migration step, which is precisely the thing the scope's Done when says must not happen.
- Twenty four columns for six observations, growing with the vocabulary, and each one needs mapping code in both directions.
- Removing or renaming an attribute is worse than adding one, and spec 0003's enums are young enough that a rename is plausible.

### Option 2: One denormalised table with a versioned JSON payload (chosen)

One `scan` row holds the scalars that matter to the database, the verdict, the rule snapshot and the three learned fields, plus the whole attribute object as a single JSON text column with a version integer beside it. A reader parses the payload and tolerates a key it does not find.

**Pros**:

- Adding an attribute is free. No migration, no backfill, and an old row is correct rather than broken, which is the requirement stated verbatim in the scope (basis: schema on read, the practice of letting the reader rather than the table absorb an additive change).
- The payload version plus `PRAGMA user_version` cover two different kinds of change with two cheap mechanisms: the first tells a reader how a blob was written, the second handles a real table change (basis: Expo's documented SQLite migration pattern for SDK 57).
- The columns that the history list actually reads stay real columns, so a list query never touches the payload at all.
- The pure part, mapping and parsing, imports nothing native and therefore runs under the project's existing `node --test` command (basis: your `AGENTS.md`, functions pure by default with side effects pushed to the edges).

**Cons**:

- No attribute can be queried in SQL. Any question about what was observed means reading and parsing every row in TypeScript.
- A payload is opaque to anything but the reader, so a bug in serialisation is invisible until something reads it back.
- It forces the stored attribute keys to be optional, which pushes an absent key out to every screen that renders attributes.

### Option 3: A child table, one row per attribute

Keep the scan scalars on `scan` and put the six observations in `scan_attribute(scan_id, key, code, display, confidence, score)`, six rows per scan, joined on read.

**Pros**:

- Adding an attribute needs no migration either, so it meets the forward compatibility requirement just as well as Option 2.
- Unlike Option 2, the observations stay queryable in SQL, so "every scan whose material was PET" is still one query.
- It is the textbook relational answer, and nothing about it would surprise a reviewer.

**Cons**:

- Every read becomes a join and every write becomes seven statements in a transaction, roughly doubling the data layer for querying nothing in the scope asks for.
- A scan is no longer one row, so a partial write is now possible in a way Option 2 makes structurally impossible.
- The per attribute code column cannot be typed against the right enum, because `material` and `form` draw from different closed lists, so the type safety the join buys back is weaker than it looks.

### Option 4: One JSON file per scan, no database at all

Drop SQLite entirely. Write each scan as a `.json` file in app storage beside its photo, and build the history list by reading the directory.

**Pros**:

- The fewest moving parts of any option, and one less package to install. The whole data layer becomes read, write and delete a file.
- Forward compatibility is free and total, since there is no schema to migrate at all.
- A scan and its photo sit together, so a delete is one directory removal and an orphan file is impossible by construction.

**Cons**:

- Listing history means opening and parsing every file on every render, which gets slower in exactly the way Option 2's summary projection avoids.
- Ordering, and any future filtering, has to be done in memory after reading everything, so there is no equivalent of an index.
- It throws away a decision spec 0001 already made and a module Expo already ships, in exchange for solving a problem this app does not have.

## Rationale

Option 2 is chosen because the scope's Done when for this feature is a forward compatibility requirement, and only Options 2, 3 and 4 satisfy it at all. Option 1 is the best design on every axis except the one the requirement names, which settles it: a vocabulary that is expected to grow must not make growth a migration.

Between the three that qualify, the deciding force is the size of the problem rather than its shape. Option 3 is the more orthodox relational answer and it is the right call in a system where something queries attributes, but nothing in the scope does, and nothing in the deferred list implies it will. Paying a join on every read and a seven statement transaction on every write, in a four person two week project, to enable a query nobody has asked for, is complexity bought on speculation (basis: your `AGENTS.md`, prefer the smallest thing that works, and spec 0001's standing preference for first party modules over research projects). Option 4 goes too far the other way: it is genuinely simpler until the history list exists, at which point reading and parsing every scan on every render is the one performance problem this app can actually have, and it discards `expo-sqlite`, which spec 0001 already chose and which ships inside Expo Go at no cost.

The two mechanisms around the payload are deliberately boring. `PRAGMA user_version` with an ordered migration list is what Expo's own SDK 57 documentation shows, so it is the pattern a later reader will recognise, and the payload version integer costs one column while making a future breaking change to the blob tractable rather than archaeological. Neither is clever and both are the kind of thing you want to be obvious at 5pm on a Tuesday.

Two decisions deserve naming because they cut against a default. First, the rule text and source are copied into every row rather than referenced, which is denormalisation and does mean a typo fixed in `pune.json` stays wrong in older scans. That is the correct trade here: the product's claim is that an answer can be traced to a document, and a verdict whose wording silently changes under it is a worse failure than a stale typo (basis: snapshotting a cited decision at the moment it was made, the same reason an invoice stores its line item prices rather than joining to a price list). Second, `listScans` is unpaginated, which contradicts the usual rule that any list surface paginates. That rule is about network endpoints and unbounded shared data; this is a local SQLite read of a few hundred rows on one device, and the summary projection already removes the expensive part. The honest position is that pagination is deferred with a named trigger, not that it is unnecessary forever.

One thing surfaced while writing the types rather than during the design conversation, and it changed the agreed shape. Storing the scores means a screen can no longer be handed the stored object directly, because `AttributeRead` is structurally assignable to `DisplayAttribute` and TypeScript's excess property check does not fire on a variable, so spec 0003's compile error guarantee would quietly stop guaranteeing anything. That is solved by a pure projection and two types. Related, and sharper: the tolerant reader cannot substitute a value for a missing attribute, because `PhotoQualityCode` has no `unknown` member by spec 0003's deliberate choice, and inventing `fair` would be fabricating a reading. So the stored attribute keys are optional, and a screen skips an absent one. That is the real cost of forward compatibility, and it is better paid in the type system than discovered at runtime.

## Supporting evidence

**Expo SDK 57 API check**, run during this design conversation because `AGENTS.md` requires versioned docs rather than recalled API shapes. Three facts differ from the older API a reader may expect:

- `expo-file-system` now leads with an object API, `File`, `Directory` and `Paths`. The older `FileSystem.documentDirectory` style constants moved to `expo-file-system/legacy` and are documented as deprecated. App private persistent storage is `Paths.document`; `Paths.cache` is the clearable one, which is where a camera photo starts.
- `expo-image-manipulator` replaced the imperative `manipulateAsync` with a `useImageManipulator` hook, chained through `renderAsync()` and `saveAsync()`. Because it is a hook, it cannot be called from a plain async save function, which is why the downscale belongs to feature 8's capture component and not to this feature's data layer.
- `expo-sqlite` exposes `openDatabaseAsync` with `runAsync`, `getFirstAsync`, `getAllAsync` and `execAsync`, plus a `SQLiteProvider` and `useSQLiteContext`. The documented migration approach is reading `PRAGMA user_version`, applying conditional blocks per version, and writing the new version back.

All three modules are included in Expo Go on SDK 57, so none of them forces a development build, which matters because spec 0001 runs this project through Expo Go on one device.

**Code already in place**, read while designing: `decidingRecord()` in `src/rules/engine.ts` already selects the single winning `Gate` or `Rule` and both `decideWith` and `assess` go through it, so carrying `record.id` into `AppliedRule` is one field rather than the rule set change it first appeared to be. `Gate`, `Rule` and `NoteRule` in `src/rules/types.ts` already carry a `readonly id`, and `pune.json` already populates it.

## References

**Project sources** (verifiable, in this repo):

- `AGENTS.md`: functions pure by default with side effects at the edges, an expected failure returns an explicit error value rather than throwing, and packages are added with `npx expo install`
- Spec [0001](../0001-stack-and-architecture/index.md): `expo-sqlite` for rows, `expo-file-system` for photos with the path on the scan row, Zustand with SQLite as the source of truth, and the `src/db/` and `src/store/` layout
- Spec [0003](../0003-packaging-vision-read/index.md): the six attribute vocabulary, the closed enums, `PhotoQualityCode` having no `unknown`, and `DisplayAttribute` making a printed score a compile error
- Spec [0004](../0004-local-recycling-rule-set/index.md): the `Verdict` and `AppliedRule` shapes, and that a missing URL means a name only citation
- Spec [0005](../0005-learned-second-opinion/index.md): **AC-14** requiring `trustScore`, `modelVersion` and `gateFired`, and the open follow-up that `AppliedRule` carries no id
- `src/rules/engine.ts` and `src/rules/types.ts`: `decidingRecord()`, and the `id` already present on every gate, rule and note
- `package.json`: the `test` script runs `node --import tsx --test`, with no device and no native module

**Practices and standards**:

- Schema on read: let the reader rather than the table absorb an additive change, so adding a field is not a migration
- Snapshotting a cited decision at the moment it is made, the same reason an invoice stores line item prices rather than joining to a live price list
- Hard delete over soft delete, so "the photo left the device" is a checkable claim rather than a flag
- Explicit error values over exceptions for expected failures, already the proxy's convention in this project

**Links** (web verified during this design conversation; here for a human to follow, not to be fetched again):

- Expo SDK 57, `expo-sqlite`: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- Expo SDK 57, `expo-file-system`: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
- Expo SDK 57, `expo-image-manipulator`: https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/
