# 0005. Rationale: gate the rule engine with a learned reliability model

The reasoning behind [index.md](index.md). A build reads `index.md` only.

## Context

> ⚠️ Premise note: putting the learned gate after the four written gates, which is the right call for traceability, quietly shrinks the dataset the model can learn from. Every read halted by a poor photo, an unknown material, joined materials or heavy residue never reaches the model, so those photos produce a label and train nothing. Three hundred photos may yield closer to two hundred usable rows and a held out set in the forties, which is thin for thirteen features and makes every reported number wide. The fix is not to reorder the gates, it is to shoot for the survivors: deliberately oversample the case the product exists for, a readable looking item whose read is nonetheless wrong, and measure the survival rate on the first fifty photos before committing to the other two hundred and fifty. Build task 4 carries that audit.
>
> This feature also rests on two decisions that have no spec yet. Feature 5, the data model, must store three fields this spec defines, and feature 9, the verdict screen, must render a refusal whose citation is a model rather than a document. Both are listed as constraints below and as follow up items; neither blocks designing this, but building task 3 before `/architect data model` runs would be building against a guess.

Recyclens is a four member college AIML project with an unusual constraint for its course: its central product claim is that a model's opinion never becomes a verdict. Spec 0003 asks Gemini for observations and forbids it from deciding. Spec 0004 turns those observations into an answer with a pure function over a bundled, cited rule set. That architecture is deliberately hostile to machine learning in the decision path, and it is also the thing that makes the product defensible.

The course, though, assesses an AI and machine learning component, and so far there is none that the team built. Gemini is an API call. The rule engine is a lookup. Neither is trained, neither is measured, and neither produces the baseline, metric and honest result an assessment expects. So the question is not whether to add a model, it is where a model can sit without dismantling the claim that the rest of the project is built on.

There is one place the current system is visibly weak, and it is already flagged in the code. `src/rules/engine.ts` carries `MIN_DECIDING_SCORE = 50`, the threshold below which a material read is not worth deciding on, and its own comment calls it provisional, says it reuses a boundary from spec 0003 rather than inventing a number, and notes that nothing has measured it. That is a hand picked constant doing load bearing work on the product's most important behaviour, which is knowing when to refuse. It is exactly the kind of guess a trained model is good at replacing, and exactly the kind of baseline a trained model can be fairly measured against.

The forces that shaped the decision: Expo Go is the only runtime, so anything needing a native module costs the whole team's workflow and a revision to spec 0001. The engine is pure by design and spec 0004 leans on that for its entire test strategy, which runs with no device, no network and no quota. Training data does not exist yet and has to be shot and labelled by four students alongside building the rest of the app, with every photo costing one Gemini call to turn into a feature vector. And the deadline is a term, not a roadmap: whatever is designed has to degrade gracefully if the data collection runs out of time.

## Options considered

### Option 1: An advisory model, recorded but never acting

Train the same model, record its score on every scan, evaluate it offline against the held out set, and never let it touch a verdict. The machine learning component exists and is measured; the product is untouched.

**Pros**:

- Zero risk to the product claim, because nothing in the decision path changes at all.
- The evaluation story is identical: same baseline, same metric, same held out set.
- Can be built and abandoned with no consequence; if the data never arrives, nothing is broken.

**Cons**:

- The scope line for feature 13 says the judgment is handed to the engine as one more input, and this does not do that. It is a model sitting beside the product rather than in it.
- Nothing forces the model to be good, because nothing depends on it. An unused number attracts no scrutiny.
- Harder to defend in a viva: a model that affects nothing invites the question of why it exists.

### Option 2: A learned refusal gate, scored on device (chosen)

A regularised logistic regression over the six reads, trained offline in Python, exported as JSON weights, scored by a pure TypeScript function, firing a fifth gate that can only produce check manually, placed after the four written gates.

**Pros**:

