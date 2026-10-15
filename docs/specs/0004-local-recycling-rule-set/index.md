# 0004. Turn six observations into a cited Pune verdict with a declarative rule set

**Date**: 2026-10-11
**Status**: Accepted

## Summary

Spec 0003 made a photo come back as six named observations. This spec turns those into one of three answers for Pune, India: recyclable, not recyclable, or check manually. The rules live as plain data in one bundled file, `src/rules/pune.json`, and every rule carries the document it came from, so an answer can always be traced to a source rather than to a model's opinion. A small pure function reads that file, runs a few stop checks first, then takes the first rule that matches. When it cannot stand behind an answer it says so, which is the product's actual claim.

## Requirements

**User stories**:

- As someone holding a yogurt tub in Pune, I want to be told whether it goes in the dry waste, so I stop guessing at the bin.
- As someone reading the answer, I want to see the rule and the document behind it, so I can check the app rather than trust it.
- As the person building feature 9 (the verdict screen), I want one typed result carrying the verdict, the action, the confidence, the rule and its source, so the screen renders a decision rather than assembling one.
- As the person building feature 10 (the failure states), I want "I cannot tell" to be a real, explained outcome rather than a missing answer.
- As you, maintaining this later, I want a wrong or unreachable rule to fail the test suite rather than go quietly dead in production.

**Acceptance criteria** (the contract, each one independently checkable):

- **AC-1**: `decide(read: VisionRead): Verdict` is pure. The same `VisionRead` always produces the same `Verdict`, with no network, no file system read at call time, no clock and no randomness.
- **AC-2**: The rule set lives in `src/rules/pune.json`, bundled with the app and never fetched. It carries `region` (which must equal `REGION.label` from `src/constants.ts`), a `version` string, and the three arrays `gates`, `rules` and `notes`. Nothing in the app writes to it.
- **AC-3**: Every gate and every rule carries a `text` in plain words a non expert can follow, and a `source` of `{ document: string; scope: 'pune' | 'maharashtra' | 'national' | 'general'; url?: string }`. `document` is never empty. `url` is present only where the page was confirmed to load, so a missing URL means a name only citation rather than a dead link.
- **AC-4**: Four stop checks run before any rule, in declared order, and each returns `checkManually`: `photoQuality` is `poor`; `material` is `unknown` or its `score` is below 50; `construction` is `multi_material`; `contamination` is `heavy_residue`.
- **AC-5**: When no gate fires, rules are evaluated top to bottom and the **first** match wins. A rule that can never be reached, because an earlier rule already matches everything it does, fails the test suite rather than sitting dead in the file.
- **AC-6**: Every one of the fourteen `material` codes spec 0003 declares is either matched by at least one rule or reached by a gate. No code the model can return falls through to the no match path by accident.
- **AC-7**: When no gate fires and no rule matches, the result is `checkManually` carrying a dedicated no match record, with its own `text` and `source`. The engine never returns a verdict with no rule attached.
- **AC-8**: `confidence` is the lowest `score` among **only** the attributes named in the matched record's `when`. An attribute the record does not name can neither raise nor lower it. A gate's confidence is the score of the attribute that tripped it.
- **AC-9**: `action` is the matched record's base action, with `, rinse it first` appended when `contamination` is `light_residue`, and nothing appended for `clean`, `unknown` or `heavy_residue`. The rinse wording exists in exactly one place in the code.
- **AC-10**: `note` is the `text` of the first matching entry in `notes`; if none matches, the proxy's `note` from the `VisionRead`; if neither exists, the field is absent. The screen never shows two caveats.
- **AC-11**: `AppliedRule.source` in `src/vision/types.ts` widens from `string` to `{ document: string; url?: string }`, and `src/vision/mock.ts` plus `src/components/rule-card.tsx` are updated so the app still typechecks and still renders the citation.
- **AC-12**: A test validates `pune.json` without a network call: every code in every `when` is a member of its spec 0003 enum, every `id` is unique across gates, rules and notes, `region` equals `REGION.label`, every rule is reachable (AC-5), and every gate and rule has a non empty `text` and `source.document`.
- **AC-13**: No rule, gate or note text names a collection service, a bin operator or a specific container. The vocabulary is dry waste versus wet waste only, because who collects it varies by ward and this build cannot verify that.
- **AC-14**: Unit tests cover each of the four gates, the no match fallthrough, first match ordering, the weakest link confidence at the 49 and 50 boundary, the rinse clause for each contamination code, and the full note fallback chain. No network, no device.
- **AC-15**: Every rule declares the `scope` of its authority. A rule resting on a national rule says `national`, not `pune`. A rule resting on general practice, because no document could be found, says `general`. A rule may never claim `pune` scope without a named Pune document behind it, and the AC-12 test asserts `scope` is one of the four declared values on every rule and gate.

