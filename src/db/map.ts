/**
 * Everything that turns a scan into a row and back.
 *
 * This is the half of the data layer that can actually be wrong, so it is
 * deliberately the half that imports nothing native and runs under
 * `node --test` with no device (spec 0006, AC-15). `index.ts` holds the SQL
 * and the file system and carries no logic of its own.
 *
 * [Spec 0006](../../docs/specs/0006-saved-scan-data-model/index.md) is the
 * authority.
 */

import type {
  AttributeKey,
  AttributeRead,
  ConfidenceBand,
  RuleSource,
  Scan,
  SourceScope,
  ScanLearnedFields,
  ScanSummary,
  SecondOpinion,
  StoredAttributes,
  StoredDisplayAttributes,
  StoredScan,
  Verdict,
  VerdictKind,
  VisionRead,
} from '@/vision/types';
import { ATTRIBUTE_ORDER, SOURCE_SCOPES, bandFor } from '@/vision/types';
import { parseSecondOpinion } from '@/vision/validate';

import { ATTRIBUTES_PAYLOAD_VERSION, READABLE_PAYLOAD_VERSIONS } from './schema';
import { fail, ok, type Result } from './types';

/** The `scan` row exactly as SQLite hands it back. Snake case on purpose: these are column names. */
export type ScanRow = {
  id: string;
  scanned_at: number;
  photo_uri: string;
  item_name: string;
  verdict: string;
  action: string;
  confidence: number;
  note: string | null;
  rule_id: string;
  rule_text: string;
  rule_source_document: string;
  rule_source_url: string | null;
  /** Null on a row written before `MIGRATIONS[1]`. See the migration for why. */
  rule_source_scope: string | null;
  /** A JSON array of attribute keys. Null on a row written before `MIGRATIONS[1]`. */
  decided_on: string | null;
  region: string;
  rule_set_version: string;
  trust_score: number | null;
  model_version: string;
  gate_fired: number;
  attributes: string;
  attributes_version: number;
  /**
   * The classifier's block as JSON. Null on a row written before
   * `MIGRATIONS[2]`, and on any scan taken with no second opinion available.
   */
  classifier: string | null;
};

/**
 * Every column of `scan`, in one ordered list.
 *
 * The insert builds both its column list and its value list from this, so the
 * two can never fall out of step however many columns the table grows. Typed
 * as `keyof ScanRow`, so a misspelling is a compile error, and `map.test.ts`
 * checks the list is complete, which the type alone cannot.
 */
export const SCAN_COLUMNS: readonly (keyof ScanRow)[] = [
  'id',
  'scanned_at',
  'photo_uri',
  'item_name',
  'verdict',
  'action',
  'confidence',
  'note',
  'rule_id',
  'rule_text',
  'rule_source_document',
  'rule_source_url',
  'rule_source_scope',
  'decided_on',
  'region',
  'rule_set_version',
  'trust_score',
  'model_version',
  'gate_fired',
  'attributes',
  'attributes_version',
  'classifier',
];

/** The six columns `listScans` selects. */
export type SummaryRow = Pick<
  ScanRow,
  'id' | 'photo_uri' | 'item_name' | 'scanned_at' | 'verdict' | 'confidence'
>;

/** What `saveScan` is given, before an id and a timestamp exist. */
export type NewScan = {
  id: string;
  /** Epoch milliseconds. */
  scannedAt: number;
  /** Where the photo ended up after being copied into app storage. */
  photoUri: string;
  read: VisionRead;
  verdict: Verdict;
  learned: ScanLearnedFields;
  ruleSet: { readonly region: string; readonly version: string };
};

const CONFIDENCE_BANDS: readonly string[] = ['high', 'medium', 'low'];
const VERDICT_KINDS: readonly string[] = ['recyclable', 'notRecyclable', 'checkManually'];

/** The photo's file name. Derived from the id, but the full path is still stored, never recomputed. */
export const photoFileName = (id: string): string => `${id}.jpg`;

/**
 * A verdict string from the database, or `undefined` if it is not one of the
 * three. Reading it back is not paranoia: the column is plain text, and a
 * verdict this build does not recognise must not reach a screen that switches
 * on it.
 */
function readVerdict(value: string): VerdictKind | undefined {
  return VERDICT_KINDS.includes(value) ? (value as VerdictKind) : undefined;
}

/**
 * The authority scope a row was judged under, or `undefined`.
 *
 * `undefined` covers both honest cases at once: a row written before
 * `MIGRATIONS[1]` (null), and a scope this build does not recognise, which
 * could only come from a later build. Neither may render a chip, because a
 * chip is a claim about how far a rule reaches and there is nothing here to
 * back one (spec 0007, AC-18).
 */
function readScope(value: string | null): SourceScope | undefined {
  if (value === null) return undefined;
  return SOURCE_SCOPES.includes(value as SourceScope) ? (value as SourceScope) : undefined;
}