- It genuinely feeds the engine, and it does so in the one direction that cannot weaken the product: the model can only make the app more cautious.
- The baseline is already in the codebase and already flagged as a guess, so the comparison is real rather than constructed for the report.
- No native module, so Expo Go survives and the engine stays pure and testable with a literal.
- Coefficients are readable, so an abstention has a one sentence explanation, which the rest of the product's design demands.

**Cons**:

- The slot it occupies is the narrowest one available, so it may find little the written gates miss, and the honest answer may be that it did not help.
- The gate ordering shrinks the usable training data, as the premise note sets out.
- It introduces Python into a TypeScript repo, and with it the risk that the two feature extractors drift apart.
- Its citation is itself, which is weaker than every other source in the rule set.

### Option 3: A learned calibrated confidence

Replace the weakest link confidence number with a calibrated probability from a trained model, leaving every verdict exactly as it is and changing only the number shown beside it.

**Pros**:

- Calibration error is a clean, standard, well understood metric, and the current weakest link rule is an unvalidated heuristic that probably deserves checking.
- Touches no verdict, so the traceability claim is untouched.
- Every scan exercises it, so there is no survivor problem and the full dataset trains the model.

**Cons**:

- It changes a number on a screen rather than a decision, which is a thinner claim about what the model is for.
- The weakest link rule exists for a stated reason, that an average lets a sharp photo prop up an unreadable label, and a calibrated model would quietly reintroduce exactly that averaging.
- Confidence is not currently used to gate anything, so improving it changes no behaviour at all.

### Option 4: Replace the vision stage with a trained classifier

Collect and label damaged packaging photos and train an image model that outputs the six attributes directly, removing Gemini from the path.

**Pros**:

- By far the strongest machine learning story, and the most interesting engineering.
- Removes the proxy, the API key and the per call cost entirely, and would work offline.

**Cons**:

- Needs orders of magnitude more labelled data than four students can collect in a term, and would underperform Gemini badly at the scale they can reach.
- Needs a native runtime on device, so Expo Go ends and spec 0001 is revised.
- Discards spec 0003 and the proxy, which are already built and working.
- Already correctly recorded as a deferred scope item rather than this feature.

## Rationale

Option 2 wins because it is the only one that satisfies both masters named in Context. The course needs a trained, measured, compared component, and option 2 supplies a real baseline that was not invented for the occasion: `MIN_DECIDING_SCORE = 50` is already in the codebase, already doing load bearing work, and already labelled provisional by the person who wrote it. Replacing a guessed constant with a measured model, and publishing the comparison whichever way it falls, is a complete piece of machine learning work rather than a demonstration of one.

The product, meanwhile, needs the model to be incapable of damaging traceability, and gate only authority is what delivers that. It is not a promise in prose, it is a property of the design: the learned gate's only reachable output is check manually, so for any input the model either changes nothing or makes the app refuse. Option 1 protects the product just as well but fails the scope line and, more practically, builds a component nothing depends on. Option 3 measures something real but changes no behaviour and would undo a deliberate decision from spec 0004. Option 4 is the right ambition and the wrong term; the scope already files it correctly as deferred.

Placing the gate last among the gates, rather than first, costs real training data and was still the right call. A refusal that can cite the Plastic Waste Management Rules should cite them; only a refusal that no written document covers should fall back to citing a model. The alternative puts a model's opinion in front of an available legal citation, which is the precise thing this project exists to avoid.

Two choices inside option 2 were close. Logistic regression over gradient boosted trees is a concession to data size and to explanation, not to capability: at a few hundred rows boosted trees would overfit, and the product's whole posture is that a refusal can be explained in a sentence. And passing the threshold into the engine alongside the score, rather than storing it as a constant, is what keeps `decideWith` model unaware; the engine compares two numbers it was handed and never learns that a model produced either, exactly as it never learns what Pune is.

