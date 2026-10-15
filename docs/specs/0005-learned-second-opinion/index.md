# 0005. Gate the rule engine with a learned reliability model

**Date**: 2026-10-13
**Status**: In Progress

## Summary

A small model, trained on photos you shoot and label yourselves, learns to spot a vision read that should not be decided on. It sits after the four written stop checks and before the rules, and the only thing it may ever do is refuse: it can turn an answer into check manually, never the other way round. It is measured against the hand picked threshold the engine uses today, on a held out set of your own photos, and both numbers are published whatever they say. The rules still pick every verdict and still name the document behind it.

## Requirements

**User stories**:

- As the four of us submitting this for an AIML course, we want a model that is trained, measured and compared against a real baseline, so the machine learning part is evaluable rather than decorative.
- As someone holding a tub with a faded label, I want the app to refuse rather than guess when the reading itself was unreliable, even when every written check passed.
- As someone reading a refusal, I want to know it came from a measured model rather than a municipal rule, so I am not misled about what backs it.
- As the person building feature 5, I want to know now which fields a scan must store, so the learned stage does not force a schema change after the fact.
- As you, maintaining this later, I want the app to behave exactly as it does today when the model cannot be loaded, so a bad model never makes the product worse than it already is.

**Acceptance criteria** (the contract, each one independently checkable):

- **AC-1**: A read's six attributes pass through `trust()` before `decideWith` returns, and the result reaches the engine as its third argument.
- **AC-2**: The learned gate runs only after all four existing written gates. If any written gate fires, the model is never consulted and the cited source is that written gate's own.
- **AC-3**: The learned gate can only produce `checkManually`. There is no input for which consulting the model turns a verdict into `recyclable` or `notRecyclable`, changes which rule matches, or raises a confidence number. A test asserts this across the attribute matrix.
- **AC-4**: When the learned gate fires, the returned `Verdict` carries a rule whose `source.document` names the model and its measurement, never a municipal or national document.
- **AC-5**: `MIN_DECIDING_SCORE` and `gate-material-unreadable` still run, unchanged, ahead of the learned gate.
- **AC-6**: When the model cannot be consulted (the file is missing, the version does not match, a score falls outside 0 to 1, or anything throws) the learned gate is skipped, the verdict is exactly what today's engine returns, and the scan records `modelVersion` as `unavailable`.
- **AC-7**: `decideWith` stays pure: no network, no file read at call time, no clock, no randomness. The same arguments always give the same verdict, and every engine test can pass a trust value as a literal with no model file present.
- **AC-8**: At least 300 photos are labelled, each one independently by two of the four of you, and inter annotator agreement is reported as Cohen's kappa per attribute.
- **AC-9**: The held out set is drawn only from photos you shot. No public dataset image and no synthetic read appears in it, and photos of the same physical item never straddle the split.
- **AC-10**: The model is trained only on reads that survive the four written gates, because that is the only population it will ever be asked about.
- **AC-11**: The evaluation reports the learned gate's precision against a coverage matched baseline, that is `MIN_DECIDING_SCORE` tightened until the written gates alone refuse the same share of reads. Both numbers are published whatever the result, including a loss.
- **AC-12**: The evaluation also publishes the full risk coverage curve for both, and the shipped threshold is a named, justified point on it.
- **AC-13**: Training is reproducible from committed code: a fixed random seed, pinned versions in `ml/requirements.txt`, and `python ml/train.py` regenerates `src/ml/model.json` identically.
- **AC-14**: A saved scan records `trustScore`, `modelVersion` and `gateFired`. Feature 5's data model must carry all three.
- **AC-15**: `src/ml/score.ts` has unit tests that run with no device, no network and no Python, including a fixed weight vector whose output probability is asserted against a known value.
- **AC-16**: No photograph containing a face or other personally identifying content enters `ml/data/`. The photos are gitignored; the labels are committed.
- **AC-17**: Feature extraction cannot drift between the two languages. `ml/train.py` emits a fixture file of reads with their computed feature vectors, and `src/ml/score.test.ts` asserts the TypeScript extractor reproduces every one exactly.

## Decision

**Chosen option**: Option 2: a learned refusal gate, scored on device in TypeScript from exported weights.

Train a regularised logistic regression offline in Python on labelled reads, export it as a JSON weight vector, score it on the phone with a pure TypeScript function, and let it do exactly one thing: fire a fifth gate that forces `checkManually`, after the four written gates and before any rule.

**Implementation skills**: `scikit-learn-best-practices` (`mindrally/skills`, `.agents/skills/scikit-learn-best-practices/`) · `pandas-pro` (`jeffallan/claude-skills`, `.agents/skills/pandas-pro/`) · `jupyter-notebook` (`openai/skills`, `.agents/skills/jupyter-notebook/`) · `mle-workflow` (`affaan-m/ecc`, `.agents/skills/mle-workflow/`) · `machine-learning` (`affaan-m/ecc`, `.agents/skills/machine-learning/`) · `react-native-best-practices` (`callstackincubator/agent-skills`, `.agents/skills/react-native-best-practices/`)

