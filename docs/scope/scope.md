# Scope: Recyclens

An Android app that tells you whether a piece of damaged or faded packaging is recyclable where you live, and shows you the reasoning behind the answer instead of just handing you a label.

**Build approach:** Journey (one complete user path finished, states and polish included, before the next path starts).
**Workflow:** Alpha (after `/develop`, run `/check verify` on the real app). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | Packaging vision read | Foundation | in-progress |
| 4 | Local recycling rule set | Foundation | done |
| 5 | Data model | Foundation | in-progress |
| 6 | Design system & UI foundation | Foundation | in-progress |
| 7 | Walking skeleton | Skeleton | in-progress |
| 8 | Capture a photo | Journey 1 | planned |
| 9 | The verdict screen | Journey 1 | in-progress |
| 10 | Waiting and failure states | Journey 1 | planned |
| 11 | Scan history list | Journey 2 | planned |
| 12 | Past scan detail | Journey 2 | planned |
| 13 | Learned second opinion | Learned stage | in-progress |

## Foundations

### 1. Stack & architecture · Beta
Decide what the app is built with and how the phone reaches the vision service, then scaffold a project that actually runs.
**Done when:** the stack is recorded in a spec, and an empty app builds and launches on a real Android device or an emulator.
spec [0001](../specs/0001-stack-and-architecture/index.md) · code in `src/`, `proxy/`
- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack & architecture`

### 2. Coding standards & tooling
Capture the conventions from the real scaffolded project, then install the lint, format, and check tooling every later feature has to pass.
**Done when:** root `AGENTS.md` reflects the real stack, and lint and format run clean on the scaffold.
code in `prettier.config.js`, `.prettierignore`, `eslint.config.js`, `package.json`
- [x] Capture conventions + tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`

### 3. Packaging vision read · Beta
The engine. A photo goes out and a fixed set of named observations comes back: the likely material, whether a recycling symbol is present and readable, whether more than one material is joined together, and how usable the photo was.
**Done when:** one photo returns that fixed set of attributes with a confidence on each, and the attribute vocabulary is written down so the rules and the screens can both rely on it.
spec [0003](../specs/0003-packaging-vision-read/index.md) · code in `proxy/api/`, `src/vision/`, `src/components/`, `scripts/check-photoset.mjs`
- [x] Design it (spec): `/architect packaging vision read`
- [ ] Build it: `/develop packaging vision read`
  - [x] The schema and the prompt in place: six enums, the `packagingFound` union, the bands, and a prompt that asks for observations only (AC-1, AC-2, AC-5, AC-6, AC-7)
  - [x] The Gemini call returns validated, normalised attributes, with `store: false` and one retry (AC-1, AC-2, AC-3, AC-4, AC-5, AC-10)
  - [x] Every failure has its own code, both attempts share one 25 second deadline, and each request is logged (AC-7, AC-8, AC-9, AC-11, AC-12)
  - [ ] Deployed, `maxDuration` confirmed, and the whole engine proved with one `curl` (AC-1, AC-9) — needs your Vercel account and your Gemini key, so it is yours to run
  - [ ] The app migrated to the six attribute shape, unit tests written, and the photo set shot and run (AC-13, AC-14, AC-15) — app migrated and 67 unit tests pass; the photo set needs a camera, the runner and its README are ready
- [ ] Verify it: `/check verify packaging vision read`
- [ ] Test it: `/test packaging vision read`

### 4. Local recycling rule set
One region's rules, written down as data, that turn a set of attributes into recyclable, not recyclable, or check manually. This is what makes the verdict defensible instead of a guess.
**Done when:** the region is named, its rules live as data the app reads, each rule carries the source it came from, and the point where the app stops guessing and says check manually is defined.
spec [0004](../specs/0004-local-recycling-rule-set/index.md) · code in `src/rules/`, `src/vision/`, `src/components/rule-card.tsx`
- [x] Design it (spec): `/architect local recycling rule set`
- [x] Build it: `/develop local recycling rule set`
  - [x] The output contract widened and one real answer travelling end to end: `AppliedRule.source` reshaped, the engine, and a rule set carrying the no match record plus one rule (AC-1, AC-7, AC-11)
  - [x] The four stop checks running ahead of the rules, with the deciding score threshold as one named constant (AC-4)
  - [x] Confidence as the weakest link, the composed action with its single rinse clause, and the note fallback chain (AC-8, AC-9, AC-10)
  - [x] The full rule set written: one rule per material code, ordered specific to general, each carrying a real cited source and an honest scope (AC-2, AC-3, AC-6, AC-13, AC-15)
  - [x] The rule set validation test and the engine unit tests, no network and no device (AC-5, AC-12, AC-14)
