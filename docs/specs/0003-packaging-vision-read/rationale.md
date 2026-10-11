# 0003 rationale: read packaging from one photo

The reasoning behind [index.md](index.md). A build reads `index.md` only.

## Context

> ⚠️ **Premise note, three things worth saying before the reasoning.**
>
> **The confidence number is the weakest part of this design.** Every option here ends with a language model reporting how sure it is about its own reading, and a model's self assessment is not a measurement. Banding it into high, medium and low makes it look more rigorous than it is. This is accepted because the product needs *some* signal to decide when to say check manually, and a coarse band is the most honest shape available. It only becomes real when AC-15's photo set runs and you can see whether a `low` band actually correlates with a wrong read. Until then, treat the thresholds as a plausible starting guess, not a calibrated instrument.
>
> **This feature assumes two decisions that have no spec yet.** Feature 4 (the rule set) consumes every code defined here, and feature 5 (the data model) decides how a read is stored. Both are unspecced. The boundary is drawn explicitly in the Value sourcing table so neither has to be guessed at here, but a change in either could force a second pass on this vocabulary.
>
> **A note on the project framing.** `Researrch.md` describes "an AI-based computer vision system". A general purpose multimodal model prompted for structured observations is a legitimate implementation of that, and spec 0001 chose it deliberately for the free tier on a zero budget project. The scope's deferred item "Your own trained model" is the other reading. This spec takes the first, as a conscious choice rather than a drift, and the photo set in AC-15 is also the baseline you would measure a trained model against later.

Recyclens has screens, a design system and a proxy with a hole in it. `proxy/api/vision.ts` validates a request and then returns `501 not_implemented`, because spec 0001 deliberately refused to invent an attribute vocabulary and left that decision here. `@google/genai` is not installed. The app runs on two hardcoded mock scans. Nothing in the product is real yet, and this is the decision that makes it real.

The forces are specific.

**Two consumers want different things from the same value.** Feature 4's rules have to match an observation exactly, which wants a closed machine readable code. The result screen has to show a person why the app thinks what it thinks, which wants nuance: "likely PP", "partly faded". A single `value: string` field cannot serve both, and the provisional type in `src/vision/types.ts` currently tries to, which is why it is marked PROVISIONAL.

**The verdict has to be defensible.** The scope's own words are that the rule set is "what makes the verdict defensible instead of a guess", and every rule must carry the source it came from. That is only true if the judgement happens in rules you wrote, not inside a model you cannot audit. Where the recyclability call is made is therefore not a style preference; it is the difference between the product's claim being true and being marketing.

**The deadline is two weeks and the budget is zero.** Gemini's free tier is rate limited, and spec 0001 named the Vercel function timeout as the real risk in the whole design. Anything that adds latency or quota pressure costs more here than it would on a funded project.

**Two existing rules constrain the shape.** `proxy/AGENTS.md` forbids the app and the proxy from importing each other, so a shared type file is not available. Spec 0001 fixed the response envelope as either a 200 with attributes or a non 200 with one machine readable code, never a partial result.

**The vocabulary the prototype implies is incomplete.** The mock rule text quotes a real condition, that containers are accepted "when they are clean, dry, and empty", but nothing in the four attribute set can observe cleanliness. The uncertain mock case turns on "possibly a film laminate", but nothing distinguishes a rigid tub from a film pouch independently of its resin. Both gaps would have surfaced during feature 4 as unwritable rules.

## Options considered

### Option 1: Closed enum codes plus a model written display line

Each attribute returns a `code` from a closed list, a short `display` line in plain words, a self reported `score`, and a `confidence` band the proxy derives from the score. The API's structured output constrains generation to the schema, and the proxy revalidates with `zod` before returning. The model is given no region and returns no verdict.

**Pros**:
- Serves both consumers honestly: rules match the code, screens show the line.
- Enum violations become near impossible at generation time and impossible at the boundary, because the schema is enforced twice.
- One `zod` declaration yields the validator, the TypeScript type and the JSON schema for Gemini.
- Keeps the recyclability judgement in auditable local rules, which is the product's claim.