## Decision

**Chosen option**: Option 1: A declarative JSON rule set with ordered first match evaluation, where the stop checks are data too.

Rules, stop checks and caveats all live as records in one bundled file with the same shape, each carrying its own plain words text and its own citation. A pure TypeScript function reads them in a fixed order and returns the first decision it can defend. Nothing about the verdict is expressed as code the user cannot trace back to a cited line of data.

**Implementation skills**: `react-native-best-practices` (`callstackincubator/agent-skills`, `.agents/skills/react-native-best-practices/`)

## Rationale

The reasoning, the options weighed and the sources sit in [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

No database table. This feature adds one bundled JSON file and one pure function. Feature 5 decides how a `Verdict` is later stored on a scan.

```ts
type Condition = {
  readonly material?: readonly MaterialCode[];
  readonly form?: readonly FormCode[];
  readonly recyclingSymbol?: readonly SymbolCode[];
  readonly construction?: readonly ConstructionCode[];
  readonly contamination?: readonly ContaminationCode[];
  readonly photoQuality?: readonly PhotoQualityCode[];
};
// An omitted key means "any value". A Condition with no keys matches everything,
// which is how the no match record is expressed without a special case.

/*
 * `scope` is load bearing, not decoration. The source check behind this spec
 * could not load a single quotable Pune document, so most rules will rest on
 * the national Rules instead. The field makes that visible on screen rather
 * than letting a national rule pass itself off as a municipal one.
 */
type SourceScope = 'pune' | 'maharashtra' | 'national' | 'general';
type Source = { readonly document: string; readonly scope: SourceScope; readonly url?: string };

type Gate = { readonly id: string; readonly when: Condition; readonly action: string; readonly text: string; readonly source: Source };
type Rule = Gate & { readonly verdict: VerdictKind };
type NoteRule = { readonly id: string; readonly when: Condition; readonly text: string };

type RuleSet = {
  readonly region: string;
  readonly version: string;
  readonly gates: readonly Gate[];
  readonly rules: readonly Rule[];
  readonly notes: readonly NoteRule[];
};
```

| Entity | Key fields | Required | Notes |
|---|---|---|---|
| `RuleSet` | `region`, `version`, `gates`, `rules`, `notes` | all | One per region. This build ships one, `pune.json` |
| `Gate` | `id`, `when`, `action`, `text`, `source` | all | Always yields `checkManually`, so it carries no `verdict` field |
| `Rule` | `Gate` fields plus `verdict` | all | Ordered specific to general; first match wins |
| `NoteRule` | `id`, `when`, `text` | all | Carries no source: it explains the engine, it does not assert a municipal rule |

`id` is unique across all three arrays, because a test asserts it and a trace prints it.

**State transitions**: none. `decide` is a pure function with no lifecycle.

**API surface**: no HTTP. The surface is three exported functions in `src/rules/`.

| Function | Inputs | Outputs | Errors |
|---|---|---|---|
| `decide(read: VisionRead): Verdict` | the proxy's 200 body | the full `Verdict` below | none; every input produces a verdict, `checkManually` in the worst case |
| `matchFirst<T extends { when: Condition }>(records: readonly T[], a: VisionAttributes): T \| undefined` | any record array plus the attributes | the first match | none |
| `matches(when: Condition, a: VisionAttributes): boolean` | one condition, the attributes | whether every named key matches | none |

`Verdict` is exactly the decision half of `Scan`, so feature 5 can spread it into a stored row:

```ts
type Verdict = {
  readonly verdict: VerdictKind;
  readonly action: string;
  readonly confidence: number;
  readonly rule: AppliedRule;   // { text, source: { document, url? } }
  readonly note?: string;
};
```

**Value sourcing** (every value the acceptance criteria need, and where it comes from):

| Action | Value produced | Source |
|---|---|---|
| `decide` | `verdict` | the matched gate implies `checkManually`; a matched rule carries `verdict`; no match uses the dedicated no match record (AC-7) |
| `decide` | `action` | the matched record's `action`, plus the rinse clause when `contamination.code` is `light_residue` (AC-9) |
| `decide` | `confidence` | the lowest `score` among the attributes named in the matched record's `when` (AC-8). `score` arrives on the wire from spec 0003 |
| `decide` | `rule.text` | the matched record's `text` |
| `decide` | `rule.source` | the matched record's `source`, carried through unchanged as `{ document, url? }` |
| `decide` | `note` | first matching `notes` entry, else `read.note` from the proxy, else absent (AC-10) |
| `decide` | the 50 threshold in the material gate | this spec. One exported constant, `MIN_DECIDING_SCORE`, provisional until the photo set runs |
| `decide` | the rinse clause wording | this spec. One exported constant, used by AC-9 so it exists once |
| `pune.json` | `region` | `REGION.label` in `src/constants.ts`, asserted equal by the AC-12 test |
| `pune.json` | every `document`, `scope` and `url` | the sources named in `rationale.md`. A rule may not ship with an invented citation, and `url` appears only for a page confirmed to load (AC-3, AC-15) |
| `pune.json` | `version` | hand bumped whenever a rule or a citation changes, so a stored scan can record which set judged it |
| screen | the citation link | `source.url` when present, nothing rendered when absent (AC-3, AC-11) |

**Key invariants**:

- A `Verdict` always carries a `rule`. There is no outcome without text and a citation (AC-7, AC-12).
- `confidence` never exceeds the lowest score the decision actually rested on (AC-8). Nothing on screen may claim more certainty than the attributes support.
- Gates always precede rules, so a confident looking material code can never outrank a poor photo or a joined construction (AC-4).
- The rule set is read only at runtime and identical for every user of a given build (AC-2).
- The rinse wording and the `MIN_DECIDING_SCORE` threshold each exist in exactly one place.

**Security model**: none to speak of. The rule set is public, non personal, bundled data, and the engine is a pure local function with no I/O. No authentication, no authorisation, no regulated data, no new attack surface. The only integrity concern is the honesty of the citations, which AC-12 guards structurally and a human must guard in substance.

**Configuration required**: none. No new environment variable, credential or third party account.

**Critical test scenarios** (each maps to a criterion above):

- Happy path: a clean rigid PET tub returns `recyclable`, the dry waste action with no rinse clause, confidence equal to the lower of the material and form scores, and the PET rule's text and citation. Verifies **AC-1**, **AC-8**, **AC-9**.
- Gate precedence: a confidently read PET tub in a `poor` photo returns `checkManually` from the photo gate, not `recyclable`. Verifies **AC-4**.
- Threshold boundary: a `pet` material at score 49 is gated to `checkManually`, and at 50 it is decided. Verifies **AC-4**, **AC-14**.
- Unreachable rule: a rule placed below a broader one that already matches it fails the suite. Verifies **AC-5**, **AC-12**.
- No match: a material code with no rule returns the dedicated no match record, with text and a citation. Verifies **AC-6**, **AC-7**.
- Note chain: an engine note wins over the proxy's note; with no engine note the proxy's shows; with neither the field is absent. Verifies **AC-10**.
- Drift: a `when` carrying a code that is not in spec 0003's enum fails the suite. Verifies **AC-12**.

## Build plan

Ordered by the project's **Journey** approach applied to a foundation feature: make one complete answer travel the whole path first, then widen it. Task 2 produces a working verdict for a single material, so every later task thickens something already proved rather than adding an untested layer.

1. Widen `AppliedRule.source` to `{ document, url? }` in `src/vision/types.ts`, add the `Verdict` type, and update `src/vision/mock.ts` and `src/components/rule-card.tsx` so the app still typechecks and still renders the citation. Satisfies **AC-11**.
2. Write `src/rules/types.ts` (`Condition`, `Source`, `Gate`, `Rule`, `NoteRule`, `RuleSet`) and `src/rules/engine.ts` with `matches`, `matchFirst` and `decide`, plus a `pune.json` carrying the no match record and exactly one real rule. Prove one answer end to end. Satisfies **AC-1**, **AC-7**.
3. Add the four gates to `pune.json` and run them ahead of the rules, with `MIN_DECIDING_SCORE` as one exported constant. Satisfies **AC-4**.
4. Implement `confidence` as the weakest link over the matched record's named attributes, and the composed `action` with its single rinse clause constant. Satisfies **AC-8**, **AC-9**.
5. Implement the `notes` array and the engine note then proxy note then absent fallback. Satisfies **AC-10**.
6. Write the full rule set: one rule per material code, with `form` and `construction` as conditions only where they change the answer, ordered specific to general, every rule carrying its real cited source and an honest `scope`. Satisfies **AC-3**, **AC-6**, **AC-13**, **AC-15**.
7. Write the rule set validation test: enum membership, unique ids, `region` equality, reachability, and non empty text and citation. Satisfies **AC-2**, **AC-5**, **AC-12**.
8. Write the engine unit tests: every gate, the no match fallthrough, ordering, the 49 and 50 boundary, every contamination code against the rinse clause, and the note chain. Satisfies **AC-14**.

## Consequences

**Positive**:

- Features 9 and 10 stop waiting. The verdict screen gets one typed object carrying everything it renders, and the failure states get a real `checkManually` outcome with an explanation rather than a blank.
- The product's actual claim becomes testable. "Defensible rather than a guess" stops being a slogan the moment every outcome must carry a cited document to pass AC-12.
- The stop checks being data, not code, means the reason the app declined to answer is itself quotable on screen, with the same shape as any other answer.
- Rules change by editing a reviewable JSON file in version control. A correction is a one line diff with its citation beside it, not a code change.
- A second region later is a second file and a different import, with no engine change. That keeps the deferred "more regions" item genuinely cheap.
- The engine is pure, so the highest risk logic in the product is testable with no device, no network and no quota.

**Negative and tradeoffs**:

- **The citations are only as good as the sourcing, and that work is manual and unglamorous.** AC-12 can prove a `document` string is non empty; nothing automated can prove it says what the rule claims. This is the one place the product can be quietly wrong while every test passes.
- **The 50 threshold is a guess dressed as a number.** Spec 0003 already warned that the bands are unmeasured, and the first live run returned 85 and above on every attribute of a clear photo. Until the photo set runs, the material gate may almost never fire, which would make `checkManually` rarer than it should be.
- **First match ordering makes the file position meaningful.** A rule added in the wrong place silently changes answers above it. The reachability test catches a fully shadowed rule but not a partially shadowed one, which is the subtler and more likely mistake.
- Widening `AppliedRule.source` touches a type and a component feature 6 already built and verified. Spec 0002 predicted exactly this second pass, which does not make it free.
- Generic dry versus wet wording is less useful than naming where the item actually goes. It is the honest choice given this build cannot verify per ward collection, but a user still has to know what their dry waste stream is.
- Treating heavy residue as `checkManually` will frustrate someone holding an obviously recyclable but dirty bottle. That is the deliberate cost of not overclaiming.
- One rule per material code means roughly fourteen citations to find, and some materials have no Pune specific guidance at all, so those rules will rest on national rules instead.

**Neutral**:

- `src/vision/mock.ts` needs its `source` field reshaped and its "Kerbside bin" action rewording. It was always labelled scaffolding for feature 7 to replace.
- The engine has no state machine, no persistence and no configuration, so it adds nothing to the app's startup cost or bundle beyond one JSON file of a few kilobytes.
- `notes` carries no citation, unlike gates and rules, because a note explains the engine's own reasoning rather than asserting a municipal rule.

## Follow-up

- [ ] **Retune `MIN_DECIDING_SCORE` once spec 0003's photo set runs.** It ships at 50 as a placeholder. The photo set is the only thing that can tell you whether the model's self reported scores ever fall low enough for this gate to fire.
- [x] `src/vision/mock.ts` says "Kerbside bin, rinse it first", which AC-13 now forbids. Reword it when task 1 touches the file. Done: it now reads "Dry waste, rinse it first", confirmed rendering on the device.
- [ ] `RuleCard` renders the citation as plain text. Once `source.url` exists, decide whether it becomes a tappable link, which is a feature 9 question about how much the verdict screen should do.
- [ ] Decide with feature 5 whether a stored scan records the `version` of the rule set that judged it. Without it, reopening an old scan may show a verdict the current rules would no longer give.
- [ ] A partially shadowed rule passes the reachability test. If the rule set grows past roughly twenty rules, consider promoting ambiguity to a build error.
- [ ] **The Pune specific sourcing is the biggest open risk in this feature, bigger than any code in it.** The check run for this spec could not load a single quotable rule document from PMC, SWaCH or CPCB. If you can reach PMC's solid waste department or SWaCH directly for a current dry waste acceptance list, that one document would move most rules from `national` scope to `pune` and is worth more to the product than any further engineering.
- [ ] Decide how feature 9 renders a `general` or `national` scope citation. A rule the app cannot source to Pune should probably look different on screen from one it can, or the scope field buys nothing.
- [ ] The scope's deferred "more regions" item is now cheap by construction. Worth noting there that the engine already supports it and only the file and the import would change.
