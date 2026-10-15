/**
 * The attribute vocabulary, declared once.
 *
 * Spec 0003 makes this file the source of truth for what a photo read is. One
 * `zod` declaration produces three things that then cannot drift apart inside
 * the proxy: the runtime validator, the TypeScript types, and the JSON schema
 * handed to Gemini.
 *
 * `src/vision/types.ts` in the app carries a copy of the same shape kept by
 * hand, because `proxy/AGENTS.md` forbids the app and the proxy from importing
 * each other. That duplication is deliberate and spec 0003 names it as the
 * most likely thing in this feature to bite you.
 *
 * Deploy note: Vercel turns every file in `api/` into its own function, so this
 * one is reachable as a dead `/api/schema` route. It exports no handler, so it
 * does nothing. If the build ever objects, rename this and `prompt.ts` with a
 * leading underscore, which Vercel skips, and update the two imports.
 */

import { z } from 'zod';

/** The order the six rows are read in. The wire shape is an object, and objects carry no order. */
export const ATTRIBUTE_KEYS = [
  'material',
  'form',
  'recyclingSymbol',
  'construction',
  'contamination',
  'photoQuality',
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

/**
 * The six closed lists. Every code the model may answer with.
 *
 * `material` and `form` are two axes on purpose, so a feature 4 rule can say
 * "PP, but only when rigid" without the enum multiplying out into every resin
 * and form pair. `photoQuality` carries no `unknown` because it describes the
 * photo rather than the packaging, so it is always assessable.
 */
export const CODES = {
  material: [
    'pet',
    'hdpe',
    'pvc',
    'ldpe',
    'pp',
    'ps',
    'other_plastic',
    'glass',
    'aluminium',
    'steel',
    'paper',
    'cardboard',
    'composite_laminate',
    'unknown',
  ],
  form: ['rigid', 'film', 'foam', 'fibre', 'unknown'],
  recyclingSymbol: ['readable', 'faded', 'absent', 'unknown'],
  construction: ['single_material', 'multi_material', 'unknown'],
  contamination: ['clean', 'light_residue', 'heavy_residue', 'unknown'],
  photoQuality: ['good', 'fair', 'poor'],
} as const satisfies Record<AttributeKey, readonly [string, ...string[]]>;

export type MaterialCode = (typeof CODES.material)[number];
export type FormCode = (typeof CODES.form)[number];
export type SymbolCode = (typeof CODES.recyclingSymbol)[number];
export type ConstructionCode = (typeof CODES.construction)[number];
export type ContaminationCode = (typeof CODES.contamination)[number];
export type PhotoQualityCode = (typeof CODES.photoQuality)[number];

export type ConfidenceBand = 'high' | 'medium' | 'low';

/**
 * The only place a score becomes a band.
 *
 * The model never reports the band and the app never computes one, so these
 * two numbers are the whole definition of "how sure" anywhere in the product.
 * Feature 4 owns the separate thresholds that decide a verdict.
 */
export const BANDS = { high: 80, medium: 50 } as const;

export function bandFor(score: number): ConfidenceBand {
  if (score >= BANDS.high) return 'high';
  if (score >= BANDS.medium) return 'medium';
  return 'low';
}

/**
 * Caps on the three free text fields.
 *
 * These are a wire guarantee, not a hope: the proxy trims then truncates, so
 * the app needs no fallback. Truncating beats rejecting, because a display
 * line ten characters too long is cosmetic, and failing a whole read over it
 * would burn the retry and cost a good set of codes.
 */
export const TEXT_CAPS = { itemName: 60, display: 60, note: 160 } as const;

/** Trim happens in the validator; this is the truncate half. */
export function cap(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd();
}

/* ---------------------------------------------------------------------------
 * What the model is allowed to reply with.
 * ------------------------------------------------------------------------ */

/**
 * Trimmed by the validator, so "empty after trimming" is the one text failure.
 * Length is not checked here on purpose; see TEXT_CAPS.
 */
const TEXT = z.string().trim().min(1);

const modelAttribute = <T extends readonly [string, ...string[]]>(codes: T) =>
  z.object({
    code: z.enum(codes),
    display: TEXT,
    score: z.number().int().min(0).max(100),
  });

const modelAttributes = z.object({
  material: modelAttribute(CODES.material),
  form: modelAttribute(CODES.form),
  recyclingSymbol: modelAttribute(CODES.recyclingSymbol),
  construction: modelAttribute(CODES.construction),
  contamination: modelAttribute(CODES.contamination),
  photoQuality: modelAttribute(CODES.photoQuality),
});

/**
 * A discriminated union on a required `packagingFound`, so "there is no
 * packaging here" is a complete and valid reply rather than six `unknown`
 * codes the handler would have to interpret. The handler branches on it before
 * it looks at `attributes` at all.
 */
export const geminiReplySchema = z.discriminatedUnion('packagingFound', [
  z.object({ packagingFound: z.literal(false) }),
  z.object({
    packagingFound: z.literal(true),
    itemName: TEXT,
    note: TEXT.optional(),
    attributes: modelAttributes,
  }),
]);

export type GeminiReply = z.infer<typeof geminiReplySchema>;

/* ---------------------------------------------------------------------------
 * What the proxy returns. Not the same shape: `confidence` is added here and
 * `packagingFound` is stripped.
 * ------------------------------------------------------------------------ */

export type AttributeRead<C extends string> = {
  code: C;
  display: string;
  confidence: ConfidenceBand;
  score: number;
};

/**
 * What a SCREEN is handed. `score` is absent from the type, so no screen can
 * print it even by mistake. Feature 4's rule engine reads the full
 * `AttributeRead` instead. This replaces a written rule with a compiler error.
 */
export type DisplayAttribute<C extends string> = Omit<AttributeRead<C>, 'score'>;

export type VisionAttributes = {
  material: AttributeRead<MaterialCode>;
  form: AttributeRead<FormCode>;
  recyclingSymbol: AttributeRead<SymbolCode>;
  construction: AttributeRead<ConstructionCode>;
  contamination: AttributeRead<ContaminationCode>;
  photoQuality: AttributeRead<PhotoQualityCode>;
};

export type VisionRead = {
  itemName: string;
  note?: string;
  attributes: VisionAttributes;
};

/** The `packagingFound: true` half of the union, which is the only one that normalises. */
export type FoundReply = Extract<GeminiReply, { packagingFound: true }>;

function toAttribute<C extends string>(raw: {
  code: C;
  display: string;
  score: number;
}): AttributeRead<C> {
  return {
    code: raw.code,
    display: cap(raw.display, TEXT_CAPS.display),
    /*
     * An `unknown` code is never confident, whatever score came back with it.
     * `score` itself travels unchanged, because feature 4 reads the number and
     * only the band is a claim the screen makes.
     */
    confidence: raw.code === 'unknown' ? 'low' : bandFor(raw.score),
    score: raw.score,
  };
}

/** Model reply to wire shape: truncate the text, derive the bands, drop `packagingFound`. */
export function normalise(reply: FoundReply): VisionRead {
  const a = reply.attributes;
  const read: VisionRead = {
    itemName: cap(reply.itemName, TEXT_CAPS.itemName),
    attributes: {
      material: toAttribute(a.material),
      form: toAttribute(a.form),
      recyclingSymbol: toAttribute(a.recyclingSymbol),
      construction: toAttribute(a.construction),
      contamination: toAttribute(a.contamination),
      photoQuality: toAttribute(a.photoQuality),
    },
  };

  return reply.note === undefined ? read : { ...read, note: cap(reply.note, TEXT_CAPS.note) };
}

/* ---------------------------------------------------------------------------
 * The JSON schema handed to Gemini.
 *
 * Written out rather than generated from the `zod` schema, because Gemini
 * accepts a subset of OpenAPI 3.0 and a general JSON Schema emitter adds
 * keywords ($schema, $defs, additionalProperties) that the subset rejects.
 * Both halves read their codes from CODES above, so the lists cannot drift.
 * ------------------------------------------------------------------------ */

/** What each attribute means, in the model's words rather than ours. */
const HINTS: Record<AttributeKey, string> = {
  material:
    'The material the packaging is mostly made of. Use the resin if a code or symbol identifies it.',
  form: 'The physical form of that material: rigid, a thin film, foam, or a fibrous moulded pulp.',
  recyclingSymbol:
    'Use "readable" only if you can actually read the symbol, "faded" if one is there but not legible, "absent" if you looked and there is none, and "unknown" if you cannot tell either way.',
  construction:
    'Whether more than one material is joined together, such as a film lid on a plastic tray.',
  contamination: 'How clean the item looks: food residue, liquid, or grease left on or in it.',
  photoQuality:
    'How usable this photo was for the read: focus, lighting, framing, and how much of the item is visible.',
};

function attributeSchema(key: AttributeKey) {
  return {
    type: 'object',
    description: HINTS[key],
    properties: {
      code: { type: 'string', enum: [...CODES[key]] },
      display: {
        type: 'string',
        description: `Plain words a non expert can read, ${TEXT_CAPS.display} characters or fewer, describing what you saw. No advice.`,
      },
      score: {
        type: 'integer',
        description:
          'How sure you are of this one code, 0 to 100. Be honest; a low number is more useful than a confident guess.',
      },
    },
    required: ['code', 'display', 'score'],
    propertyOrdering: ['code', 'display', 'score'],
  };
}

export function geminiJsonSchema(): Record<string, unknown> {
  const attributes = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, attributeSchema(key)]));

  return {
    anyOf: [
      {
        type: 'object',
        description:
          'Use this shape when there is no packaging in the photo at all. Answer nothing else.',
        properties: {
          packagingFound: {
            type: 'boolean',
            description: 'false: there is no packaging in this photo.',
          },
        },
        required: ['packagingFound'],
        propertyOrdering: ['packagingFound'],
      },
      {
        type: 'object',
        description:
          'Use this shape when there is packaging in the photo. Every attribute is required.',
        properties: {
          packagingFound: {
            type: 'boolean',
            description: 'true: there is packaging in this photo.',
          },
          itemName: {
            type: 'string',
            description: `What the item appears to be, such as "Yogurt tub", ${TEXT_CAPS.itemName} characters or fewer.`,
          },
          note: {
            type: 'string',
            description: `One short sentence, ${TEXT_CAPS.note} characters or fewer, only if something about the read needs a caveat. Omit it otherwise.`,
          },
          attributes: {
            type: 'object',
            properties: attributes,
            required: [...ATTRIBUTE_KEYS],
            propertyOrdering: [...ATTRIBUTE_KEYS],
          },
        },
        required: ['packagingFound', 'itemName', 'attributes'],
        propertyOrdering: ['packagingFound', 'itemName', 'note', 'attributes'],
      },
    ],
  };
}