## Rationale

Reasoning, the options weighed, and the evidence: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

Two artifacts and three new scan fields. Nothing here is a server side table; the app's only store is the device.

`src/ml/model.json`, the shipped artifact (read only, bundled, regenerated by `ml/train.py`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `version` | string | yes | e.g. `v1`. Recorded on every scan that used it. |
| `threshold` | number | yes | 0 to 1. Below this, the gate fires. Chosen in build task 7, never hand edited. |
| `features` | string[] | yes | Ordered feature names. The TypeScript extractor must emit this exact order. |
| `weights` | number[] | yes | Same length as `features`. |
| `bias` | number | yes | The intercept. |
| `trainedOn` | object | yes | `photos`, `heldOut` and `date`, quoted in the gate's cited source. |

`ml/data/labels.csv`, the committed label store (the photos themselves are gitignored):

| Column | Type | Required | Notes |
|---|---|---|---|
| `photoId` | string | yes | Primary key together with `labeller`. |
| `itemId` | string | yes | Groups photos of the same physical object, so a split never separates them (AC-9). |
| `labeller` | string | yes | One of four. Two rows per `photoId`, so the pair is unique. |
| `trueMaterial` and five more | enum | yes | Six columns, the spec 0003 vocabulary. |
| `source` | enum | yes | `own`, `public` or `synthetic`. Only `own` may reach the held out set. |

New fields on a saved scan, which feature 5 must carry (AC-14):

| Field | Type | Required | Notes |
|---|---|---|---|
| `trustScore` | number or undefined | yes | 0 to 1. `undefined` when the model was unavailable. |
| `modelVersion` | string | yes | The artifact's `version`, or the literal `unavailable`. |
| `gateFired` | boolean | yes | Whether the learned gate is what produced this verdict. |

**State transitions**:

One read moves through a fixed pipeline, and the learned gate occupies exactly one slot in it:

```
read
 ├─> gate-photo-unreadable       written, cited   ─┐
 ├─> gate-material-unreadable    written, cited    │ first firing
 ├─> gate-multi-material         written, cited    │ gate wins
 ├─> gate-heavy-residue          written, cited   ─┘
 ├─> gate-learned-unreliable     MODEL, cited to the model      <- new
 └─> rules, first match wins     written, cited
```

The model is consulted only at its own slot, so a read halted earlier never reaches it (AC-2).

**API surface** (functions, not endpoints; this feature adds no HTTP surface):

| Function | Signature | Key inputs | Key outputs | Purity | Key failures |
|---|---|---|---|---|---|
| `features` in `src/ml/features.ts` | `(a: VisionAttributes) => number[]` | the six reads | the ordered feature vector | pure | none, total over the vocabulary |
| `trust` in `src/ml/score.ts` | `(a: VisionAttributes) => LearnedTrust or undefined` | the six reads | `score` and `threshold` | pure, reads the bundled JSON once at module load | returns `undefined` on a bad artifact, never throws |
| `decideWith` in `src/rules/engine.ts` | `(ruleSet, read, learned?: LearnedTrust) => Verdict` | rule set, read, optional trust | one `Verdict` | pure | none, every input yields a verdict |
| `decide` in `src/rules/index.ts` | `(read: VisionRead) => Verdict` | one read | one `Verdict` | pure | none |
| `assess` in `src/rules/index.ts` | `(read: VisionRead) => ScanLearnedFields` | one read | `trustScore`, `modelVersion`, `gateFired` | pure | none |
| `ml/train.py` | CLI | `ml/data/labels.csv` plus cached reads | `src/ml/model.json` and the fixtures | offline | exits nonzero on a leaky or empty split |
| `ml/evaluate.py` | CLI | the artifact plus the held out split | the evaluation write up | offline | exits nonzero if the held out set holds a non `own` row |

`LearnedTrust` is `{ readonly score: number; readonly threshold: number }`. Passing both keeps the engine model unaware: it compares two numbers handed to it and never learns where either came from, exactly as it never learns what Pune is.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| score a read | `trustScore`, 0 to 1 | `trust()` over the feature vector |
| score a read | the feature vector | derived from the six `AttributeRead.score` and `.code` fields (spec 0003) |
| score a read | the decision threshold | `threshold` in `src/ml/model.json`, chosen in build task 7 from the risk coverage curve |
| score a read | `modelVersion` | `version` in `src/ml/model.json`, or the literal `unavailable` on the failure path |
| fire the learned gate | the gate's `text` and `action` | the `gate-learned-unreliable` record in `src/rules/pune.json`, written in build task 1 |
| fire the learned gate | the cited `source.document` | the same record, quoting `trainedOn.photos` and `trainedOn.heldOut` from the artifact |
| fire the learned gate | the cited `source.scope` | the new `model` value added to `SourceScope`, so no screen can read it as law |
| fire the learned gate | `confidence` | `NO_MATCH_CONFIDENCE`, which is 0: the refusal rested on no attribute, so it claims nothing |
| save a scan | `gateFired` | derived in `assess()`: the model was consulted and its score fell below the threshold |
| save a scan | `trustScore` and `modelVersion` | `assess()`, stored by feature 5 |
| report the result | coverage matched baseline precision | `ml/evaluate.py`, by tightening `MIN_DECIDING_SCORE` until coverage matches |
| report the result | Cohen's kappa per attribute | `ml/evaluate.py` over the two labeller rows per `photoId` in `labels.csv` |
| report the result | the shipped threshold's justification | the named operating point on the published risk coverage curve |

**Key invariants**:

- **Monotonic caution.** For every input, the verdict with the model consulted is either identical to the verdict without it, or it is `checkManually`. Nothing else is reachable. This is the invariant the whole design exists to protect, and AC-3 is its test.
- **Every verdict carries a rule and a source.** Unchanged from spec 0004. The learned gate satisfies it by being a real record in the rule set rather than a special case in code.
- **A model source is never a legal source.** `scope: 'model'` exists so a learned citation is typed differently from a municipal, state or national one everywhere it travels.
- **The engine stays pure and model unaware.** It receives two numbers; it imports nothing from `src/ml/`.
- **Train and serve compute the same features.** Enforced by the shared fixture file, not by reading both implementations carefully (AC-17).
- **The held out set is `own` only.** Enforced by `ml/evaluate.py` exiting nonzero, not by discipline (AC-9).
- **The ordered feature list in the artifact is the contract.** The feature and weight arrays are asserted to be the same length at load; a mismatch makes the artifact unavailable rather than silently misaligned.

**Security model**:

No authentication or authorisation surface: the app is single user and local, with no accounts and no server side store. The sensitive material here is the training set, not the runtime.

- The photos in `ml/data/` are gitignored and never leave the four laptops they are labelled on. The labels are committed because they carry no image content (AC-16).
- The model artifact is public by construction, since it ships inside the bundle, so it must contain no path, filename or personal detail from the training set. `trainedOn` carries counts and a date only.
- Public dataset images stay under their own licences, which `ml/data/README.md` records. They are training only and are never redistributed in the repo.
- No new secret and no new credential. The Gemini key stays on the proxy, exactly as spec 0001 requires.
- No regulated data and no compliance scope applies: photographs of packaging, held locally, with no personal data collected.

**Configuration required**:

None. No new environment variable, no new credential, no new service account. The model artifact is bundled rather than fetched. `ml/requirements.txt` is a local development dependency only and never reaches the app bundle.

**Critical test scenarios**:

- Happy path: a read that passes all four written gates but scores below the threshold returns `checkManually` carrying `gate-learned-unreliable` and a `model` scoped source, verifies **AC-1**, **AC-4**.
- Ordering: a read with `photoQuality: 'poor'` and a terrible trust score returns the photo gate's citation, not the model's, verifies **AC-2**, **AC-5**.
- The core invariant: across the attribute matrix, every verdict with the model consulted is either unchanged or `checkManually`, and no confidence number rises, verifies **AC-3**.
- Failure case: with `model.json` absent, with a mismatched `version`, and with a score of `1.7`, the verdict equals the one today's engine returns and `modelVersion` reads `unavailable`, verifies **AC-6**.
- Purity: `decideWith` called twice with the same literal `LearnedTrust` returns deep equal verdicts, with no model file on disk, verifies **AC-7**.
- Train and serve agreement: every fixture row's feature vector is reproduced exactly by the TypeScript extractor, verifies **AC-17**.
- Evaluation integrity: `ml/evaluate.py` exits nonzero when a `public` or `synthetic` row is planted in the held out split, verifies **AC-9**.

## Build plan

Ordered the Journey way: the complete user path (a scan is refused, and the refusal reaches the screen with an honest citation) is finished and polished against a stub model first, so the path is whole and testable long before any photo is labelled. Swapping the stub for trained weights then changes one file and no code. That matters more than usual here, because tasks 5 to 7 depend on a camera, four people and several weeks, and nothing in the app should sit blocked waiting on them.

1. Widen the contract and add the gate, with the model stubbed: `LearnedTrust`, the third parameter on `decideWith`, `LEARNED_GATE_ID`, the `model` value on `SourceScope`, and the `gate-learned-unreliable` record placed last among the gates in `pune.json`, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-7**
2. Build `src/ml/`: `features.ts`, `score.ts`, `types.ts`, the artifact schema with its load time validation, the unavailable path, and unit tests against a hand written weight vector, satisfies **AC-6**, **AC-15**
3. Name the three scan fields and wire `assess()`, so feature 5 absorbs them while it is still being designed, satisfies **AC-14**
4. Build the labelling kit: the `ml/` scaffold, the `labels.csv` schema, the shooting protocol extending the spec 0003 photo set, the privacy rule, and a gate survival audit run on the first 50 photos to size the real yield before the other 250 are shot, satisfies **AC-8**, **AC-16**
5. Shoot and label: 300 photos minimum, every one independently labelled by two of you, `itemId` recorded throughout, kappa computed per attribute, satisfies **AC-8**, **AC-9**
6. Build the training pipeline: feature extraction in Python, the gate survival filter, group aware and source aware splitting, candidate feature sets compared by cross validation on the training split only, a fixed seed, pinned requirements, and the shared fixture emitter, satisfies **AC-10**, **AC-13**, **AC-17**
7. Evaluate and choose the threshold: the coverage matched baseline, the risk coverage curves for both, the chosen operating point, and the write up published whatever it says, satisfies **AC-11**, **AC-12**
8. Ship the trained artifact in place of the stub and re run the whole app test suite unchanged, satisfies **AC-1**, **AC-15**

## Consequences

**Positive**:

- The hand picked `MIN_DECIDING_SCORE = 50`, which the code itself calls provisional and unmeasured, finally gets measured, whether or not the model beats it.
- The machine learning component is genuinely evaluable: a real baseline, a held out set from the right distribution, a standard metric for an abstain decision, and a published number.
- The product claim survives intact. Gate only authority means no learned number can make a verdict more confident or less traceable, and that is enforced by a test rather than by care.
- The app keeps working with no model at all, so the risky part can ship late, or not at all, without stranding the rest.
- Kappa per attribute tells you the ceiling any model could reach, which is worth knowing regardless of how the model itself performs.

**Negative / tradeoffs**:

- **The written gates eat the training data.** Running after four gates means the model only ever sees survivors, so a meaningful share of the 300 photos will train nothing. Task 4's survival audit exists to measure that early, but the effective dataset will be smaller than 300 and the held out set smaller than 60.
- **The model may simply lose.** The slot it occupies is the narrowest available: reads that four written checks already waved through. There may be little left to catch, and AC-11 commits you to publishing that either way.
- **300 photos double labelled is around 600 labelling passes** across four people, on top of building journey 1, which is where those photos come from in the first place.
- **A second language enters a TypeScript repo.** Two dependency files, two toolchains, and a Python environment every teammate has to stand up before they can retrain anything.
- **A learned citation is weaker than a document.** `gate-learned-unreliable` cites its own measurement. That is honest, and it is still the one place in the app where an answer rests on the team's own work rather than on a published rule.
- **The skill install went wide.** Choosing every candidate pulled whole collections, taking `.agents/skills/` from 39 to 689 entries. That is context cost on every future task until it is pruned.

**Neutral**:

- `decideWith` gains a third parameter, so spec 0004's signature is no longer current. The existing tests keep passing because the parameter is optional.
- `SourceScope` gains a fifth value, which `rule-set.test.ts` and anything switching on scope will need to handle.
- `src/rules/index.ts` keeps its role as the only place a pure engine is bound to concrete data, now binding two artifacts rather than one.
- The deferred scope item "your own trained vision model" stays clearly distinct from this one: that replaces the vision stage, this judges it.

## Follow-up

- [ ] Feature 5 must carry `trustScore`, `modelVersion` and `gateFired`. Run `/architect data model` before building feature 5, not after, since these three fields are now a requirement on it rather than a suggestion.
- [ ] `AppliedRule` carries no `id`, so a stored scan cannot say which rule fired without matching on its text. Worth adding when feature 5 is designed; this spec works around it by deriving `gateFired` from the score instead.
- [ ] `k-dense-ai/scientific-agent-skills` failed to install and may not exist. Nothing depends on it, but `scikit-learn-best-practices` is now doing that job alone.
- [ ] `.agents/skills/` went from 39 to 689 entries during this design. Prune it back to what this project actually uses before the count costs real context on every task.
- [ ] The Python and labelling conventions belong in a nested `ml/AGENTS.md`, not in root `AGENTS.md`: they are needed only when working in that directory, and root loads on every task. Root gets a one line pointer to it.
- [ ] Retuning `MIN_DECIDING_SCORE` from the labelled data was weighed and not chosen as the shipped baseline. Once labels exist it costs almost nothing to also report, and it is the harder baseline, so consider adding it to task 7.
- [ ] `npm run test` names its two test files explicitly. It will need `src/ml/score.test.ts` adding, and the pattern will keep needing hand edits as files are added.
