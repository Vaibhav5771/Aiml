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

/*
 * The six closed lists, as runtime values with their types derived from them.
 *
 * Written this way round on purpose. A hand written union plus a hand written
 * array is two things that drift; deriving the type from the array makes a
 * drift between them impossible to express. `ATTRIBUTE_ORDER` above already
 * works like this.
 *
 * They have to exist at runtime because two callers need to test membership
 * rather than describe it: `validate.ts`, which cannot trust a code the proxy
 * sent until it has checked it, and `src/rules/rule-set.test.ts`, which holds
 * every code in `pune.json` to this vocabulary. Neither can read a type.
 */

export const MATERIAL_CODES = [
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
] as const;

export type MaterialCode = (typeof MATERIAL_CODES)[number];

export const FORM_CODES = ['rigid', 'film', 'foam', 'fibre', 'unknown'] as const;

export type FormCode = (typeof FORM_CODES)[number];

/** `absent` means it looked and there is none. `unknown` means it could not tell. */
export const SYMBOL_CODES = ['readable', 'faded', 'absent', 'unknown'] as const;

export type SymbolCode = (typeof SYMBOL_CODES)[number];

export const CONSTRUCTION_CODES = ['single_material', 'multi_material', 'unknown'] as const;

export type ConstructionCode = (typeof CONSTRUCTION_CODES)[number];

export const CONTAMINATION_CODES = ['clean', 'light_residue', 'heavy_residue', 'unknown'] as const;

export type ContaminationCode = (typeof CONTAMINATION_CODES)[number];

/** No `unknown`: this describes the photo rather than the packaging, so it is always assessable. */
export const PHOTO_QUALITY_CODES = ['good', 'fair', 'poor'] as const;

export type PhotoQualityCode = (typeof PHOTO_QUALITY_CODES)[number];

/** Every attribute's allowed codes, keyed the way the wire keys them. */
export const VOCABULARY: { readonly [K in AttributeKey]: readonly string[] } = {
  material: MATERIAL_CODES,
  form: FORM_CODES,
  recyclingSymbol: SYMBOL_CODES,
  construction: CONSTRUCTION_CODES,
  contamination: CONTAMINATION_CODES,
  photoQuality: PHOTO_QUALITY_CODES,
};

/**
 * How sure the read is.
 *
 * One shape, and a coarse one. The proxy derives this from a score the model
 * reports, at fixed thresholds, and the app never computes a band of its own.
 * An `unknown` code is always `low`, whatever score came back with it.
 */
export type ConfidenceBand = 'high' | 'medium' | 'low';

/**
 * The score boundaries a band sits on.
 *
 * Another hand kept COPY, of `BANDS` in `proxy/api/schema.ts`, for the same
 * reason the vocabulary above is one: the two files may not import each other.
 * Change a number here and change it there.
 */
export const BANDS = { high: 80, medium: 50 } as const;

/**
 * The band a 0 to 100 score falls in.
 *
 * The proxy already does this per attribute before anything reaches the app.
 * This copy exists for the one number the proxy never sees: the verdict's own
 * composed confidence, which feature 4 works out from several attributes at
 * once. [Spec 0007](../../docs/specs/0007-verdict-screen/index.md) made the
 * verdict screen show a band rather than a percentage, because a gate firing
 * on a bad photo was printing "95% confident" beside "Check manually".
 *
 * Deriving rather than storing is deliberate: a stored band would be a second
 * source of truth that can disagree with the number it came from.
 */
export function bandFor(score: number): ConfidenceBand {
  if (score >= BANDS.high) return 'high';
  if (score >= BANDS.medium) return 'medium';
  return 'low';
}

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

/**
 * Whether the two models saw the same kind of thing.
 *
 * `no_opinion` is not a disagreement. It is what the classifier returns when
 * its label names no material in this vocabulary (`batteries` is not
 * packaging; `disposable plates` is an item, not a material) or when either
 * side answered `unknown`. Two models declining to guess is not a conflict.
 */
export type Agreement = 'agree' | 'disagree' | 'no_opinion';

/**
 * What the image classifier made of the same photo.
 *
 * A COPY of `Classification` in `proxy/api/classifier.ts`, kept by hand for
 * the same reason the attribute vocabulary above is: `proxy/AGENTS.md` forbids
 * the app and the proxy importing each other. Change a field here and you must
 * change it there.
 *
 * `prithivMLmods/Recycling-Net-11`, a SigLIP2 fine tune over 11 waste classes,
 * reached through the service in `classifier/`. It reads a photograph where
 * Gemini reads a resin code, so the two are wrong in uncorrelated ways and
 * their disagreement is a signal neither produces alone.
 *
 * Absent whenever the second opinion did not arrive: no service configured, a
 * Space still waking, a timeout, a reply that did not parse. The app may never
 * tell those apart and must never need to, so all four look like this field
 * not being there (spec 0005, AC-6).
 */