/**
 * Which attributes decided this scan, read back out of its own row.
 *
 * Empty for a row written before `MIGRATIONS[1]`, and empty for anything that
 * does not parse. The screen already has to handle an empty list, because the
 * learned gate and the no match rule both genuinely decide on no attribute, so
 * a pre migration row reaches exactly the treatment AC-18 asks for with no
 * special case: no promoted rows, and all six reads open.
 *
 * Unknown keys are dropped rather than kept, which is the opposite of how
 * `readAttribute` treats an unknown code, and deliberately so. A stored
 * attribute is displayed through its own `display` line, so an unfamiliar code
 * still shows the right words. A key here is only ever used to look something
 * up in this build's vocabulary, so one this build does not know cannot be
 * used for anything.
 */
function readDecidedOn(json: string | null): readonly AttributeKey[] {
  if (json === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  // Filtered through `ATTRIBUTE_ORDER` rather than over the parsed array, so
  // the result is always in the app's reading order however the row spelled it.
  return ATTRIBUTE_ORDER.filter((key) => parsed.includes(key));
}

/**
 * One attribute out of a parsed payload, or `undefined` if it is not shaped
 * like a read.
 *
 * The `code` is checked for being a string and nothing more. A code this build
 * has never heard of is kept rather than rejected, because every screen renders
 * the attribute's `display` line rather than switching on its code, so an
 * unknown code still shows the right words. Rejecting it would lose a reading
 * that is perfectly displayable.
 */
function readAttribute(value: unknown): AttributeRead<string> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const read = value as Record<string, unknown>;
  if (typeof read.code !== 'string' || read.code.length === 0) return undefined;
  if (typeof read.display !== 'string') return undefined;
  if (typeof read.confidence !== 'string' || !CONFIDENCE_BANDS.includes(read.confidence)) {
    return undefined;
  }
  if (typeof read.score !== 'number' || !Number.isFinite(read.score)) return undefined;
  return {
    code: read.code,
    display: read.display,
    confidence: read.confidence as ConfidenceBand,
    score: read.score,
  };
}

/**
 * The tolerant reader. This is the function feature 5 exists for.
 *
 * It has to survive change in both directions. A key the payload does not
 * carry is left out, which is how a scan saved before a seventh attribute
 * existed keeps opening. A key this build has never heard of is ignored, which
 * is how a scan saved by a later build still opens on an older one.
 *
 * It refuses exactly one thing: a payload stamped with a version this build
 * does not know. That is a deliberate hard stop, because an unknown version
 * means the shape may have changed underneath the key names, and a silent
 * misread is worse than an honest refusal (spec 0006, AC-16).
 */
export function readAttributes(json: string, version: number): StoredAttributes | undefined {
  if (!READABLE_PAYLOAD_VERSIONS.includes(version)) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;

  const source = parsed as Record<string, unknown>;
  const attributes: Record<string, AttributeRead<string>> = {};
  for (const key of ATTRIBUTE_ORDER) {
    const read = readAttribute(source[key]);
    if (read !== undefined) attributes[key] = read;
  }

  // The one cast in this file. A parsed blob cannot prove the per key code
  // unions to the compiler, and `readAttribute` has already checked everything
  // that is checkable without re-declaring all six enums here. The rule set
  // test is what holds the codes themselves to the spec 0003 vocabulary.
  return attributes as StoredAttributes;
}

/**
 * The citation a row carries, with both optional keys absent rather than
 * undefined when there is nothing to put in them.
 *
 * The two absences mean different things and both are honest. A missing URL
 * means a name only citation rather than a dead link (spec 0004, AC-3). A
 * missing scope means the row was written before the column existed.
 */
function readSource(row: ScanRow): RuleSource {
  const scope = readScope(row.rule_source_scope);
  return {
    document: row.rule_source_document,
    ...(scope === undefined ? {} : { scope }),
    ...(row.rule_source_url === null ? {} : { url: row.rule_source_url }),
  };
}

/** Assemble the scan that is about to be stored, from the pieces the pipeline produced. */
export function buildScan(input: NewScan): StoredScan {
  return {
    ...input.verdict,
    ...input.learned,
    id: input.id,
    photoUri: input.photoUri,
    itemName: input.read.itemName,
    scannedAt: new Date(input.scannedAt).toISOString(),
    region: input.ruleSet.region,
    ruleSetVersion: input.ruleSet.version,
    attributes: input.read.attributes,
    // Absent rather than explicitly undefined, because `exactOptionalPropertyTypes`
    // makes those two different types and `StoredScan` declares this optional.
    ...(input.read.classifier === undefined ? {} : { classifier: input.read.classifier }),
  };
}

