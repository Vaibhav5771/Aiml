/**
 * The second opinion: a trained image classifier, called beside Gemini.
 *
 * Spec 0005 wants the machine learning part of this project to be evaluable
 * rather than decorative, and it wants a learned stage whose only power is to
 * refuse. This is that stage's first real model.
 * `prithivMLmods/Recycling-Net-11` is a SigLIP2 base fine tuned on
 * `viola77data/recycling-dataset`: 11 waste classes, 92.9M parameters, Apache
 * 2.0, reporting 91.28% accuracy on its own held out split.
 *
 * WHY IT IS CALLED AND NOT BUNDLED. Three doors were shut before this one.
 * Running it on the phone needs a native inference runtime, which needs a
 * development build, which spec 0001 rules out in favour of Expo Go. Bundling
 * the weights into this function means 372MB of F32 tensors against Vercel's
 * 250MB unzipped ceiling. Converting to quantised ONNX would fit, at the price
 * of three unmeasured risks at once: quantisation error on a vision tower, a
 * bundle within 35MB of the ceiling, and a resize and normalisation
 * reimplemented in JavaScript where a `SiglipImageProcessor` does it exactly
 * today. So it is reached over HTTP, exactly as Gemini is, and for the same
 * reason: the thing holding a credential lives here.
 *
 * WHY NOT HUGGING FACE'S OWN INFERENCE API. It was written that way first and
 * could never have worked. HF serves no provider for this model:
 *
 *   GET /api/models/prithivMLmods/Recycling-Net-11?expand[]=inferenceProviderMapping
 *   -> "inferenceProviderMapping": {}
 *
 * and it appears in no hf-inference listing. A token does not change that; the
 * call returns `Model not supported` rather than a classification, and no
 * waste classifier is served there to swap to. `classifier/` in this repo is
 * the service that answers instead: the same weights, their own processor, on
 * a free Space you own. Its reply shape is hf-inference's on purpose, so
 * `parseClassification` below never learned the difference and a paid
 * Inference Endpoint later is one environment variable.
 *
 * WHAT IT IS FOR. Gemini reads a resin code; this reads a photograph. They are
 * wrong in uncorrelated ways, and a disagreement between them is a signal
 * neither one produces alone. That signal is the input spec 0005's learned
 * gate was designed around, and it can only ever hold an answer back.
 *
 * NOTHING HERE CAN FAIL A REQUEST. Every path returns an outcome; none throws
 * and none is fatal. When the classifier is unconfigured, slow, cold or
 * broken, the response is exactly the response Gemini alone would have
 * produced, minus the `classifier` field. Spec 0005's AC-6 is the rule and
 * this is the proxy side of it: a model this build cannot trust is worth less
 * than no model at all.
 *
 * Deploy note: Vercel turns every file in `api/` into its own function, so
 * this is reachable as a dead `/api/classifier` route. It exports no handler,
 * so it does nothing. Same as `schema.ts` and `prompt.ts`.
 */

import type { MaterialCode } from './schema.js';

/**
 * Pinned by name, like `MODEL` in `vision.ts` and for the same reason: which
 * model produced a result has to be recoverable from git, and an environment
 * variable makes that unanswerable six weeks later.
 */
export const CLASSIFIER_MODEL = 'prithivMLmods/Recycling-Net-11';

/**
 * Bumped whenever the model, the label map or the family comparison changes,
 * because all three change what a stored `agrees` meant. Spec 0005 records a
 * `modelVersion` on every scan; this is the proxy side of that.
 */
export const CLASSIFIER_VERSION = 'recycling-net-11@v1';

/**
 * Where the classifier actually answers: the full URL of a `/classify`
 * endpoint, set in the environment.
 *
 * A whole URL rather than a host plus a model path, because the model name is
 * no longer part of the address. The service decides which weights it loads
 * and says so on `/health`, which keeps the one fact that matters, WHICH model
 * judged a scan, recoverable from two pinned constants and a health check
 * rather than from a URL someone could point anywhere.
 *
 * Unset is an ordinary state, not an error: see `beginSecondOpinion`.
 */
const CLASSIFIER_URL = process.env.CLASSIFIER_URL ?? '';

