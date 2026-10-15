# 0007. Compose the verdict screen as the answer, then the cited rule, then the reads

**Date**: 2026-10-13
**Status**: In Progress

## Summary

The verdict screen leads with the answer, follows it immediately with the rule and the document that produced it, and keeps the six observations underneath, with the ones the rule actually leaned on expanded and the rest behind one control. Confidence stops being a percentage and becomes a band word, because a gate that fires on a bad photo was printing "95% confident" next to "Check manually". The citation becomes tappable and carries a chip saying how far its authority reaches, so a national rule can no longer pass itself off as a municipal one. Three contract changes and one small migration make all of that possible, and the same screen serves a fresh scan, a scan reopened months later, and a scan that could not be saved.

## Requirements

**User stories**:

- As someone holding a piece of damaged packaging, I want the answer first and the reasoning right behind it, so that I can act in two seconds or read for thirty.
- As someone who does not believe the answer, I want to open the document it came from, so that I can check it rather than trust it.
- As someone the app refused to answer for, I want to know which observation let it down and what to do about it, so that the refusal is useful rather than a dead end.
- As someone reopening a scan from weeks ago, I want it to say exactly what it said on the day and tell me if the rules have changed since, so that an old answer cannot quietly mislead me.

**Acceptance criteria** (the contract, each independently checkable):

- **AC-1**: Every verdict renders the verdict word, its icon, its colour and its one line action, all read from `src/components/verdict.ts`. A greyscale screenshot still tells the three verdicts apart.
- **AC-2**: The verdict's confidence renders as a band word, never a percentage. The band is derived from `Verdict.confidence` at the thresholds spec 0003 already fixes (high at 80, medium at 50). The chip is omitted entirely when the deciding record named no attribute, so a no match never renders "0% confident".
- **AC-3**: On a decided verdict the chip reads as confidence in the answer; on a check manually it reads as confidence in the blocking read, because that is what the number measures there.
- **AC-4**: Every verdict shows all six reads. The attributes the deciding record named are expanded and carry a confidence tone by band; the remaining reads sit behind one disclosure control that reveals them in place. When the deciding record named no attribute, all six open by default.
- **AC-5**: A read absent from a stored scan renders as its own row saying it was not recorded, with no value and no confidence bar.
- **AC-6**: Every verdict shows the rule that fired, its text, the document it came from, and a chip naming that document's authority scope.
- **AC-7**: A citation carrying a url is tappable and opens that document in an in app browser that returns to the verdict on close. A citation with no url is plain text and is not tappable.
- **AC-8**: On a check manually the screen names which attribute blocked the answer, taken from the deciding record's own condition, and shows that record's reasoning and its action.
- **AC-9**: On a check manually whose next step is something the app can perform, a second action button performs it. Where the next step is a real world action the app cannot take, only the primary action shows.
- **AC-10**: The screen reads top to bottom as answer, then rule, then reads. The photo is a small thumbnail that opens full screen on tap, and falls back to a placeholder tile when the file is gone.
- **AC-11**: The screen uses the Expo Router stack header. Back swipe and tap to scroll to top work, no screen body draws its own bar, and the safe area inset is not applied twice.
- **AC-12**: A reopened scan shows when it was scanned, the region, and the rule set version that judged it, plus one line when the bundled rule set version differs from the one recorded on the row.
- **AC-13**: A scan that could not be saved still shows its verdict in full, from memory, with a line saying it is not in history.
- **AC-14**: On arrival a screen reader announces the verdict word, its action and its confidence as one announcement. The disclosure control reports its expanded state.
- **AC-15**: Every colour, size, spacing step and radius comes from `src/global.css`, `npm run check:tokens` passes, and nothing tappable is under 48dp in either dimension.
- **AC-16**: At the largest system font size every row reflows rather than truncating, and no text is clipped. `allowFontScaling` is never disabled.
- **AC-17**: `Verdict` carries `confidenceBand` and `decidedOn`, and `RuleSource` carries `scope`. All three come from the same record selection that produced the verdict, so the screen and a stored scan can never disagree.
- **AC-18**: `MIGRATIONS[1]` adds `rule_source_scope` and `decided_on` as nullable columns. A scan saved before it opens without error, showing no authority chip and no promoted rows.
- **AC-19**: The learned model is named on screen only when its gate is what produced the verdict. A trust score is never rendered, in any state.

## Decision

**Chosen option**: Option 2: answer, cited rule, then reads behind a disclosure, with the deciding attributes promoted.

The screen leads with the verdict, puts the rule and its citation directly underneath as the reasoning, and keeps all six observations below that with only the load bearing ones open, so the product's claim that you can read its reasoning is answered in one scroll rather than six.