- [x] Verify it: `/check verify local recycling rule set`

### 5. Data model
What a scan is once it is saved on the phone: the photo, the attributes that came back, the rule that fired, the verdict, the confidence, the time.
**Done when:** a scan can be saved, listed, reopened, and deleted on the device, and adding a new attribute later does not break scans saved before it existed.
spec [0006](../specs/0006-saved-scan-data-model/index.md) · code in `src/db/`, `src/store/`, `src/vision/types.ts`, `src/rules/engine.ts`, `src/app/dev-data.tsx`
- [x] Design it (spec): `/architect data model`
- [ ] Build it: `/develop data model`
  - [x] The pure core, all testable on `node --test`: the schema and its `user_version` migration list, the widened types, the rule id carried out of `decidingRecord()`, and the tolerant payload reader (AC-4, AC-5, AC-6, AC-7, AC-15, AC-16, AC-17)
  - [ ] The write path: the database opens and migrates on device, and a scan saves with its photo copied before the row is inserted and cleaned up if the insert fails (AC-1, AC-11, AC-13, AC-14) — written and typechecking, and the migration and the insert were proved against real SQLite; `expo-sqlite`, the photo copy and `expo-crypto` have never actually run, so this one needs your phone
  - [ ] The read paths and delete: `getScan`, the summary only `listScans`, `deleteScan` removing row then file, and the startup orphan sweep (AC-1, AC-8, AC-9, AC-10, AC-18) — written, and both selects and the delete statement were proved against real SQLite; the file deletes and the sweep need your phone
  - [x] The Zustand store and the throwaway `dev-data` route, with save, list, reopen and delete confirmed on the real device (AC-2, AC-3, AC-12) — all four confirmed on a real Android device on 2026-10-14, surviving a cold restart
- [ ] Verify it: `/check verify data model`

### 6. Design system & UI foundation
The Apple inspired visual language and the shared pieces every screen is built from: colour, type, spacing, the verdict card, the attribute row, buttons, and the three outcome states.
**Done when:** `design.md` covers colour, type, spacing, and the core components; the three verdicts are told apart by more than colour alone; and the base components survive large text and keyboard focus.
spec [0002](../specs/0002-design-system-ui-foundation/index.md) · code in `src/`, `scripts/check-tokens.mjs`, `docs/design.md`
- [x] Design it (spec): `/architect design system & UI foundation`
- [ ] Build it: `/develop design system & UI foundation`
  - [x] Tokens, the `cn()` merge helper and the drift check in place, and the app locked to light (AC-1, AC-2, AC-3, AC-8)
  - [x] The shared verdict module and the Journey 1 primitives built, and the hand copied inline versions replaced (AC-3, AC-4, AC-7, AC-10)
  - [x] The eight existing components retrofitted to the contract and the new tokens (AC-1, AC-2, AC-3, AC-6, AC-7)
  - [ ] The tab bar swapped to the JS navigator, and the large text and focus sweeps passed on the real device (AC-4, AC-5, AC-6, AC-9) — navigator swapped and it bundles; the two sweeps need the phone
  - [x] Unused packages and native colours cleaned up, `docs/design.md` written, and the superseded Figma prompt and screenshots marked (AC-11, AC-12, AC-13, AC-14)
- [ ] Verify it: `/check verify design system & UI foundation`

## Skeleton