**Cons**:
- Every allowed code has to be enumerated up front, and a code you did not think of becomes `unknown` rather than a useful read.
- Two fields describe the same observation, so they can disagree: a `code` of `pp` with a `display` reading "glass jar" is possible and nothing catches it.
- The payload is wordier than it needs to be, and `display` is unvalidatable free text from a model beyond a length cap.

### Option 2: Free text attributes, as the prototype shows

Keep `value: string` carrying prose, exactly what the screens in `screen-shots/` display. Feature 4 pattern matches on it.

**Pros**:
- No vocabulary to design, no enums to maintain, and the screens need no change at all.
- The nuance is preserved perfectly, because the nuance is the whole value.
- Fastest thing to build by a wide margin, which matters on a two week deadline.

**Cons**:
- Rules become English pattern matching, and they break silently the first time the model rephrases "Rigid plastic, likely PP (code 5)" as "PP plastic, rigid". That is not a hypothetical; it is what language models do.
- Nothing can be validated, so a malformed read is indistinguishable from a good one.
- It makes the rule set the most fragile component in a product whose entire pitch is that the rule set is trustworthy.

### Option 3: Enum codes only, the app renders every display line

Return just the code. `src/vision/types.ts` holds a lookup from code to label and the screen renders from that.

**Pros**:
- Completely deterministic and fully typed end to end. No free text from the model reaches a screen, ever.
- Smallest payload, simplest validation, and the labels are translatable later without touching the proxy.
- Removes the Option 1 risk of `code` and `display` disagreeing, because there is only one of them.

**Cons**:
- Every read of the same material renders the identical sentence, so the screen stops sounding like it looked at your photo and starts sounding like a lookup table.
- The hedging words are exactly what communicate uncertainty to a person. "Likely PP" and "PP" mean different things, and only the model knows which it meant.
- The `note` would have to go too, and that sentence is the most honest thing on the result screen.

### Option 4: Ask the model for the verdict directly

Send the photo, get back recyclable, not recyclable or check manually, with a short explanation. Skip the local rule set entirely.

**Pros**:
- Dramatically less to build. No vocabulary, no rule engine, no feature 4 at all.
- The model knows far more about packaging than any rule set you could write in two weeks, and would probably be right more often on a random item.
- The explanation would read naturally, because it is generated with the judgement rather than assembled after it.

**Cons**:
- It destroys the product's actual claim. The scope promises a verdict with a named local rule and a cited source; a model's opinion has neither, and "the AI said so" is precisely the black box the research brief sets out to improve on.
- Local recycling rules vary by city and change over time. A general model cannot know Pune's current kerbside policy, and will confidently assert something plausible instead.
- There is no way to fix a wrong answer. With rules you edit a line and cite a source; here you can only ask differently and hope.
- It cannot support the deferred "more regions" work in any honest way.

## Rationale

Option 1 is chosen because the two consumer problem from Context is real and only it solves both halves. Feature 4 needs exactness and the result screen needs nuance; carrying both in separate fields costs a slightly wordier payload and buys a rule engine that cannot silently break. Option 2 is faster to build, and on a two week deadline that is a genuine argument, but it puts the most fragile possible mechanism underneath the component the product's credibility rests on. English pattern matching against a model's phrasing is a bug waiting for a demo.

Option 3 was the close runner up and is the better engineering answer in isolation: one source of truth per observation, nothing unvalidated reaching a screen. It was rejected on product grounds. The hedge words are the uncertainty signal. A screen that always says "Polypropylene" where the model meant "probably polypropylene, the symbol was faded" is overclaiming in exactly the way the acceptance criteria forbid. The 60 character cap and the static label fallback are the compromise that keeps Option 3's safety where it matters, which is that no unbounded model string ever flows into a fixed row.

Option 4 was rejected outright because it inverts the product. The scope says the rule set is what makes the verdict defensible, and the research brief's whole framing is explainability. Handing the judgement to the model would be building the thing the project exists to improve on. Keeping the model to observations also makes region neutrality free, which is what turns the deferred "more regions" item from a rewrite into a new data file.

Two smaller calls follow from the same forces. The **confidence band is computed in the proxy rather than reported by the model**, because a model asked directly for "high, medium or low" gives you a word with no way to retune the cut points; a number plus thresholds you own can be retuned in one line. The **score still travels to the app** because feature 4's verdict thresholds are a different decision from the display bands, and locking the app to three levels would mean a proxy redeploy every time you retune the rules. That leaves a number in the payload guarded only by a written invariant, which is the honest cost of keeping feature 4 tunable, and it is recorded as a negative consequence rather than hidden.