export type SecondOpinion = {
  /** The classifier's own top label, verbatim, e.g. `takeaway cups`. */
  label: string;
  /** 0 to 100, matching how every other score in this product is expressed. */
  score: number;
  /** That label in this project's vocabulary. Absent when it names no material. */
  material?: MaterialCode;
  /** Against the material Gemini read, compared by family rather than by code. */
  agrees: Agreement;
  /** Which model and which label map judged it, e.g. `recycling-net-11@v1`. */
  modelVersion: string;
};

/** Exactly what `POST /api/vision` returns on a 200. */
export type VisionRead = {
  itemName: string;
  /** An optional caveat, 160 characters or fewer. */
  note?: string;
  attributes: VisionAttributes;
  /**
   * The classifier's view of the same photo, when there was one.
   *
   * Optional at the type level because it is optional on the wire, and that
   * optionality is the contract rather than an oversight: a build with no
   * classifier configured, and a build whose Space is asleep, both produce
   * reads without it, and every reader downstream has to work anyway.
   */
  classifier?: SecondOpinion;
};

export type VerdictKind = 'recyclable' | 'notRecyclable' | 'checkManually';

/**
 * How far a rule's authority actually reaches.
 *
 * Load bearing, not decoration. The source check behind spec 0004 could not
 * load a single quotable Pune document, so most rules rest on the national
 * Rules instead. This field makes that visible rather than letting a national
 * rule pass itself off as a municipal one.
 *
 * `model` is the odd one out, added by
 * [spec 0005](../../docs/specs/0005-learned-second-opinion/index.md): it marks
 * a citation resting on the team's own measurement rather than on any
 * published document. It is a separate member from the four legal scopes
 * everywhere it travels, so no screen can read a learned refusal as law.
 *
 * It lives here rather than in `src/rules/types.ts`, where it was declared
 * until [spec 0007](../../docs/specs/0007-verdict-screen/index.md), because
 * `RuleSource` below now carries it onto the screen. `src/rules/types.ts`
 * re-exports it, so every existing import keeps working, and the dependency
 * still points one way: the rules read the vocabulary, never the reverse.
 *
 * Written as a list with the type derived from it, like the six vocabularies
 * above and for the same reason: `map.ts` has to test membership rather than
 * describe it, because a scope read back out of a text column cannot be
 * trusted until it has been checked, and a type cannot be read at runtime.
 */
export const SOURCE_SCOPES = ['pune', 'maharashtra', 'national', 'general', 'model'] as const;

export type SourceScope = (typeof SOURCE_SCOPES)[number];

/**
 * Where a rule came from.
 *
 * `url` is present only where the page was confirmed to load, so a missing URL
 * means a name only citation rather than a dead link (spec 0004, AC-3).
 *
 * `scope` used to be stripped off on the way out of the engine, because
 * feature 9 had not yet decided whether a screen should show a national
 * citation differently from a Pune one. Spec 0007 decided it does: the
 * authority chip on the rule card. So the engine stopped stripping it.
 *
 * It is an optional key for exactly one reason, and it is not the usual one.
 * Every verdict the engine produces carries a scope, because every record in
 * a rule set is required to have one. A scan saved before `MIGRATIONS[1]`
 * added the column genuinely does not know its scope, and there is no honest
 * value to invent for it: the five members all assert something specific.
 * Absent therefore means "written before we recorded this", and the screen
 * answers it by showing no chip at all (spec 0007, AC-18).
 */
export type RuleSource = {
  document: string;
  scope?: SourceScope;
  url?: string;
};

/** The rule that fired, with the source it came from. */
export type AppliedRule = {
  /**
   * The id of the gate or rule that decided this, e.g. `gate-photo-unreadable`.
   *
   * Added by [spec 0006](../../docs/specs/0006-saved-scan-data-model/index.md),
   * which closes the follow-up spec 0005 left open: without it a stored scan
   * could only say which record fired by matching on its text. `decidingRecord`
   * already picks the winning record, so this is carried out of the selection
   * rather than worked out again afterwards.
   */
  id: string;
  /** Plain words a non expert can follow. */
  text: string;
  /** Where it came from. The scope requires every rule to carry this. */
  source: RuleSource;
};

/**
 * The decision half of a scan: everything `decide` in `src/rules/` produces
 * from one read.
 *
 * `Scan` is built from this rather than repeating its fields, so the two can
 * never drift. Feature 5 spreads a `Verdict` into the row it stores.
 */
export type Verdict = {
  verdict: VerdictKind;
  /** The one line action, e.g. "Dry waste, rinse it first". */
  action: string;
  /** Overall confidence in the verdict, 0 to 100. Feature 4 decides it. */
  confidence: number;
  /**
   * The band `confidence` falls in, computed once in the engine.
   *
   * Carried on the verdict rather than worked out by each screen so the
   * product has exactly one definition of a band, and so a stored scan and the
   * screen it came from can never disagree about which word to use.
   * Deliberately NOT stored: `bandFor` over the stored `confidence` gives the
   * same answer, and a stored copy would be a second source of truth.
   */
  confidenceBand: ConfidenceBand;
  /**
   * Which attributes the deciding record actually named, in reading order.
   *
   * Empty where the record named none, which is the learned gate and the no
   * match rule. The screen reads three things off this: which rows to promote
   * out of the disclosure, whether to show a confidence chip at all (a
   * decision resting on no attribute claims nothing), and which read blocked a
   * check manually.
   *
   * It comes from the same `decidingRecord` selection the verdict came from,
   * so it can never name a record other than the one that decided this.
   */
  decidedOn: readonly AttributeKey[];
  rule: AppliedRule;
  /**
   * An optional caveat shown under the attributes, e.g. that the symbol was
   * faded so the material was judged another way. Nothing on screen may claim
   * more certainty than the attributes support.
   */
  note?: string;
};

