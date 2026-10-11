/**
 * The attribute vocabulary: the fixed set of named observations a photo
 * produces, and the verdict the rules turn them into.
 *
 * This is a COPY, kept by hand. `proxy/api/schema.ts` is the source of truth
 * and [spec 0003](../../docs/specs/0003-packaging-vision-read/index.md) is the
 * authority over both. The duplication exists because `proxy/AGENTS.md`
 * forbids the app and the proxy from importing each other, and spec 0003 names
 * the silent drift between these two files as the most likely thing in the
 * feature to bite you. If you change a code here, change it there too.
 *
 * Feature 4 (Local recycling rule set) owns the rules that turn these
 * observations into a verdict. Nothing in this file decides anything.
 */

/** The order the six rows are read in. The wire shape is an object, and objects carry no order. */
export const ATTRIBUTE_ORDER = [
  'material',
  'form',
  'recyclingSymbol',
  'construction',
  'contamination',
  'photoQuality',
] as const;

export type AttributeKey = (typeof ATTRIBUTE_ORDER)[number];

/** The small grey caption above each read. Never sent over the wire. */
export const ATTRIBUTE_LABEL: Record<AttributeKey, string> = {
  material: 'Material',
  form: 'Form',
  recyclingSymbol: 'Recycling symbol',
  construction: 'Construction',
  // "Cleanliness" rather than "Contamination": the code is the machine's word,
  // the caption is the reader's. Feature 9 owns the final screen copy.
  contamination: 'Cleanliness',
  photoQuality: 'Photo quality',
};

export type MaterialCode =
  | 'pet'
  | 'hdpe'
  | 'pvc'
  | 'ldpe'
  | 'pp'
  | 'ps'
  | 'other_plastic'
  | 'glass'
  | 'aluminium'
  | 'steel'
  | 'paper'
  | 'cardboard'
  | 'composite_laminate'
  | 'unknown';

export type FormCode = 'rigid' | 'film' | 'foam' | 'fibre' | 'unknown';

/** `absent` means it looked and there is none. `unknown` means it could not tell. */
export type SymbolCode = 'readable' | 'faded' | 'absent' | 'unknown';

export type ConstructionCode = 'single_material' | 'multi_material' | 'unknown';

export type ContaminationCode = 'clean' | 'light_residue' | 'heavy_residue' | 'unknown';

/** No `unknown`: this describes the photo rather than the packaging, so it is always assessable. */
export type PhotoQualityCode = 'good' | 'fair' | 'poor';

/**
 * How sure the read is.
 *
 * One shape, and a coarse one. The proxy derives this from a score the model
 * reports, at fixed thresholds, and the app never computes a band of its own.
 * An `unknown` code is always `low`, whatever score came back with it.
 */
export type ConfidenceBand = 'high' | 'medium' | 'low';

/**
 * The full read of one attribute, as it arrives on the wire.
 *
 * Feature 4's rule engine takes this, because its thresholds need the number.
 * Screens take `DisplayAttribute` instead.
 */
export type AttributeRead<C extends string> = {
  code: C;
  /** Plain words, 60 characters or fewer. Guaranteed by the proxy, so no fallback is needed. */
  display: string;
  confidence: ConfidenceBand;
  /** 0 to 100. Feature 4 only. */
  score: number;
};

/**
 * What a SCREEN is handed. `score` is absent from the type, so no screen can
 * print it even by mistake. This replaces a written rule with a compiler error.
 */
export type DisplayAttribute<C extends string> = Omit<AttributeRead<C>, 'score'>;

type Attributes<T> = {
  material: T extends 'full' ? AttributeRead<MaterialCode> : DisplayAttribute<MaterialCode>;
  form: T extends 'full' ? AttributeRead<FormCode> : DisplayAttribute<FormCode>;
  recyclingSymbol: T extends 'full' ? AttributeRead<SymbolCode> : DisplayAttribute<SymbolCode>;
  construction: T extends 'full'
    ? AttributeRead<ConstructionCode>
    : DisplayAttribute<ConstructionCode>;
  contamination: T extends 'full'
    ? AttributeRead<ContaminationCode>
    : DisplayAttribute<ContaminationCode>;
  photoQuality: T extends 'full'
    ? AttributeRead<PhotoQualityCode>
    : DisplayAttribute<PhotoQualityCode>;
};

/** Every attribute with its score. What the proxy returns and feature 4 reads. */
export type VisionAttributes = Attributes<'full'>;

/** Every attribute without its score. What the screens read. */
export type DisplayAttributes = Attributes<'display'>;

/** Exactly what `POST /api/vision` returns on a 200. */
export type VisionRead = {
  itemName: string;
  /** An optional caveat, 160 characters or fewer. */
  note?: string;
  attributes: VisionAttributes;
};

export type VerdictKind = 'recyclable' | 'notRecyclable' | 'checkManually';

/** The rule that fired, with the source it came from. */
export type AppliedRule = {
  /** Plain words a non expert can follow. */
  text: string;
  /** Where it came from. The scope requires every rule to carry this. */
  source: string;
};

export type Scan = {
  id: string;
  /** Local file path to the photo. */
  photoUri: string;
  /** What the item appears to be, e.g. "Yogurt tub". */
  itemName: string;
  scannedAt: string;
  verdict: VerdictKind;
  /** The one line action, e.g. "Kerbside bin, rinse it first". */
  action: string;
  /** Overall confidence in the verdict, 0 to 100. Feature 4 decides it. */
  confidence: number;
  attributes: DisplayAttributes;
  rule: AppliedRule;
  /**
   * An optional caveat shown under the attributes, e.g. that the symbol was
   * faded so the material was judged another way. Nothing on screen may claim
   * more certainty than the attributes support.
   */
  note?: string;
};

/*
 * Display copy for a verdict used to live here. It now lives in
 * `src/components/verdict.ts`, beside the icon and the colour that have to
 * stay in step with it, because spec 0002 makes that record the one place a
 * verdict becomes something you can see. This file keeps the vocabulary;
 * that file keeps its presentation.
 */