### 7. Walking skeleton · Beta
One photo travels from the phone to the vision service and its raw attributes land back on screen, ugly and unstyled. This proves the whole chain is connected before a single real screen is built.
**Done when:** you can take one photo on a real device and see real attributes returned by the service rendered on screen.
code in `src/vision/`, `src/app/dev-scan.tsx`
- [ ] Build it: `/develop walking skeleton`
  - [x] The spec 0003 vocabulary promoted to runtime values, each type derived from its own list so a list and the type it mirrors can no longer drift apart
  - [x] The parts that outlive the skeleton: `prepare.ts` downscales and encodes the photo, `client.ts` makes the one call the app ever makes, `validate.ts` refuses a body that does not match the contract, `errors.ts` names every way it can fail
  - [x] The throwaway `dev-scan` route, reporting all four stages separately so a broken chain names its own weak link, reached from a dev only link on Scan
  - [ ] One real photo run end to end on your phone against your deployed proxy — written, typechecking and unit tested, but it needs the feature 3 deploy and your device, so this one is yours to run
- [ ] Verify it: `/check verify walking skeleton`
- [ ] Test it: `/test walking skeleton`

## Journey 1: Scan a piece of packaging and get an answer you trust

The core recurring action, built all the way through. Every step and every state of this path is finished before the history journey exists at all.

### 8. Capture a photo
Open the camera, frame the packaging, take the shot, or pick one from the gallery instead. Includes asking for the camera, surviving a refusal, and letting you retake a bad shot.
**Done when:** you can capture or pick a photo, look at it before sending, retake it, and the app still behaves sensibly when camera permission is refused.
- [ ] Build it: `/develop capture a photo`

### 9. The verdict screen
The heart of the product: the answer, then what it saw, then the rule that turned one into the other. Three outcomes, recyclable, not recyclable, and check manually, each explained in plain words a non expert can follow.
**Done when:** every verdict shows the attributes it read, the named rule it applied, and its confidence; the check manually outcome says what was missing and what to try next; and nothing on screen claims more certainty than the attributes support.
spec [0007](../specs/0007-verdict-screen/index.md) · code in `src/screens/result/`, `src/components/`, `src/app/result/`, `src/app/photo.tsx`, `src/vision/types.ts`, `src/rules/engine.ts`, `src/db/`
- [x] Design it (spec): `/architect the verdict screen`
- [ ] Build it: `/develop the verdict screen`
  - [x] The contract and the engine, all testable on `node --test`: `bandFor`, the `confidenceBand` and `decidedOn` fields, and `scope` no longer stripped out of the verdict (AC-2, AC-4, AC-6, AC-17)
  - [x] The migration and the round trip through storage: two nullable columns written and read back, and a row saved before them still opening (AC-12, AC-18) — both migrations also run in order against real SQLite, with a row written at version 1 surviving the upgrade
  - [x] The pieces: the confidence chip, the authority chip, the reads disclosure with its promoted and toned rows, the not recorded row, and the tappable citation (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7)
  - [x] The screen itself: the new order, the stack header, the photo and its full screen viewer, and the check manually treatment with its next step button (AC-8, AC-9, AC-10, AC-11)
  - [ ] The entry states and the accessibility sweep on the real device: the unsaved route, the reopened meta and staleness line, the model line, the arrival announcement, 48dp, large text, motion, and a clean token check (AC-13, AC-14, AC-15, AC-16, AC-19) — all of it written, bundling and token clean; the four sweeps (screen reader, 48dp, largest font, motion) need your phone, so this one is yours to run
- [ ] Verify it: `/check verify the verdict screen`

### 10. Waiting and failure states
Everything between taking the photo and reading the answer, and everything that can go wrong on the way: thinking, no network, the service failed, nothing recognised in the photo.
**Done when:** every failure has its own screen state with a way forward, and no failure leaves a spinner running or a blank screen behind.
- [ ] Build it: `/develop waiting and failure states`

## Journey 2: Look back at what you scanned

Starts only once journey 1 is genuinely finished, polish and edge states included.

### 11. Scan history list
Every past scan held on the device, newest first, each with its photo, its verdict, and when it happened.
**Done when:** a scan appears in the list straight after you take it, survives closing and reopening the app, and the empty state explains itself before you have scanned anything.
- [ ] Build it: `/develop scan history list`