/** A scan, flattened into the columns it is stored as. */
export function toRow(scan: StoredScan): ScanRow {
  return {
    id: scan.id,
    scanned_at: Date.parse(scan.scannedAt),
    photo_uri: scan.photoUri,
    item_name: scan.itemName,
    verdict: scan.verdict,
    action: scan.action,
    confidence: scan.confidence,
    note: scan.note ?? null,
    rule_id: scan.rule.id,
    rule_text: scan.rule.text,
    rule_source_document: scan.rule.source.document,
    rule_source_url: scan.rule.source.url ?? null,
    rule_source_scope: scan.rule.source.scope ?? null,
    // Stored as JSON rather than as a joined string, because the reader has to
    // tell an empty list from a missing one and an empty string cannot.
    decided_on: JSON.stringify(scan.decidedOn),
    region: scan.region,
    rule_set_version: scan.ruleSetVersion,
    trust_score: scan.trustScore ?? null,
    model_version: scan.modelVersion,
    gate_fired: scan.gateFired ? 1 : 0,
    attributes: JSON.stringify(scan.attributes),
    attributes_version: ATTRIBUTES_PAYLOAD_VERSION,
    // No payload version beside it, unlike `attributes`. The block is small,
    // self describing and already carries `modelVersion`, which says more about
    // what it meant than a schema number would.
    classifier: scan.classifier === undefined ? null : JSON.stringify(scan.classifier),
  };
}

/** A stored row, read back into a scan. Fails rather than guessing. */
export function fromRow(row: ScanRow): Result<StoredScan> {
  const attributes = readAttributes(row.attributes, row.attributes_version);
  if (attributes === undefined) return fail('row_unreadable');

  const verdict = readVerdict(row.verdict);
  if (verdict === undefined) return fail('row_unreadable');

  const scan: StoredScan = {
    id: row.id,
    photoUri: row.photo_uri,
    itemName: row.item_name,
    scannedAt: new Date(row.scanned_at).toISOString(),
    region: row.region,
    ruleSetVersion: row.rule_set_version,
    verdict,
    action: row.action,
    confidence: row.confidence,
    // Derived on the way out rather than stored, so the word and the number it
    // describes can never disagree. The thresholds are fixed, so an old row
    // bands exactly as it did on the day (spec 0007).
    confidenceBand: bandFor(row.confidence),
    decidedOn: readDecidedOn(row.decided_on),
    rule: {
      id: row.rule_id,
      text: row.rule_text,
      source: readSource(row),
    },
    // Null means the model was never consulted. `undefined` is how the rest of
    // the app already says that, so the conversion happens here and nowhere else.
    trustScore: row.trust_score ?? undefined,
    modelVersion: row.model_version,
    gateFired: row.gate_fired !== 0,
    attributes,
  };

  const classifier = readSecondOpinion(row.classifier);

  // `note` is optional on `Verdict`, so an absent note is an absent key rather
  // than an explicit undefined. The two are not the same under `exactOptionalPropertyTypes`.
  return ok({
    ...scan,
    ...(row.note === null ? {} : { note: row.note }),
    ...(classifier === undefined ? {} : { classifier }),
  });
}

/**
 * The stored second opinion, or nothing.
 *
 * TOLERANT, like `readAttributes` above and for the stronger version of its
 * reason. A scan's whole value is that it reopens months later saying exactly
 * what it said on the day; a block this build cannot parse must cost the
 * reader that block and never the scan. So every failure here, a null column,
 * invalid JSON, a shape from a newer build, returns `undefined` and the screen
 * shows no second opinion.
 *
 * It reuses the app's own wire validator rather than writing a second one.
 * That is the point: the proxy owns this shape, `parseSecondOpinion` is the
 * one place that knows it, and a row read back is held to exactly the contract
 * a fresh response is held to.
 */
export function readSecondOpinion(json: string | null): SecondOpinion | undefined {
  if (json === null) return undefined;

  try {
    return parseSecondOpinion(JSON.parse(json));
  } catch {
    return undefined;
  }
}

/** A summary row, read back for the history list. */
export function toSummary(row: SummaryRow): ScanSummary {
  return {
    id: row.id,
    photoUri: row.photo_uri,
    itemName: row.item_name,
    scannedAt: new Date(row.scanned_at).toISOString(),
    // A verdict this build does not recognise degrades to `checkManually`
    // rather than failing the whole list. That is the safe direction: the one
    // outcome that never claims more than it can stand behind.
    verdict: readVerdict(row.verdict) ?? 'checkManually',
    confidence: row.confidence,
  };
}

/**
 * Drop every score, so a screen physically cannot print one.
 *
 * This projection is what preserves spec 0003's compile error guarantee now
 * that the scores are stored. It is a rebuild rather than a spread, because a
 * spread would carry `score` through at runtime even where the type hides it.
 */
export function toDisplayScan(scan: StoredScan): Scan {
  const attributes: Record<string, { code: string; display: string; confidence: ConfidenceBand }> =
    {};
  for (const key of ATTRIBUTE_ORDER) {
    const read = scan.attributes[key];
    if (read !== undefined) {
      attributes[key] = { code: read.code, display: read.display, confidence: read.confidence };
    }
  }
  return { ...scan, attributes: attributes as StoredDisplayAttributes };
}