The **sixth and seventh fields**, `form` and `contamination`, were added against the scope's named four because the project's own mock rule text cannot be written without them. A rule saying containers are accepted when "clean, dry, and empty" needs something that observes cleanliness. A rule accepting rigid PP but not PP film needs form as its own axis. Finding this now costs one prompt revision; finding it during feature 4 would have meant reopening this spec.

An independent cross check on a different model found two blockers in the first draft, and both fixes were genuine design calls rather than corrections. **The model's reply is a discriminated union on `packagingFound`** because AC-7 promised a 422 for a photo with no packaging while nothing in the schema carried that fact, leaving the handler with six `unknown` codes to interpret and no way to tell "I could not read this tub" from "this is a cat". Making it the first field the model must answer turns a guess into a branch. **The three free text fields are normalised rather than rejected** because the alternative, failing validation on an overlong `display`, would throw away a perfectly good set of codes and burn the one retry over something cosmetic. Trimming and truncating in the proxy makes the 60 character cap a real wire guarantee and removes the app side fallback entirely, which is simpler than either option the cross check proposed.

The same pass caught that **the retry quietly broke the timeout promise**: two attempts each bounded at 25 seconds can run to 50, so the app would hit its own 30 second deadline and show a generic timeout while the proxy kept spending quota on a retry nobody would see. One `AbortController` shared across both attempts fixes it, at the cost that a retry only helps when the first attempt failed fast. That limitation is recorded as a follow up rather than hidden, because the photo set is what will show whether it is real.

**`zod` over a hand written validator** was the engineer's call against the recommendation here, and it is defensible: one declaration producing the validator, the type and the JSON schema removes a real class of drift inside the proxy, which matters more than it normally would given the schema is already duplicated across the import boundary. The cost is a dependency and some cold start time in a function whose timeout spec 0001 named as the design's main risk. Worth watching in task 8's deploy measurement; if cold starts push the call near the abort, a hand written validator is the fallback.

## References

**Project sources**:

- `AGENTS.md`, the stack and the rule that Gemini is reached only through `proxy/`, never from the app.
- `proxy/AGENTS.md`, the fixed request and response contract, the error codes as machine readable strings, the no import boundary between the app and the proxy, and the pure handler rule for reused serverless instances.
- [spec 0001](../0001-stack-and-architecture/index.md), which chose Gemini via `@google/genai` 2.3.0 or newer, pinned the response envelope, kept the rule engine inside the app, required the proxy to validate the model's response against the declared schema, and named the function timeout as the main risk.
- [spec 0002](../0002-design-system-ui-foundation/index.md), which owns `AttributeRow`, `RuleCard` and `ConfidenceBar`, and already flagged that they are built on a PROVISIONAL vocabulary and should expect a second pass.
- `src/vision/types.ts`, the provisional vocabulary this spec replaces, and `src/constants.ts` for `REQUEST_TIMEOUT_MS` and the photo sizing.
- The `gemini-api-dev` skill at `.agents/skills/gemini-api-dev/`, which is the authority that `gemini-2.5-*` is deprecated, that `@google/genai` 2.3.0 or newer is required, that the call is `client.interactions.create`, and that interactions are stored by default.

**Practices and standards**:

- Parse, do not validate: accept the model's reply at the boundary into a typed shape or reject it, never pass an unverified object inward.
- Closed vocabularies over free text wherever another component has to branch on the value.
- Fail fast with a typed error rather than returning a partial result, so every caller has one path per failure.
- Never log a secret or user content; log the outcome and the timing.
- Keep the judgement where it can be audited and cited, and keep the model to observation.

**Links** (fetched and confirmed during this design conversation):

- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output.md.txt
- Gemini image understanding: https://ai.google.dev/gemini-api/docs/image-understanding.md.txt
- Gemini interactions API: https://ai.google.dev/gemini-api/docs/interactions.md.txt

Note that the first and third of these disagree on where the structured output schema parameter sits. That conflict is recorded as build plan task 1 and the first Follow-up item in `index.md`, to be settled against the installed SDK's own TypeScript types rather than by picking one page.