/**
 * What a saved scan records about the learned second opinion that judged it.
 *
 * Named here, in the vocabulary file, rather than inside `src/ml/`, because
 * [spec 0005](../../docs/specs/0005-learned-second-opinion/index.md) makes
 * these three a requirement on feature 5's data model rather than a
 * suggestion to it. Folding them into `Scan` now means feature 5 absorbs them
 * while it is still being designed, and the compiler says so rather than a
 * sentence in a document.
 *
 * `src/rules/` produces all three, through `assess`. Nothing else may.
 */
export type ScanLearnedFields = {
  /**
   * How far the vision read itself could be trusted, 0 to 1.
   *
   * `undefined` when the model was not consulted. Required as a key, so a
   * scan saved with no model is distinguishable from one whose score was
   * dropped on the way to storage.
   */
  trustScore: number | undefined;
  /** The artifact's version, or the literal `unavailable`. */
  modelVersion: string;
  /** Whether the learned gate is what produced this verdict. */
  gateFired: boolean;
};

/**
 * A stored read, where every key is optional.
 *
 * That optionality is the whole forward compatibility story
 * [spec 0006](../../docs/specs/0006-saved-scan-data-model/index.md) rests on:
 * a scan saved before a seventh attribute existed simply lacks that key, and
 * the reader reports it absent rather than inventing one.
 *
 * Optional rather than filled with a fallback because there is no honest
 * fallback available. `PhotoQualityCode` has no `unknown` member, by spec
 * 0003's deliberate choice, so substituting `fair` for a missing read would be
 * fabricating an observation the model never made.
 */
export type StoredAttributes = Partial<VisionAttributes>;

/** The same shape with every `score` dropped. What a screen iterates. */
export type StoredDisplayAttributes = Partial<DisplayAttributes>;

/**
 * A scan as it is held on the device, at full fidelity.
 *
 * `attributes` keeps the 0 to 100 scores, because feature 13's gate survival
 * audit needs exactly those numbers, and because re-deciding an old read after
 * a threshold moves is impossible without them.
 *
 * No screen ever receives this. `toDisplayScan` in `src/db/map.ts` projects it
 * to `Scan` first, and that projection is what keeps spec 0003's guarantee
 * alive: an `AttributeRead` is structurally assignable to a `DisplayAttribute`,
 * so handing a screen the stored object directly would quietly let it print a
 * raw score with no compiler complaint.
 */
export type StoredScan = Verdict &
  ScanLearnedFields & {
    id: string;
    /** Absolute path to the photo in the app's private storage. */
    photoUri: string;
    /** What the item appears to be, e.g. "Yogurt tub". */
    itemName: string;
    /** ISO 8601. Held as epoch milliseconds in the column, converted at the edge. */
    scannedAt: string;
    /** The region whose rules decided this, e.g. "Pune, India". */
    region: string;
    /** The rule set build that decided it, e.g. "1.1.0". */
    ruleSetVersion: string;
    attributes: StoredAttributes;
    /**
     * What the image classifier said, when it answered.
     *
     * Stored, unlike the six attributes' provenance, because it is the only
     * record of the second model's view: a scan reopened next month has to be
     * able to say what disagreed with Gemini and how sure it was, and the
     * photo alone cannot answer that once the Space has moved on a version.
     *
     * Absent on every scan saved before this column existed, and on every scan
     * taken while the classifier was unreachable. Those are the same absence
     * on purpose; see `SecondOpinion`.
     */
    classifier?: SecondOpinion;
  };

/**
 * What a screen is handed: a `StoredScan` with every score dropped.
 *
 * Derived from `StoredScan` rather than written out again, so the stored shape
 * and the shown shape cannot drift apart.
 */
export type Scan = Omit<StoredScan, 'attributes'> & {
  attributes: StoredDisplayAttributes;
};

/**
 * One row of the history list.
 *
 * Deliberately smaller than `Scan`. The list shows a photo, a name, a verdict
 * and a time, so `listScans` selects six columns and never parses a stored
 * attribute payload at all (spec 0006, AC-8).
 */
export type ScanSummary = {
  id: string;
  photoUri: string;
  itemName: string;
  /** ISO 8601. */
  scannedAt: string;
  verdict: VerdictKind;
  confidence: number;
};

/*
 * Display copy for a verdict used to live here. It now lives in
 * `src/components/verdict.ts`, beside the icon and the colour that have to
 * stay in step with it, because spec 0002 makes that record the one place a
 * verdict becomes something you can see. This file keeps the vocabulary;
 * that file keeps its presentation.
 */
