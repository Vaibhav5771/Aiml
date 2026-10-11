# 0003. Read packaging from one photo as a fixed vocabulary of observations

**Date**: 2026-10-11
**Status**: In Progress

## Summary

One photo goes to Google Gemini through the proxy and a fixed set of six named observations comes back: what the material is, what form it takes, whether a recycling symbol was readable, whether more than one material is joined, whether it looks clean, and how usable the photo was. Each observation carries a code from a closed list (so feature 4's rules can match it exactly), a short line of plain words (so the screen can show it), and a confidence band. The model reports what it **sees** and never what it **means**: it is never told the region and never returns a verdict, because the verdict has to come from local rules you can cite a source for. This spec also makes `proxy/api/vision.ts` actually work, so you can prove the engine with `curl` before the phone is involved.

## Requirements

**User stories**:

- As the person building feature 4 (the rule set), I want a fixed, typed vocabulary of observations, so I can write rules that match exactly instead of pattern matching English prose that changes whenever the model rephrases.
- As the person building features 9 and 10 (the verdict screen, and the failure states), I want every failure to arrive as one machine readable code, so each one gets its own screen with its own way forward.
- As someone holding a tub with a faded label, I want the app to say plainly that it could not read the symbol, rather than guessing and sounding sure.
- As someone whose photo leaves the device, I want it not to be kept by the vision provider afterwards.
- As the person building feature 7 (the walking skeleton), I want the engine already provable on its own, so when the phone fails I know the problem is the wiring.

**Acceptance criteria** (the contract, each one independently checkable):

- **AC-1**: `POST /api/vision` with a valid base64 JPEG returns HTTP 200 and a body carrying `itemName`, an optional `note`, and an `attributes` object with exactly these six keys: `material`, `form`, `recyclingSymbol`, `construction`, `contamination`, `photoQuality`.
- **AC-2**: Every attribute carries exactly four fields: `code` (a value from that attribute's declared enum), `display` (a non empty string of 60 characters or fewer), `confidence` (`high`, `medium` or `low`), and `score` (an integer from 0 to 100). The 60 character guarantee is true on the wire because the proxy trims and truncates `display` before returning it, rather than rejecting an otherwise good read over a long line.
- **AC-3**: A response whose shape or enum values do not match the schema never reaches the app. The proxy validates every response and, on failure, retries the call **exactly once with an identical request** (no prompt mutation), inside the single deadline of AC-9; if the retry also fails validation it returns a non 200 `{ "error": "vision_invalid_response" }`.
- **AC-4**: `confidence` is computed by the proxy from `score` using fixed thresholds: `high` at 80 and above, `medium` from 50 to 79, `low` below 50. The model never reports the band and the app never computes one.
- **AC-5**: Every attribute except `photoQuality` can return `unknown`, and `recyclingSymbol` distinguishes `absent` (it looked and there is none) from `unknown` (it could not tell). A read the model cannot make returns an `unknown` code with a `low` band rather than a guess: when `code` is `unknown` the proxy **forces** `confidence` to `low` whatever `score` the model reported, while `score` itself travels unchanged for feature 4.
- **AC-6**: The prompt never names a region or a city, and the response body contains no recyclability verdict, no bin name, and no advice. Observations only.
- **AC-7**: A photo with no packaging in it returns a non 200 `{ "error": "no_packaging_found" }`, not a 200 with six `unknown` attributes. The model's own schema is a discriminated union on a required `packagingFound` boolean, so `{ "packagingFound": false }` is a complete and valid model reply that the handler branches on before it ever looks at `attributes`.
- **AC-8**: Every failure returns a non 200 carrying exactly one machine readable code from the declared set, never a partial result and never a 200 carrying an error.
- **AC-9**: Both attempts of AC-3 run under a **single 25 second deadline**, started before the first call and shared across the retry. When it expires the proxy returns `vision_timeout`. Because the worst case is 25 seconds rather than two times 25, it always lands inside the app's 30 second `REQUEST_TIMEOUT_MS`, so the app receives a code rather than a dead socket.
- **AC-10**: Every Gemini call sets `store: false`, so no photo is retained by the provider.
- **AC-11**: `GEMINI_API_KEY` never appears in a response body, in a log line, or anywhere in the repository. The image bytes are never logged.
- **AC-12**: Each request logs the outcome code, the Gemini latency in milliseconds, the request size as `requestSizeBase64Chars`, and `PROMPT_VERSION`. A validation failure additionally logs the model's raw reply truncated to 2000 characters. The size is named for what it measures: the handler counts base64 characters, which run roughly a third larger than the image's real bytes.
- **AC-13**: After the vocabulary change, `npx tsc --noEmit` passes in both the app and `proxy/`. `src/vision/types.ts`, `src/vision/mock.ts` and `src/components/attribute-row.tsx` are updated to the six attribute shape, so the repository is never left in a state where the app does not build. Screen facing code is typed against `DisplayAttribute`, which omits `score`, so a screen cannot print it even by accident.
- **AC-14**: Unit tests cover the validator, the band mapping at each threshold boundary (49, 50, 79, 80), the `unknown` forces `low` override, the text field normalising, and every declared error code, with no network calls and no quota spent.
- **AC-15**: A photo set of at least ten real photos, each with a written expected code per attribute, runs against the deployed proxy through a script that prints expected against actual per attribute, so the quality of the read is evidence rather than an impression. It lives in `docs/specs/0003-packaging-vision-read/photoset/`, with the images committed (they are small, and a baseline you cannot rerun is not a baseline) and `expected.json` holding an array of `{ file, expected: Record<AttributeKey, Code> }`. The script prints the comparison and sets no pass bar; judging it is yours.

## Decision

**Chosen option**: Option 1: Closed enum codes plus a model written display line, constrained by the API's structured output and revalidated in the proxy.

Each of six attributes returns a code from a closed list, a short human line, a self reported score, and a band the proxy derives from that score. The model is given no region and returns no verdict. The schema is declared once in the proxy with `zod`, which produces the runtime validator, the TypeScript type, and the JSON schema handed to Gemini.

**Implementation skills**: `gemini-api-dev` (`google-gemini/gemini-skills`, `.agents/skills/gemini-api-dev/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

This feature adds no database table. It defines a wire shape, `VisionRead`, which is what the proxy returns and what feature 5 later decides how to store.

```ts
type AttributeKey =
  | 'material' | 'form' | 'recyclingSymbol'
  | 'construction' | 'contamination' | 'photoQuality';

type ConfidenceBand = 'high' | 'medium' | 'low';

type AttributeRead<C extends string> = {
  code: C;               // from that attribute's enum, required
  display: string;       // required, non empty, 60 chars or fewer
  confidence: ConfidenceBand; // required, derived in the proxy from score
  score: number;         // required, integer 0 to 100, feature 4 only
};

type VisionRead = {
  itemName: string;      // required, non empty, 60 chars or fewer
  note?: string;         // optional, one short sentence
  attributes: {
    material:        AttributeRead<MaterialCode>;
    form:            AttributeRead<FormCode>;
    recyclingSymbol: AttributeRead<SymbolCode>;
    construction:    AttributeRead<ConstructionCode>;
    contamination:   AttributeRead<ContaminationCode>;
    photoQuality:    AttributeRead<PhotoQualityCode>;
  };
};

/*
 * What a SCREEN is handed. `score` is absent from the type, so no screen can
 * print it even by mistake. Feature 4's rule engine reads the full
 * `AttributeRead` instead. This replaces a written rule with a compiler error.
 */
type DisplayAttribute<C extends string> = Omit<AttributeRead<C>, 'score'>;
```

**What the model returns, which is not the same shape.** Gemini's own schema is a discriminated union on a required `packagingFound`, so "there is no packaging here" is a complete and valid reply rather than six `unknown` codes the handler would have to interpret:

```ts
type GeminiReply =
  | { packagingFound: false }
  | { packagingFound: true; itemName: string; note?: string; attributes: { /* the six */ } };
```

The handler branches on `packagingFound` before it looks at anything else: `false` becomes `422 no_packaging_found`, `true` has `packagingFound` stripped and the rest normalised and returned as `VisionRead`. Keeping the two shapes separate is what stops the app from ever having to ask whether a 200 really found anything.

The six closed lists:

| Attribute | Allowed codes |
|---|---|
| `material` | `pet` `hdpe` `pvc` `ldpe` `pp` `ps` `other_plastic` `glass` `aluminium` `steel` `paper` `cardboard` `composite_laminate` `unknown` |
| `form` | `rigid` `film` `foam` `fibre` `unknown` |
| `recyclingSymbol` | `readable` `faded` `absent` `unknown` |
| `construction` | `single_material` `multi_material` `unknown` |
| `contamination` | `clean` `light_residue` `heavy_residue` `unknown` |
| `photoQuality` | `good` `fair` `poor` |

`material` and `form` are two axes on purpose, so a rule can say "PP, but only when rigid" without the enum multiplying out into every resin and form pair. `photoQuality` carries no `unknown` because it describes the photo rather than the packaging, so it is always assessable.

**Where the schema lives.** `proxy/AGENTS.md` forbids the app and the proxy from importing each other, so the definition cannot be shared by import. `proxy/api/schema.ts` is the source of truth, written once in `zod`. `src/vision/types.ts` carries a copy kept by hand, with a comment naming the proxy file and this spec as the authority. The duplication is deliberate and its risk is named in Consequences.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/vision` | POST | `image: string` (req, base64 JPEG), `mimeType: string` (req, `image/*`) | `itemName`, `note?`, `attributes` (six keys) | none, public | 400 `missing_image`, 413 `image_too_large`, 422 `no_packaging_found`, 502 `vision_invalid_response`, 504 `vision_timeout` |

The request shape is fixed by spec 0001 and is already implemented. This spec fills in the response.

Full error set, which feature 10 switches on:

| Code | HTTP | Meaning |
|---|---|---|
| `method_not_allowed` | 405 | not a POST |
| `malformed_json` | 400 | body was not JSON |
| `missing_image` | 400 | no `image` field, or empty |
| `unsupported_media_type` | 400 | `mimeType` is not an image type |
| `image_too_large` | 413 | over 6MB |
| `vision_not_configured` | 500 | `GEMINI_API_KEY` missing, a deployment mistake |
| `vision_unavailable` | 502 | Gemini returned an error or could not be reached |
| `vision_rate_limited` | 429 | Gemini quota exhausted |
| `vision_invalid_response` | 502 | the reply failed validation twice |
| `vision_timeout` | 504 | the 25 second abort fired |
| `no_packaging_found` | 422 | the model reported no packaging in frame |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| read packaging | `itemName` | model output, free text, trimmed and truncated to 60 chars by the proxy; rejected only if empty after trimming |
| read packaging | `attributes[k].code` | model output, constrained to the enum by structured output, revalidated by `zod` |
| read packaging | `attributes[k].display` | model output, trimmed and truncated to 60 chars by the proxy; rejected only if empty after trimming |
| read packaging | `attributes[k].score` | model output, integer 0 to 100 |
| read packaging | `attributes[k].confidence` | derived in the proxy from `score` by `BANDS` in `proxy/api/schema.ts`, never from the model; forced to `low` when `code` is `unknown` |
| read packaging | `note` | model output, optional, one short sentence, trimmed and truncated to 160 chars by the proxy |
| decide the outcome | whether there is packaging in frame | `packagingFound` on `GeminiReply`, required; the handler branches on it before reading `attributes` |
| display a row | the attribute's label ("Material") | app side `ATTRIBUTE_LABEL` lookup in `src/vision/types.ts`, not sent over the wire |
| display a row | the attribute's icon | app side `ICONS` map in `src/components/attribute-row.tsx`, keyed on `AttributeKey` |
| display the rows | the order the six rows appear in | app side `ATTRIBUTE_ORDER` constant; the wire shape is an object and objects carry no order |
| any failure | the error code | the declared set above, assigned in `proxy/api/vision.ts` |
| log a request | `PROMPT_VERSION` | constant in `proxy/api/prompt.ts` |
| log a request | Gemini latency | measured in the handler around the call |
| the verdict, its overall confidence, the rule text, the action line | **not this spec**: feature 4 owns them |
| `id`, `photoUri`, `scannedAt` | **not this spec**: feature 5 owns the stored `Scan` |

**Key invariants**:

1. The proxy returns observations only. No verdict, no bin name, no advice, no region awareness anywhere in the prompt or the response.
2. Screens read `confidence`, never `score`. This is enforced by the type system, not by goodwill: screen facing code takes `DisplayAttribute`, which has no `score` field, so printing it is a compile error. Only feature 4's rule engine takes the full `AttributeRead`.
3. Every failure is exactly one declared code on a non 200. Never a partial result, never a 200 carrying an error.
4. `confidence` is computed in the proxy from `score`, never reported by the model and never recomputed in the app. An `unknown` code is always `low`, whatever score came back.
5. The schema is declared once in `proxy/api/schema.ts`. `src/vision/types.ts` is a copy whose authority is this spec.
6. `GEMINI_API_KEY` exists only as a Vercel environment variable.
7. Every call sets `store: false`.
8. The app and the proxy never import from each other.
9. The three free text fields (`itemName`, `display`, `note`) are normalised in the proxy, trimmed then truncated to their caps, and rejected only when empty after trimming. The cap is therefore a wire guarantee and the app needs no fallback. Truncating beats rejecting here: a display line ten characters too long is cosmetic, and failing a whole read over it would burn a retry and cost a good set of codes.
10. The handler stays a pure request to response function with no module level mutable state, because serverless instances are reused.
11. Both Gemini attempts share one deadline. The retry never extends the time the app is waiting.

**Security model**:

The endpoint is public and unauthenticated, because the app holds no credential it could present that would not also ship inside the bundle. Anyone who unpacks the APK can read `EXPO_PUBLIC_PROXY_URL` and spend your Gemini free tier quota. That exposure is accepted for a project with no public release, documented here rather than papered over, and mitigated by keeping the deploy window short and rotating the key before submission (a follow up carried from spec 0001).

`GEMINI_API_KEY` lives only as a Vercel environment variable and is never logged or returned. The image bytes are never written to a log. `store: false` means the provider retains nothing, which is what lets the queued privacy note say something short and true. No regulated compliance scope applies: the photo is user content, not payment, health or identity data. The one thing worth saying plainly is that a photo does leave the device, and the copy in `StateView` must keep saying so.

**Configuration required**:

- `GEMINI_API_KEY`: the Gemini credential, set as a Vercel environment variable on the proxy project only. Never in the app, never behind `EXPO_PUBLIC_`.
- `EXPO_PUBLIC_PROXY_URL`: already exists in `.env.example`, the deployed function URL the app calls.
- Vercel project root directory must be set to `proxy`, so Vercel never tries to build the Expo app as a website.
- `vercel.json` `maxDuration` must be confirmed against what the free tier actually allows, before relying on the 25 second abort.

The model name is a named constant, `MODEL = 'gemini-3.8-flash'`, in `proxy/api/vision.ts` rather than an environment variable, so the version that produced a result is recoverable from git. Reading it from the environment was the runner up and is worth revisiting only if you start comparing models in earnest.

**Critical test scenarios**:

- Happy path: a clear photo of a yogurt tub returns 200 with six attributes, each a valid code, a display line, a band and a score, verifies **AC-1**, **AC-2**.
- Faded symbol: a photo whose code is unreadable returns `recyclingSymbol.code = "faded"` or `"unknown"` with a `low` band, and the `note` explains the material was judged another way, verifies **AC-5**.
- Band boundaries: scores of 49, 50, 79 and 80 map to `low`, `medium`, `medium`, `high`, verifies **AC-4**.
- Malformed model reply: a stubbed response with an enum value outside the list triggers one identical retry, then returns `vision_invalid_response` on a non 200, verifies **AC-3**, **AC-8**.
- Unknown is never confident: a stubbed reply of `code: "unknown", score: 85` still returns `confidence: "low"` while `score` stays 85, verifies **AC-5**.
- Overlong display: a stubbed 90 character `display` comes back trimmed to 60 with the rest of the read intact, and an empty one fails validation instead, verifies **AC-2**.
- Nothing to read: a photo of a cat makes the model answer `packagingFound: false` and the proxy returns 422 `no_packaging_found`, not a 200 of unknowns, verifies **AC-7**.
- Slow model, with a retry: a first call that fails validation at 20 seconds leaves 5 seconds for the retry, and the whole request still returns before the app's 30 second deadline rather than running to 50, verifies **AC-3**, **AC-9**.
- No region leaks: the prompt text contains no city or country, and no response field carries a verdict, verifies **AC-6**.
- Nothing retained: the call is made with `store: false`, verifies **AC-10**.
- Secret safety: a forced failure's response body and log output contain no key material and no image bytes, verifies **AC-11**.
- Auth and permission: there is no authenticated surface; the endpoint is public by design and a non POST returns 405 `method_not_allowed`, verifies **AC-8**.

## Build plan

Ordered so the engine is provable with `curl` as early as possible, then hardened, then the app is migrated last. That ordering follows the project's Journey approach applied to a Foundation feature: get the one real path working end to end before polishing any part of it, and never leave the repository in a state where the app does not build.

1. Install `@google/genai` (2.3.0 or newer) and `zod` in `proxy/`, then **settle the structured output parameter against the SDK's own TypeScript types**. The two Gemini doc pages disagree: the structured output page documents a top level `response_format`, the interactions page shows `responseSchema` nested in `generationConfig` (which is the old `generateContent` shape). Read the installed types, do not guess. Satisfies **AC-1**.
2. Declare the schema in `proxy/api/schema.ts` with `zod`: the six enums, the four field attribute object, the `GeminiReply` discriminated union on `packagingFound`, `VisionRead`, `DisplayAttribute`, the `BANDS` thresholds, and a helper that emits the JSON schema for Gemini. Satisfies **AC-1**, **AC-2**, **AC-5**, **AC-7**.
3. Write `proxy/api/prompt.ts`: the instruction text plus `PROMPT_VERSION`. The text asks for observations only, names no region, demands a code from each list, asks for a short display line per attribute, a self reported score per attribute, a one sentence note, and requires `packagingFound` to be answered first. Satisfies **AC-6**, **AC-7**.
4. Wire the Gemini call in `proxy/api/vision.ts`: the base64 JPEG plus the instruction, `store: false`, the structured output schema, and `MODEL = 'gemini-3.8-flash'`. Replace the `501 not_implemented` return. Satisfies **AC-1**, **AC-10**.
5. Validate the reply with the `zod` schema and retry once with an identical request on a validation failure. Then normalise: trim and truncate the three text fields, map `score` to `confidence` with `BANDS`, force `low` wherever `code` is `unknown`, and strip `packagingFound`. Satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**.
6. Implement the full error taxonomy and a **single** `AbortController` started before the first attempt with a 25 second budget shared across the retry, mapping each failure to its declared code and status, and `packagingFound: false` to 422. Satisfies **AC-7**, **AC-8**, **AC-9**.
7. Add logging: outcome code, Gemini latency, `requestSizeBase64Chars`, `PROMPT_VERSION`, plus the raw reply truncated to 2000 characters on a validation failure. Never the image, never the key. Satisfies **AC-11**, **AC-12**.
8. Deploy to Vercel, confirm the `maxDuration` the free tier actually gives you, and prove the whole thing with one `curl` carrying a real base64 photo. Satisfies **AC-1**, **AC-9**.
9. Migrate the app so it still builds: rewrite `src/vision/types.ts` to the six attribute shape (dropping the `{ kind: 'percent' }` half of `Confidence`, adding `DisplayAttribute`), rewrite `src/vision/mock.ts` to match, add `form` and `contamination` icons to the `ICONS` map in `src/components/attribute-row.tsx`, retype it against `DisplayAttribute`, remove its dead percent path, and add `ATTRIBUTE_LABEL` and `ATTRIBUTE_ORDER`. Satisfies **AC-13**.
10. Write unit tests for the validator, the band boundaries, the `unknown` override, the text normalising and every error code, with no network calls. Satisfies **AC-14**.
11. Shoot the photo set (at least ten, including a faded symbol, a laminate pouch, a dirty container, a clear glass jar and something that is not packaging at all), commit them to `docs/specs/0003-packaging-vision-read/photoset/` with `expected.json`, and add a script that runs them against the deployed proxy and prints expected against actual per attribute. Satisfies **AC-15**.

## Consequences

**Positive**:

- Features 4, 9 and 10 stop waiting. The vocabulary is the thing all three were blocked on, and `src/vision/types.ts` stops saying PROVISIONAL.
- The verdict stays auditable. Because the model returns observations and never a judgement, every verdict traces to a local rule with a cited source, which is the product's actual claim.
- The deferred "more regions" work becomes nearly free: a second region is a new rule set, with no prompt change and no proxy redeploy.
- One `zod` declaration produces the validator, the TypeScript type and the JSON schema for Gemini, so those three cannot drift apart within the proxy.
- `store: false` makes the queued privacy note short and true: the photo is sent, read, and not kept.
- Eleven named error codes let feature 10 write a distinct, useful screen per failure instead of one shrug.
- The engine is provable with `curl` before the phone is wired in, so when feature 7 fails you know it is the wiring.

**Negative and tradeoffs**:

- **The schema is duplicated by hand across the import boundary**, and the drift is silent until a validation failure in production. This is the single most likely thing in here to bite you, and it is the direct cost of the rule that the app and the proxy may not import each other.
- **A self reported score is still the model's guess about its own guess.** Banding it into high, medium and low makes it look calibrated when nothing has been measured. AC-15's photo set is the only thing that turns it into evidence, and until that runs, the bands are a plausible guess dressed as a measurement.
- Six attributes is a longer prompt and two more things for the model to get wrong than the four the scope named. `form` in particular may get confused with `material`, since both describe the plastic.
- `score` travels in the payload so feature 4's thresholds stay tunable without a proxy redeploy. `DisplayAttribute` makes a screen printing it a compile error, which closes the obvious hole, but the number is still on the wire and a determined caller can read it.
- `zod` adds a dependency and some cold start time to a function already fighting the timeout that spec 0001 called the real risk in the whole design.
- `AttributeKey` grows from four to six and `Confidence` loses a variant, so spec 0002's components get touched again. Spec 0002 predicted exactly this, which does not make it free.
- The public unauthenticated endpoint means your Gemini quota is spendable by anyone with the APK. Accepted, not solved.
- The photo set is manual labour, costs quota to run, and has to be reshot if the prompt changes meaningfully.

**Neutral**:

- The prototype's percent displays ("88%", "74%") disappear from the attribute rows. The screens in `screen-shots/` are already marked superseded, so this widens a gap that is already documented.
- `src/vision/mock.ts` gets rewritten. It was always labelled as scaffolding to be replaced by feature 7.
- The `label` field leaves the wire shape, since sending six constant strings per scan buys nothing.
- `recyclingSymbol` does not report the resin number it read. `material` already carries that, informed by the symbol, and the `display` line can mention it.

## Follow-up

- [ ] **Settle the structured output parameter against the installed SDK types before writing the call.** `structured-output.md` documents a top level `response_format` with `{ type, mime_type, schema }`; `interactions.md` shows `responseSchema` inside `generationConfig`, which is the legacy `generateContent` shape. One of them does not apply to `interactions.create`. The TypeScript types in `node_modules/@google/genai` are the authority. This is build plan task 1 and nothing else can start without it.
- [ ] Confirm the maximum function duration Vercel's free tier allows and set `maxDuration` explicitly. The 25 second abort in AC-9 assumes you get more than 25 seconds. Carried from spec 0001 and now load bearing.
- [ ] Rotate `GEMINI_API_KEY` before you submit the project and confirm it never entered git history. Carried from spec 0001.
- [ ] Feature 4 owns the `score` thresholds that decide a verdict, which are a separate decision from the display bands fixed here at 80 and 50.
- [ ] The queued privacy note can now say photos are not retained by the provider, because of `store: false`. Worth writing while the reason is fresh.
- [ ] Revisit whether `form` should fold back into `material` if the photo set shows the model confusing the two axes.
- [ ] Features 4 and 5 still have no specs, and both consume this vocabulary. Expect a second pass on `AttributeRow` and `RuleCard` once they run, as spec 0002 already flagged.
- [ ] If quota becomes the binding constraint during the demo, `gemini-3.5-flash-lite` is the fallback model, but reread the photo set results before trusting it on a faded symbol.
- [ ] A shared 25 second budget means a retry only helps when the first attempt failed fast. If the photo set shows validation failures arriving late, the retry is doing nothing and should either be dropped or given its own budget with the app's timeout raised to match.
- [ ] `MAX_IMAGE_BYTES` in `proxy/api/vision.ts` is compared against `image.length`, which counts base64 characters rather than bytes, so the real ceiling is nearer 4.5MB of image than 6MB. Inherited from spec 0001's scaffold, harmless, worth renaming when the file is next open.