/**
 * Deliberately tighter than vision's 25 seconds. The classifier is an extra
 * opinion, not the answer, so it is never allowed to be the reason a user
 * waits. It runs beside the Gemini call rather than after it, so this budget
 * overlaps that one instead of adding to it.
 *
 * A cold hf-inference model can take 20 seconds or more to load on its first
 * hit. That first scan simply gets no second opinion, which is the designed
 * failure rather than a bug to tune away.
 */
const CLASSIFIER_DEADLINE_MS = 8_000;

/** How much of a bad classifier reply reaches the log. Never the image, never the token. */
const RAW_LOG_CHARS = 400;

/* ---------------------------------------------------------------------------
 * The label map.
 * ------------------------------------------------------------------------ */

/**
 * The model's 11 labels, verbatim from its `config.json` `id2label`, against
 * this project's material vocabulary.
 *
 * `undefined` means "no material opinion", and it is a real answer rather than
 * a gap. Two labels earn it: `batteries` is not packaging and has no code in
 * spec 0003's list, and `disposable plates` names an ITEM rather than a
 * material, since the same plate is paper, polystyrene or plastic depending on
 * the shop. Claiming a material there would manufacture a disagreement out of
 * the label set's own imprecision.
 *
 * Two mappings are judgements worth naming:
 *
 * - `hard plastic` and `soft plastics` both become `other_plastic`. The
 *   classifier sees a photograph, not a resin code, so it genuinely cannot
 *   tell PET from HDPE and must not be made to look as though it can.
 * - `takeaway cups` becomes `composite_laminate`, because that is what they
 *   are: paperboard with a bonded polyethylene lining. This is the most useful
 *   row here. A cup Gemini reads as `paper` is the exact item the product gets
 *   wrong, and it is the one case where knowing the ITEM beats a material read.
 */
export const LABEL_TO_MATERIAL: Readonly<Record<string, MaterialCode | undefined>> = {
  aluminium: 'aluminium',
  batteries: undefined,
  cardboard: 'cardboard',
  'disposable plates': undefined,
  glass: 'glass',
  'hard plastic': 'other_plastic',
  paper: 'paper',
  'paper towel': 'paper',
  polystyrene: 'ps',
  'soft plastics': 'other_plastic',
  'takeaway cups': 'composite_laminate',
};

/**
 * Material families, because comparing codes directly would be a lie.
 *
 * Gemini can read `pp` off a moulded triangle. The classifier's richest
 * plastic answer is `other_plastic`. Those two agree in every sense that
 * matters, and a code level inequality would call it a disagreement on almost
 * every plastic item in the world, firing the learned gate constantly and
 * teaching the team to ignore it.
 *
 * So agreement is asked at the coarsest level both models actually speak: is
 * this plastic, glass, metal, fibre or a laminate. `composite_laminate` stands
 * alone on purpose, because "a paper cup is not paper" is precisely the
 * disagreement worth keeping.
 */
export type MaterialFamily = 'plastic' | 'glass' | 'metal' | 'fibre' | 'composite' | 'unknown';

export const MATERIAL_FAMILY: Readonly<Record<MaterialCode, MaterialFamily>> = {
  pet: 'plastic',
  hdpe: 'plastic',
  pvc: 'plastic',
  ldpe: 'plastic',
  pp: 'plastic',
  ps: 'plastic',
  other_plastic: 'plastic',
  glass: 'glass',
  aluminium: 'metal',
  steel: 'metal',
  paper: 'fibre',
  cardboard: 'fibre',
  composite_laminate: 'composite',
  unknown: 'unknown',
};

/* ---------------------------------------------------------------------------
 * What the classifier produces.
 * ------------------------------------------------------------------------ */

/** Whether the two models saw the same kind of thing. */
export type Agreement = 'agree' | 'disagree' | 'no_opinion';

export type Classification = {
  /** The model's own top label, verbatim. Travels even when it maps to no material. */
  readonly label: string;
  /** 0 to 100, to match how every other score in this product is expressed. */
  readonly score: number;
  /** The label in this project's vocabulary, absent when the label names no material. */
  readonly material?: MaterialCode;
  /** Against Gemini's material read. `no_opinion` is not a disagreement. */
  readonly agrees: Agreement;
  /** Pinned, so a stored scan can say which model and which label map judged it. */
  readonly modelVersion: string;
};