### 12. Past scan detail
Reopen an old scan and read the whole answer again exactly as it was, or delete it for good.
**Done when:** a saved scan reopens with its original attributes, rule, and verdict intact, and deleting one also removes its photo from the device.
- [ ] Build it: `/develop past scan detail`

## Learned stage

Starts once journey 1 is genuinely finished, because the photos you label there are the training data. It does not depend on journey 2, so the two can run side by side if you want.

### 13. Learned second opinion · Beta
A trained model that reads the scores the vision stage produced and judges how far they can be trusted, then hands that judgment to the rule engine as one more input. The engine still picks the verdict and still names the document behind it.
**Done when:** a scan's scores pass through the trained model before the engine decides, the model is measured against the rule only baseline on a held out set of damaged packaging photos, and no verdict reaches the screen without the cited rule that backs it.
spec [0005](../specs/0005-learned-second-opinion/index.md) · code in `src/ml/`, `src/rules/`, `src/vision/types.ts`
- [x] Design it (spec): `/architect learned second opinion`
- [ ] Build it: `/develop learned second opinion`
  - [x] The contract widened and the gate in place with the model stubbed: `LearnedTrust`, the third parameter on `decideWith`, `gate-learned-unreliable` last among the gates, the `model` source scope, `src/ml/` with its scorer and the unavailable path, and the three fields feature 5 must store (AC-1 through AC-7, AC-14, AC-15)
  - [ ] The labelling kit and the dataset: the `ml/` scaffold, the gate survival audit on the first 50 photos, then 300 photos shot and independently labelled by two of you, with kappa reported (AC-8, AC-9, AC-16)
  - [ ] The training pipeline, reproducible and drift proof: gate survival filtering, group aware splitting, feature sets chosen by cross validation on the training split only, a fixed seed, and shared fixtures that stop the two extractors diverging (AC-10, AC-13, AC-17)
  - [ ] The evaluation and the shipped model: precision against the coverage matched baseline, both risk coverage curves, the threshold chosen as a named point, and the trained artifact swapped in for the stub (AC-11, AC-12)
- [ ] Verify it: `/check verify learned second opinion`
- [ ] Test it: `/test learned second opinion`

## Deferred

Out of scope for this build pass, kept here so the plan stays honest.

- **Privacy and camera note**: a plain screen saying what happens to a photo and why the camera is needed. Worth doing before anyone other than you uses this, because photos leave the device.
- **Accessibility pass**: contrast, tap target sizes, screen reader labels, large text. Note that spec 0002 already covers tap targets, large text and keyboard focus for the base components, so what is left here is screen reader labels and a whole app sweep.
- **App icon and splash artwork**: a drawn Recyclens mark replacing the Expo template icon, reusing the leaf in a rounded square that `AppHeader` already draws. Asset production rather than a decision · from spec 0002
- **Share or save a result**: send a verdict card out as an image or text.
- **Works offline on the phone**: no network needed, the reading happens on the device · needs a decision
- **More regions**: a second and third rule set and a way to pick between them · needs a decision
- **Your own trained vision model**: collect and label damaged packaging and train something that replaces the vision stage itself, rather than the learned stage over its scores that feature 13 now covers · needs a decision
- **Show what it looked at**: highlight the part of the photo the call leaned on · needs a decision
- **History pagination**: `listScans` reads every scan at once, which is right at the hundreds this build will hold and wrong at the thousands. The trigger is the history list feeling slow, not a date · from spec 0006
- **Rule set version ordering**: the verdict screen's staleness line compares rule set versions for equality, so it can say the rules changed but not whether they got stricter. Worth revisiting only if a rule ever changes in a way a past scan's reader needs ranked · from spec 0007
- **Usage analytics**: count scans, outcomes, and the point where people give up.

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow-up enrolled |
| `in-progress` (building) | `/develop` | milestone sub-boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre-workflow) and `dropped` (de-scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading (e.g. `· Beta`, `· Prototype`) sets that one feature's rigor above or below the project default; no tag inherits the default. It decides the feature's check boxes and each skill's next suggestion.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing (trust develop's own build time self check); **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