One note on the engineer's own picks. A development build with a native runtime was selected first, then reversed once the cost was laid out. The reversal was right: a logistic regression is a dot product and a sigmoid, so the native runtime bought nothing and would have cost spec 0001, the Expo Go workflow, and an Android toolchain on four machines. If a future model genuinely needs a runtime, the deferred vision model item is where that cost belongs.

## Supporting evidence

**The baseline, as it stands in the code today.** `src/rules/engine.ts` lines 29 to 38:

> Below this `score`, a material read is not worth deciding on. PROVISIONAL. It reuses the boundary spec 0003 already fixed between its `low` and `medium` bands rather than inventing a third number, but nothing has measured it: spec 0003's first live run returned 85 and above on every attribute of a clear photo, so this gate may almost never fire until the photo set includes genuinely hard shots. Retune it when that runs.

That last sentence is the one that matters for the evaluation. If the threshold almost never fires on easy photos, then the baseline's coverage is near total, and the learned gate's job is to find the hard cases hiding inside that coverage. It also means the photo set must contain genuinely hard shots or neither the baseline nor the model will have anything to separate.

**What survives the written gates.** The four gates in `pune.json` fire on `photoQuality: poor`, `material: unknown`, `construction: multi_material` and `contamination: heavy_residue`. So the population the model actually sees has photo quality in good or fair, a known material, construction in single material or unknown, and contamination in clean, light residue or unknown. Two consequences follow. A `multiMaterial` feature would be constant zero and is worthless, and the candidate feature set in build task 6 must be drawn from what varies among survivors: the six scores, their minimum and spread, how many codes came back unknown, whether the symbol was readable or faded, whether the photo was merely fair, and whether the material is a composite laminate.

**Why the baseline has to be coverage matched.** Adding a gate can only reduce the share of scans the app answers, so a learned gate that refuses more will trivially look more precise than the written gates alone. Comparing them at their natural operating points would therefore flatter the model for free. The fair comparison tightens `MIN_DECIDING_SCORE` until the written gates alone refuse the same share, then asks which of the two is more often right about what it let through. That is what AC-11 requires, and the full risk coverage curve in AC-12 is what stops the chosen operating point from being cherry picked after the fact.

## References

**Project sources** (verifiable, in this repo):

- `src/rules/engine.ts`, the `MIN_DECIDING_SCORE` comment declaring the threshold provisional and unmeasured: the baseline this spec measures against
- Spec [0001](../0001-stack-and-architecture/index.md), Expo Go as the only runtime and the proxy as the only home for a secret
- Spec [0003](../0003-packaging-vision-read/index.md), the six attribute vocabulary, the confidence bands, and the photo set protocol this feature's labelling extends
- Spec [0004](../0004-local-recycling-rule-set/index.md), the pure engine, the gate and rule record shapes, the weakest link confidence rule, and the requirement that every verdict carry a cited source
- `AGENTS.md`, the Android only Expo Go target, the pure functions default, and the rule that an expected failure returns an explicit value rather than throwing
- `docs/scope/scope.md`, feature 13's intent and its Beta tier, and the deferred "your own trained vision model" item this feature is deliberately not

**Practices and standards**:

- Selective prediction, also called classification with a reject option: the framing in which a model's job is to decide when not to answer, and the source of the risk coverage curve in AC-12
- Coverage matched comparison: holding the answered share equal between two abstention policies so neither wins by refusing more, the basis for AC-11
- Cohen's kappa for inter annotator agreement, the basis for AC-8 and for knowing the ceiling any model on this data could reach
- Group aware splitting, keeping all photos of one physical item on one side of the split, the basis for AC-9 and the standard guard against a leaked near duplicate
- Events per variable as a guide to logistic regression capacity, the basis for preferring a compact feature set over the full one hot encoding at this data size
- Cross validation confined to the training split, with the held out set touched once, the basis for the feature set selection in build task 6
- Training and serving skew as a failure mode, and shared fixtures as the standard guard against it, the basis for AC-17
- scikit-learn's `LogisticRegression` with L2 regularisation and balanced class weights, the implementation this spec assumes