**Implementation skills**: `apple-ui-design` (`.claude/skills/apple-ui-design/`) · `expo-router` (`expo/skills`, `.agents/skills/expo-router/`) · `expo-design-system` (`expo/skills`, `.agents/skills/expo-design-system/`) · `react-native-best-practices` (`callstackincubator/agent-skills`, `.agents/skills/react-native-best-practices/`) · `expo-project-structure` (`expo/skills`, `.agents/skills/expo-project-structure/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

### Where the apple-ui-design skill applies, and where it does not

The skill was invoked for this screen and its principles drive the composition: content leads and chrome recedes, one primary action, progressive disclosure over everything visible, generous whitespace, 44dp targets (this project already demands 48dp, which is stricter), and 4.5:1 contrast.

Three of its specifics are already settled against in this repo, deliberately and with reasons written down. `/develop` must not import them:

| The skill says | This project does | Why |
|---|---|---|
| Apple's published palette (`#86868b`, `#0071e3`) | the measured values in `src/global.css` | Apple's own secondary grey scores 3.62:1 on white and fails the 4.5:1 bar; every value here was darkened until it passed |
| `--text-hero: 48px` | `--text-verdict: 34px`, Apple's iOS scale | a 48px hero on a 360px phone is a wrapping mess, not a hero |
| dark mode variables | locked to light in `app.json` | spec 0002 accepted that cost for the deadline rather than claiming it was fine |

`backdrop-filter`, `box-shadow` and `:hover` from the skill's card and button patterns have no React Native equivalent on Android, and design.md's separation strategy is hairlines rather than shadows. Press feedback dims, it does not ripple.

### Data model sketch

Three contract fields and one migration. Nothing else in the data model changes.

| Change | Where | Type | Required | Why |
|---|---|---|---|---|
| `Verdict.confidenceBand` | `src/vision/types.ts`, produced in `engine.ts` | `ConfidenceBand` | required | the card shows a band, computed once in the engine so the product has one definition of a band |
| `Verdict.decidedOn` | `src/vision/types.ts`, produced in `engine.ts` | `readonly AttributeKey[]` | required, may be empty | which attributes the deciding record named; drives the promoted rows, the chip's presence and the culprit on a check manually |
| `RuleSource.scope` | `src/vision/types.ts`; `engine.ts` stops stripping it in `sourceFrom` | `SourceScope` | required | the authority chip |
| `scan.rule_source_scope` | `MIGRATIONS[1]` | `TEXT` | nullable | a reopened scan still shows the authority it was judged under |
| `scan.decided_on` | `MIGRATIONS[1]` | `TEXT`, a JSON array of attribute keys | nullable | a reopened scan promotes the rows that actually decided it, even after `pune.json` has been edited since |

`confidenceBand` is deliberately **not** stored. It is derivable from the `confidence` number already on the row at fixed thresholds, so a stored copy would be a second source of truth that can disagree with the first.

`decided_on` **is** stored, and that is a deliberate exception to the rule against storing derived values. It is not stored for speed. It is stored because spec 0006's whole premise is that a scan reopened in a month says exactly what it said on the day, and recomputing it from the rule id against a `pune.json` that has been edited since would silently promote the wrong rows.

Both columns are nullable because `ALTER TABLE ADD COLUMN` cannot add a `NOT NULL` column without a default, and there is no honest default: a row written before this migration genuinely does not know its scope or its deciding attributes.

### State transitions

The screen resolves into exactly one of four states and never moves between them:

```
mount
  |- /result/[id]      -> loading -> ready(stored)      a fresh scan, or one reopened from history
  |                               -> unreadable         row_not_found, row_unreadable, db_unavailable
  |- /result/unsaved   -> ready(memory)                 the engine answered, the save failed
  |
  ready(*) holds one nested toggle:  reads collapsed <-> reads expanded
```

`ready(stored)` and `ready(memory)` render the identical body. They differ only in where the scan came from and in the one line `ready(memory)` adds saying it is not in history.

### Surface

This is a screen, so the surface is routes and the functions behind them rather than endpoints. There is no network call and no authentication anywhere on this path: every byte is already on the device.

| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/result/[id]` | route | `id: string` (req) | the verdict screen, state `ready(stored)` | none, device local | `row_not_found`, `row_unreadable`, `db_unavailable`, all three rendering `unreadable` |
| `/result/unsaved` | route (static, so it wins over `[id]`) | none, reads the store's `pending` slot | the verdict screen, state `ready(memory)` | none | `pending` empty, which can only happen on a direct deep link, so it redirects to Scan |
| `/photo` | route, `presentation: 'modal'` | `uri: string` (req) | the photo full screen | none | file missing, rendering the placeholder tile |
| `useScans.open(id)` | store function | `id: string` | `Result<Scan>` | none | the three database codes above |
| `useScans.pending` | store slot | written by the save path when the insert fails | the verdict, the read and the photo uri, or undefined | none | none |
| `decide(read)` | pure function | `VisionRead` | `Verdict`, now carrying `confidenceBand` and `decidedOn` | none | none, it is total, every read yields a verdict |
| `WebBrowser.openBrowserAsync(url)` | Expo SDK | `url: string` | returns to the verdict on close | none | no browser available, which leaves the citation as plain text |

### Value sourcing

Every value this screen displays, and where it comes from. The two that had no source before this spec are marked **new**.

| Action | Value produced or displayed | Source |
|---|---|---|
| render the answer | verdict word, icon, colour, tint | `VERDICT[kind]` in `src/components/verdict.ts` (spec 0002) |
| render the answer | the one line action | `Verdict.action`, composed with the rinse clause in `engine.ts` (spec 0004) |
| render the answer | the confidence band word | **new** `Verdict.confidenceBand`, computed in `engine.ts` from `Verdict.confidence` by a new `bandFor` in `src/vision/types.ts`, mirroring `BANDS` in `proxy/api/schema.ts` (high at 80, medium at 50) |
| render the answer | whether the chip appears at all | `Verdict.decidedOn.length > 0` |
| render the answer | the chip's noun, answer or read | `Verdict.verdict`, through one record in the screen layer |
| promote the reads | which attributes the rule leaned on | **new** `Verdict.decidedOn`, the keys of the deciding record's `when`, taken from the same `decidingRecord` selection the verdict came from; `scan.decided_on` for a stored scan |
| promote the reads | a promoted row's tone | `DisplayAttribute.confidence` mapped to `ConfidenceTone` (spec 0002) |
| render a read | the caption | `ATTRIBUTE_LABEL[key]` (spec 0003) |
| render a read | the read itself | `DisplayAttribute.display`, written by the proxy and guaranteed 60 characters or fewer (spec 0003) |
| render a read | the icon | `ICONS[key]` in `attribute-row.tsx` (spec 0002) |
| render a read | not recorded | the key being absent from `StoredDisplayAttributes` (spec 0006) |
| render the rule | the rule text | `AppliedRule.text` |
| render the rule | the document name | `AppliedRule.source.document`, with the learned template already filled in `src/rules/index.ts` |
| render the rule | the authority chip label | **new** `RuleSource.scope`, no longer stripped by `sourceFrom`; the label for each of the five scopes comes from one record in the screen layer; `scan.rule_source_scope` for a stored scan |
| render the rule | the link target | `AppliedRule.source.url`, present only where the page was confirmed to load (spec 0004, AC-3) |
| check manually | which attribute blocked it | `Verdict.decidedOn`; empty for the learned gate and the no match rule, which then promote nothing and open all six |
| check manually | the next step button's label and action | a record keyed by `AppliedRule.id` in the screen layer; only ids whose next step the app can itself perform carry an entry |
| reopened scan | when it was scanned | `Scan.scannedAt` |
| reopened scan | the region | `Scan.region` |
| reopened scan | the rule set version that judged it | `Scan.ruleSetVersion` |
| reopened scan | the staleness line | `Scan.ruleSetVersion` compared for equality against `PUNE_RULES.version` from `src/rules/index.ts` |
| unsaved scan | the verdict and the reads | `useScans.pending`, never the database |
| unsaved scan | the region and the rule set version | `REGION.label` in `src/constants.ts` and `PUNE_RULES.version` |
| the photo | thumbnail and full screen | `Scan.photoUri` |
| the photo | the fallback when the file is gone | the existing placeholder tile in `result/index.tsx` |
| the model line | whether its gate fired | `Scan.gateFired` for a stored scan; `AppliedRule.id === LEARNED_GATE_ID` for an unsaved one |
| the item name | what was scanned | `Scan.itemName` |
| the caveat | the note under the reads | `Verdict.note`, the engine's own note winning over the proxy's (spec 0004) |

### Key invariants

1. **Nothing claims more certainty than the attributes support.** A band word rather than a percentage, no chip where no attribute was named, neutral tone on any read the rule did not lean on, and `DisplayAttribute` still has no `score` field so a raw number cannot reach a screen even by mistake.
2. **A verdict is carried by an icon and a word and a colour, always all three.** One record in `verdict.ts`, no component keeps a copy.
3. **Every outcome shows the record that produced it and the document behind it.** There is no state on this screen with an answer and no citation.
4. **The learned model may only ever hold an answer back.** It appears on screen only where its own gate is the reason, and its trust score is never rendered.
5. **A reopened scan says what it said on the day.** Every value it shows comes from its row, never from the current `pune.json`, with the single exception of the staleness comparison, which exists precisely to surface the difference.
6. **A storage failure never swallows an answer.** `ready(memory)` is the reason this holds.

### Security model

No accounts, no roles, no network on this path. Every scan is private to the device and readable only by this app, under its private storage. The only two rules that matter here are both already structural: the screen is handed `Scan`, whose attributes are `StoredDisplayAttributes` with every score dropped by `toDisplayScan`, and the learned trust score is never rendered in any state. No regulated data, so no compliance scope applies. The one outbound action in the whole feature is opening a citation url that shipped inside the build, never a url from a scan or from the model.

**Configuration required**: none. This feature adds no environment variable, secret or credential.

### Critical test scenarios

- Happy path: a recyclable verdict renders its word, icon, colour, action and band, with the attributes the rule named expanded and toned and the rest behind the disclosure, verifies **AC-1**, **AC-2**, **AC-4**.
- Reasoning: the rule card shows its text, its document and its scope chip, and tapping a citation with a url opens the in app browser and returns, verifies **AC-6**, **AC-7**.
- Refusal: a poor photo gate names photo quality as the blocking read, shows the gate's reasoning, and offers a second button that returns to the camera, verifies **AC-8**, **AC-9**.
- No attribute named: the learned gate and the no match rule each render with no confidence chip, no promoted rows and all six reads open, verifies **AC-2**, **AC-4**.
- Forward compatibility: a row written before `MIGRATIONS[1]` opens with no authority chip and no promoted rows and does not error; a payload missing a key renders that row as not recorded, verifies **AC-5**, **AC-18**.
- Storage failure: an insert that fails still lands on a full verdict from memory with the not in history line, verifies **AC-13**.
- Staleness: a scan whose `rule_set_version` differs from the bundled one shows the extra line; one that matches does not, verifies **AC-12**.
- Accessibility: arriving announces the verdict, action and band as one; the disclosure reports expanded and collapsed; every control measures 48dp; the largest font size wraps every row without clipping, verifies **AC-14**, **AC-15**, **AC-16**.
- Contract: `decideWith` returns a band and a `decidedOn` consistent with the record `decidingRecord` chose, for a gate, a matched rule and the no match rule, verifies **AC-17**.

## Build plan

Ordered by the Journey approach this project runs: feature 9 is a step inside Journey 1, so all three outcomes, their states and their polish finish together. There is no slice here that ships recyclable now and check manually later, because a refusal is the outcome this screen exists to make useful.

Tasks 1 and 2 are pure and reach `node --test` with no device. Everything from 3 onwards needs the phone.

1. Add `bandFor` to `src/vision/types.ts`, mirroring `BANDS` in `proxy/api/schema.ts`, and widen `Verdict` with `confidenceBand` and `decidedOn`, satisfies **AC-17**, **AC-2**.
2. Produce all three in `engine.ts` from the one `decidingRecord` selection: the band from the composed confidence, `decidedOn` from the deciding record's `when` keys, and `scope` by stopping `sourceFrom` from dropping it. Extend `engine.test.ts` across a gate, a matched rule and the no match rule, satisfies **AC-17**, **AC-2**, **AC-4**, **AC-6**.
3. Add `MIGRATIONS[1]` with `rule_source_scope` and `decided_on` nullable, write both on save, read both back in `map.ts` tolerating absent, and extend `map.test.ts` with a pre migration row, satisfies **AC-18**, **AC-12**.
4. Build the two new presentational pieces, `ConfidenceChip` (band word, noun by verdict kind, absent when nothing was named) and `ScopeChip` (the five authority labels), and retrofit `VerdictCard` to the chip while keeping its word, icon and colour coming from `verdict.ts`, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-6**.
5. Build the reads section: the promoted rows with their tone, the disclosure control holding the rest, the all six open case, and `AttributeRow`'s not recorded state, satisfies **AC-4**, **AC-5**.
6. Retrofit `RuleCard`: the scope chip, and the citation tappable through `expo-web-browser` when a url exists and plain text when not, satisfies **AC-6**, **AC-7**.
7. Recompose the screen body in the new order, answer then rule then reads, and move the header to the Expo Router stack header by flipping `headerShown` on `result/[id]` in `src/app/_layout.tsx` and dropping the `top` safe area edge so the inset is not applied twice, satisfies **AC-10**, **AC-11**.
8. Build the photo thumbnail, the `/photo` modal route, and the placeholder fallback when the file is gone, satisfies **AC-10**.
9. Build the check manually treatment: the blocking attribute named from `decidedOn`, the gate's reasoning, and the next step record that turns an app performable action into a second button, satisfies **AC-8**, **AC-9**.
10. Add the `pending` slot to the scans store and the `/result/unsaved` route, and have the save path populate it on failure, satisfies **AC-13**.
11. Add the reopened scan meta line, the staleness comparison against `PUNE_RULES.version`, and the model line shown only when the learned gate fired, satisfies **AC-12**, **AC-19**.
12. Accessibility and polish on the real device: the arrival announcement, the disclosure's expanded state, the 48dp sweep, the largest font size sweep, the entrance and disclosure motion at `duration-250` honouring reduce motion, and `npm run check:tokens` clean, satisfies **AC-14**, **AC-15**, **AC-16**.

## Consequences

**Positive**:

- The answer leads and the reasoning is one glance behind it, which is the product's actual claim rather than a pile of six observations the reader has to synthesise.
- A citation becomes checkable rather than decorative, and an authority chip stops a national rule reading as a municipal one. That is the difference between a defensible answer and a confident one.
- A refusal stops being a dead end: it names what let it down and, where the app can act, offers the action as a button.
- Three debts other specs explicitly handed here are closed in one pass: the hand drawn header, the misleading percentage chip, and the stripped `scope` field.
- Feature 12 gets its screen almost free, because a reopened scan is the same screen with two extra lines.

**Negative and tradeoffs**:

- Five of six reads are hidden by default. That is a real information cost and a different reviewer would call it the wrong call on a product whose whole pitch is showing its working. The promotion rule is what makes it defensible: the reads that decided the answer are never the hidden ones.
- `decided_on` stores a derived value, against the general rule. It is accepted deliberately, for durability rather than speed, and it is a second place that can go stale if the writer and the engine ever disagree about which record won.
- A migration lands on a table whose first migration has never run on real hardware (spec 0006's own milestones still say the device work is outstanding). Two unproven migrations now have to run in order on the first device that opens the app.
- Two new routes and a disclosure animation to maintain, where the screen previously had one route and no motion.
- The in app browser hands the reader a government PDF that will look nothing like the rest of the app. That is the honest cost of making the citation checkable.

**Neutral**:

- `Verdict` grows two fields, so every construction site and test literal that builds one by hand is touched.
- `ScreenHeader` loses its only production caller and is left serving the two throwaway dev screens.
- The screen is still built against mock data until the vision chain runs once on a device.

## Follow-up

- [ ] Feature 8 (capture a photo) is `planned` and has no spec, yet this screen's entry contract assumes it hands over a photo and a decided verdict and navigates by id. That assumption is recorded in `rationale.md` and should be confirmed when feature 8 is designed.
- [ ] `MIN_DECIDING_SCORE` is still marked PROVISIONAL and spec 0003's first live run scored 85 and above on every attribute, so the material gate may almost never fire. The check manually path stays under exercised until the photo set includes genuinely hard shots; verify this screen against a deliberately bad photo before calling feature 9 done.
- [ ] `apple-ui-design` shaped this design but is not listed in root `AGENTS.md` `## Agent skills`. It governs every screen, so it belongs at root level, not in a nested file. `/sync` owns that edit.
- [ ] `AGENTS.md`'s **Key dependencies** list is stale against `package.json`: `expo-web-browser`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context`, `expo-sqlite`, `expo-file-system`, `expo-crypto` and `zustand` are installed, and several are listed there as not yet installed.
- [ ] `docs/design.md` **Known debts** says the result screen hand draws its header. That entry needs removing once task 7 ships, and the component inventory needs `ConfidenceChip` and `ScopeChip` adding.
- [ ] Spec 0004 left two open questions for feature 9, whether a url becomes tappable and whether a national citation looks different from a Pune one. Both are answered here; the notes in `src/components/rule-card.tsx` and `src/vision/types.ts` can be updated to point at this spec.
- [ ] The staleness check compares rule set versions for equality. If `pune.json` ever needs ordering rather than equality (for example to say the rules got stricter, not just different), revisit it.
- [ ] `ScopeChip` may need a token that does not exist yet for a quiet neutral chip. Add it to `src/global.css` with a written reason rather than reaching for a raw value, since `npm run check:tokens` will fail either way.