/**
 * Why there is no second opinion. None of these reach the user; they exist so
 * a log line can tell "we never asked" apart from "we asked and it broke",
 * which is the difference between a missing token and a dead provider.
 */
export type ClassifierFailure =
  | 'classifier_not_configured'
  | 'classifier_unavailable'
  | 'classifier_invalid_response'
  | 'classifier_timeout';

export type ClassifierOutcome =
  | { readonly ok: true; readonly value: Classification }
  | { readonly ok: false; readonly code: ClassifierFailure; readonly raw?: string };

/** One attempt, kept behind a function type so the whole module tests with no network. */
export type ClassifierCall = () => Promise<
  { ok: true; body: unknown } | { ok: false; code: ClassifierFailure; raw?: string }
>;

/* ---------------------------------------------------------------------------
 * Pure: reading a reply, and comparing two opinions.
 * ------------------------------------------------------------------------ */

/**
 * Compare a classifier label against Gemini's material code, by family.
 *
 * `unknown` on either side is `no_opinion` rather than a disagreement. Two
 * models declining to guess is not a conflict, and treating it as one would
 * make the gate fire hardest on exactly the reads the written gates already
 * catch.
 */
export function agreementWith(
  material: MaterialCode | undefined,
  geminiMaterial: MaterialCode,
): Agreement {
  if (material === undefined) return 'no_opinion';

  const ours = MATERIAL_FAMILY[material];
  const theirs = MATERIAL_FAMILY[geminiMaterial];

  if (ours === 'unknown' || theirs === 'unknown') return 'no_opinion';

  return ours === theirs ? 'agree' : 'disagree';
}

function preview(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, RAW_LOG_CHARS);
  } catch {
    return String(value).slice(0, RAW_LOG_CHARS);
  }
}

/**
 * The hf-inference reply: an array of `{ label, score }`, best first.
 *
 * Not trusted to be sorted. The documented contract says the array is the
 * distribution and says nothing binding about order, so the top is taken by
 * comparing scores rather than by reading index 0.
 *
 * A label outside the 11 means a different model is answering this URL, which
 * is a deployment mistake rather than a bad photo, so it is refused rather
 * than passed through with no material.
 */
export function parseClassification(
  body: unknown,
  geminiMaterial: MaterialCode,
): ClassifierOutcome {
  if (!Array.isArray(body) || body.length === 0) {
    return { ok: false, code: 'classifier_invalid_response', raw: preview(body) };
  }

  const rows = body.filter(
    (row): row is { label: string; score: number } =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as { label?: unknown }).label === 'string' &&
      typeof (row as { score?: unknown }).score === 'number' &&
      Number.isFinite((row as { score: number }).score),
  );

  if (rows.length === 0) {
    return { ok: false, code: 'classifier_invalid_response', raw: preview(body) };
  }

  const top = rows.reduce((best, row) => (row.score > best.score ? row : best));

  if (!Object.prototype.hasOwnProperty.call(LABEL_TO_MATERIAL, top.label)) {
    return { ok: false, code: 'classifier_invalid_response', raw: preview(top.label) };
  }

  const material = LABEL_TO_MATERIAL[top.label];

  return {
    ok: true,
    value: {
      label: top.label,
      // The provider reports a 0 to 1 probability; every score in this product
      // is 0 to 100, and spec 0003 made that the wire convention.
      score: Math.round(Math.max(0, Math.min(1, top.score)) * 100),
      ...(material === undefined ? {} : { material }),
      agrees: agreementWith(material, geminiMaterial),
      modelVersion: CLASSIFIER_VERSION,
    },
  };
}

/* ---------------------------------------------------------------------------
 * Impure: the call itself.
 * ------------------------------------------------------------------------ */

/**
 * One HTTP call to the classifier service, with its own abort timer.
 *
 * Its own timer rather than vision's shared one, because the two calls run in
 * parallel on different budgets and a classifier that is merely slow must
 * never shorten the Gemini attempt it is racing.
 *
 * The image arrives here base64 because that is how the app sends it, and goes
 * out as raw bytes under its own `image/*` content type. Decoding once here is
 * cheaper than asking the service to decode a 4MB string, and it is the same
 * payload hf-inference took, which is what keeps this swappable.
 *
 * The token is sent only when there is one. The service treats an absent
 * `CLASSIFIER_TOKEN` as an open endpoint so a first deploy answers before the
 * secret is set, and a header reading `Bearer ` with nothing after it would
 * fail that check rather than skip it.
 */
export function classifierCall(
  url: string,
  token: string,
  { image, mimeType }: { image: string; mimeType: string },
): ClassifierCall {
  return async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLASSIFIER_DEADLINE_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          'content-type': mimeType,
        },
        body: Buffer.from(image, 'base64'),
        signal: controller.signal,
      });

      if (!response.ok) {
        // A 5xx here is ordinarily a free Space waking up, which takes longer
        // than this call's whole budget. It is not retried: the retry would
        // cost more than the opinion is worth, and the next scan finds it warm.
        const detail = await response.text().catch(() => '');
        console.error(
          `[classifier] HTTP ${response.status} ${detail.slice(0, RAW_LOG_CHARS)}`,
        );
        return { ok: false, code: 'classifier_unavailable', raw: detail.slice(0, RAW_LOG_CHARS) };
      }

      return { ok: true, body: await response.json() };
    } catch (error) {
      const aborted = controller.signal.aborted;
      // Why it failed, not just that it did, matching how `geminiCall` logs.
      console.error(
        `[classifier] ${aborted ? 'timeout' : 'error'} ${String(
          (error as { message?: string })?.message ?? error,
        ).slice(0, RAW_LOG_CHARS)}`,
      );
      return { ok: false, code: aborted ? 'classifier_timeout' : 'classifier_unavailable' };
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * Call, then read the reply. The whole second opinion, in one function.
 *
 * No retry, unlike `readPackaging`. A second opinion that needs two attempts
 * to arrive has already cost more than it is worth, and spec 0005's design
 * says the app must be no worse off without it.
 */
export async function classify(
  call: ClassifierCall,
  geminiMaterial: MaterialCode,
): Promise<ClassifierOutcome> {
  const called = await call();
  if (!called.ok) return { ok: false, code: called.code, ...(called.raw ? { raw: called.raw } : {}) };

  return parseClassification(called.body, geminiMaterial);
}

/* ---------------------------------------------------------------------------
 * The two phase entry point `vision.ts` uses.
 *
 * Split in two because of a timing fact: the INFERENCE needs only the photo,
 * but the AGREEMENT needs Gemini's material code, which does not exist until
 * Gemini answers. Running them in sequence would add the classifier's latency
 * to every scan for no reason. So the fetch is started first, the Gemini read
 * is awaited, and the two are compared once both are in hand. The classifier
 * costs wall clock only when it is slower than Gemini, which it never is.
 * ------------------------------------------------------------------------ */

/** A classifier call already in flight. Never rejects; failures are values. */
export type PendingClassification = Promise<
  { ok: true; body: unknown } | { ok: false; code: ClassifierFailure; raw?: string }
>;

/**
 * Fire the classifier now, before Gemini has answered.
 *
 * A missing URL is an ordinary unconfigured state rather than a deployment
 * error, which is the opposite of how `GEMINI_API_KEY` is treated in
 * `vision.ts` and deliberately so: without Gemini there is no product, while
 * without this there is simply no second opinion. A deploy with no classifier
 * is a supported configuration, and the app cannot tell it from one whose
 * Space is asleep.
 */
export function beginSecondOpinion(request: {
  image: string;
  mimeType: string;
}): PendingClassification {
  if (!CLASSIFIER_URL) {
    return Promise.resolve({ ok: false as const, code: 'classifier_not_configured' });
  }

  // Invoked here rather than returned, so the request is on the wire while the
  // Gemini call runs. `classifierCall` catches its own failures, so this
  // promise settles rather than rejecting, and no caller needs a `.catch`.
  return classifierCall(CLASSIFIER_URL, process.env.CLASSIFIER_TOKEN ?? '', request)();
}

/** Await the call started above and compare it with what Gemini said. */
export async function resolveSecondOpinion(
  pending: PendingClassification,
  geminiMaterial: MaterialCode,
): Promise<ClassifierOutcome> {
  const called = await pending;
  if (!called.ok) {
    return { ok: false, code: called.code, ...(called.raw ? { raw: called.raw } : {}) };
  }

  return parseClassification(called.body, geminiMaterial);
}
