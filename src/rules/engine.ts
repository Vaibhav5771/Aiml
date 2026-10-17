/**
 * The rule engine: six observations in, one defensible answer out.
 *
 * Pure, and deliberately so. No network, no file system read at call time, no
 * clock, no randomness, so the highest risk logic in the product is testable
 * with no device, no network and no quota. The same read always gives the same
 * verdict.
 *
 * It knows nothing about Pune. `index.ts` binds it to `pune.json`; a second
 * region later is a second file and a different import, with no change here.
 *
 * Order of business, fixed by [spec 0004](../../docs/specs/0004-local-recycling-rule-set/index.md):
 * stop checks first, then rules top to bottom, first match wins.
 *
 * [Spec 0005](../../docs/specs/0005-learned-second-opinion/index.md) adds one
 * more stop check at the end of the gates, driven by a number a trained model
 * produced. The engine stays model unaware: it is handed two numbers and
 * compares them, and it imports nothing from `src/ml/`. That gate may only
 * ever refuse, never promote, which is the invariant the whole of spec 0005
 * exists to protect.
 */

import { ATTRIBUTE_ORDER, bandFor } from '@/vision/types';
import type {
  AttributeKey,
  RuleSource,
  Verdict,
  VerdictKind,
  VisionAttributes,
  VisionRead,
} from '@/vision/types';

import type { Condition, Gate, LearnedTrust, Rule, RuleSet, Source } from './types';

/**
 * Below this `score`, a material read is not worth deciding on.
 *
 * PROVISIONAL. It reuses the boundary spec 0003 already fixed between its
 * `low` and `medium` bands rather than inventing a third number, but nothing
 * has measured it: spec 0003's first live run returned 85 and above on every
 * attribute of a clear photo, so this gate may almost never fire until the
 * photo set includes genuinely hard shots. Retune it when that runs.
 */
export const MIN_DECIDING_SCORE = 50;

/**
 * The one place the rinse wording exists.
 *
 * Appended to any matched record's action when there is light residue, so no
 * rule has to remember to say it and no two rules can word it differently.
 */
export const RINSE_CLAUSE = ', rinse it first';

/**
 * What the no match record reports as its confidence.
 *
 * It names no attribute in its `when`, so the weakest link rule below has no
 * attribute to read and the spec names no source for the number. Zero is the
 * honest answer: the decision rested on nothing, so it claims nothing, and the
 * bar renders empty beside "check manually". Chosen by the engineer during
 * /develop; spec 0004's AC-8 owes a sentence covering this case.
 */
export const NO_MATCH_CONFIDENCE = 0;

/**
 * The gate that carries the `MIN_DECIDING_SCORE` threshold.
 *
 * A `Condition` matches codes, not numbers, so this one check cannot be
 * written in the data and the engine has to find its gate by id. The rule set
 * test asserts a gate with this id exists, so the coupling cannot go quietly
 * dead.
 */
export const MATERIAL_CONFIDENCE_GATE_ID = 'gate-material-unreadable';

/**
 * The gate the learned stage drives.
 *
 * Like `MATERIAL_CONFIDENCE_GATE_ID`, this one turns on a number rather than
 * on codes, so a `Condition` cannot express it and the engine has to find its
 * record by id. Its `when` is empty on purpose: the record exists to carry the
 * wording and the citation, and the trigger lives here in code.
 *
 * It is placed last among the gates in the rule set, so the four written stop
 * checks always get first refusal and a read halted by one of them never
 * reaches the model (spec 0005, AC-2). `rule-set.test.ts` asserts that
 * position, so the ordering cannot go quietly wrong.
 */
export const LEARNED_GATE_ID = 'gate-learned-unreliable';

/**
 * The gate the image classifier drives.
 *
 * A second model reads the same photo (`prithivMLmods/Recycling-Net-11`, via
 * the service in `classifier/`) and the proxy compares its answer with
 * Gemini's by material family. When the two disagree, neither can be trusted
 * to have been the right one, and this gate is what turns that into a refusal
 * rather than a coin toss.
 *
 * Like the two gates above it, its trigger is a number rather than a set of
 * codes, so a `Condition` cannot express it and the engine finds its record by
 * id. Its `when` is empty for the same reason theirs are: the record carries
 * the wording and the citation, the trigger lives here.
 *
 * Placed after the four written gates and before the learned one. The written
 * checks always get first refusal, because a poor photo is a better
 * explanation than a model argument and cites a document rather than a model
 * (spec 0005, AC-2). `rule-set.test.ts` asserts the whole order.
 */
export const DISAGREEMENT_GATE_ID = 'gate-models-disagree';

/**
 * How sure the classifier has to be before its disagreement may stop a verdict.
 *
 * PROVISIONAL, and the number most worth measuring in this feature. Without a
 * floor, an 8% guess from a model that has never seen damaged Indian packaging
 * could overrule a clean resin code read off the triangle, and the app would
 * refuse to answer constantly. With one too high, the case the integration
 * exists for, a lined paper cup the vision stage calls `paper`, slips through.
 *
 * 70 is chosen as the point where the classifier is past "leaning" and into
 * "confident": its own reported accuracy is 91% on its own held out split, and
 * nothing has yet measured it on our photos. Retune it when the spec 0003
 * photo set runs through both models and the disagreements can be counted.
 */
export const MIN_DISAGREEMENT_SCORE = 70;

/** Whether every attribute the condition names holds. An omitted key means "any value". */
export function matches(when: Condition, a: VisionAttributes): boolean {
  return ATTRIBUTE_ORDER.every((key) => {
    const allowed: readonly string[] | undefined = when[key];
    return allowed === undefined || allowed.includes(a[key].code);
  });
}

/** The first record whose condition holds. Position in the array is the priority. */
export function matchFirst<T extends { readonly when: Condition }>(
  records: readonly T[],
  a: VisionAttributes,
): T | undefined {
  return records.find((record) => matches(record.when, a));
}

/**
 * The attributes a record actually named, in the app's reading order.
 *
 * One function, two callers, and that is the point. The confidence below and
 * the `decidedOn` the screen promotes rows from are both read off this list,
 * so the number and the rows it is explained by can never describe different
 * attributes (spec 0007, AC-17).
 *
 * Empty for a record with an empty `when`: the learned gate and the no match
 * rule. Both are real cases, not edge cases, and the screen treats an empty
 * list as "this rested on no single read".
 */
function decidedOnFrom(when: Condition): readonly AttributeKey[] {
  return ATTRIBUTE_ORDER.filter((key) => when[key] !== undefined);
}

/**
 * Confidence is the weakest link over ONLY the attributes the matched record
 * names.
 *
 * An attribute the record does not name can neither raise nor lower it, which
 * is the point: an average would let a perfect photo quality score prop up an
 * unreadable material, and nothing on screen may claim more certainty than the
 * attributes the decision actually rested on.
 */
function confidenceFrom(decidedOn: readonly AttributeKey[], a: VisionAttributes): number {
  const scores = decidedOn.map((key) => a[key].score);
  return scores.length === 0 ? NO_MATCH_CONFIDENCE : Math.min(...scores);
}

/** The record's base action, plus the rinse clause only when there is light residue. */
function actionFrom(base: string, a: VisionAttributes): string {
  return a.contamination.code === 'light_residue' ? `${base}${RINSE_CLAUSE}` : base;
}

/**
 * The citation, as the screen receives it.
 *
 * `scope` used to be dropped here, because feature 9 had not decided whether a
 * national citation should look different from a Pune one. Spec 0007 decided
 * it does, so it travels. A missing `url` is still an absent key rather than
 * an explicit undefined, because a name only citation beats a dead link.
 */
function sourceFrom(source: Source): RuleSource {
  return source.url === undefined
    ? { document: source.document, scope: source.scope }
    : { document: source.document, scope: source.scope, url: source.url };
}

/** A gate fires on its condition, or on one of the three thresholds a condition cannot express. */
function fires(gate: Gate, read: VisionRead, learned: LearnedTrust | undefined): boolean {
  const a = read.attributes;

  if (gate.id === LEARNED_GATE_ID) {
    // The learned record carries an empty `when`, so without this branch
    // `matches` would fire it on every read. No trust value means the model
    // was never consulted, and a check that cannot be consulted cannot refuse:
    // that is the whole of the unavailable path (spec 0005, AC-6).
    return learned !== undefined && learned.score < learned.threshold;
  }
  if (gate.id === DISAGREEMENT_GATE_ID) {
    // Empty `when` again, so the same guard applies. Three conditions, all
    // required: a second opinion arrived at all, it actually conflicts, and it
    // was confident enough to be worth heeding. `no_opinion` is not a
    // disagreement and must never reach here as one, which is why the check is
    // for the exact code rather than for "not agree".
    const second = read.classifier;
    return (
      second !== undefined && second.agrees === 'disagree' && second.score >= MIN_DISAGREEMENT_SCORE
    );
  }
  if (gate.id === MATERIAL_CONFIDENCE_GATE_ID && a.material.score < MIN_DECIDING_SCORE) {
    return true;
  }
  return matches(gate.when, a);
}

function verdictFrom(
  record: Gate | Rule,
  kind: VerdictKind,
  read: VisionRead,
  ruleSet: RuleSet,
): Verdict {
  const a = read.attributes;
  // The engine's own note wins over the proxy's, so the screen never shows two
  // caveats. With neither, the field is absent rather than undefined.
  const note = matchFirst(ruleSet.notes, a)?.text ?? read.note;
  // Worked out once, here, and then both read off it. The confidence and the
  // rows the screen promotes to explain that confidence are the same list of
  // attributes by construction, not by two functions agreeing (spec 0007).
  const decidedOn = decidedOnFrom(record.when);
  const confidence = confidenceFrom(decidedOn, a);
  const verdict: Verdict = {
    verdict: kind,
    action: actionFrom(record.action, a),
    confidence,
    // A word, never a percentage. The screen shows the band and nothing else,
    // because a gate firing on a bad photo used to print "95% confident"
    // beside "Check manually" (spec 0007, AC-2).
    confidenceBand: bandFor(confidence),
    decidedOn,
    // The id travels with the text so a stored scan can name which record
    // decided it (spec 0006, AC-5). It comes from the same selection the
    // screen's verdict came from, so the two can never disagree.
    rule: { id: record.id, text: record.text, source: sourceFrom(record.source) },
  };
  return note === undefined ? verdict : { ...verdict, note };
}

/** The record a read lands on, and the verdict that record carries. */
export type Decision = {
  readonly record: Gate | Rule;
  readonly kind: VerdictKind;
};

/**
 * Which record decides this read: stop checks in order, then rules.
 *
 * Both `decideWith` and `assess` go through here, so a stored scan can never
 * disagree with the screen about which record won. Spec 0005 notes that
 * `AppliedRule` carries no id, which would otherwise leave `assess` matching
 * on rule text to work out whether the learned gate fired; one shared
 * selection removes that guesswork instead of working around it.
 */
export function decidingRecord(
  ruleSet: RuleSet,
  read: VisionRead,
  learned?: LearnedTrust,
): Decision {
  const a = read.attributes;

  // Stop checks first, always. A confident looking material code can never
  // outrank a poor photo, a joined construction or heavy residue, and none of
  // those can be overturned by a model: position in the array is the priority,
  // and the learned record sits at the end of it.
  const gate = ruleSet.gates.find((g) => fires(g, read, learned));
  if (gate !== undefined) return { record: gate, kind: 'checkManually' };

  // The last record carries an empty `when` and so matches everything, which
  // is how "no rule fits this" is expressed without a special case. The `??`
  // is there for the compiler; the rule set test is what guarantees it.
  const rule = matchFirst(ruleSet.rules, a) ?? ruleSet.rules[ruleSet.rules.length - 1];
  return { record: rule, kind: rule.verdict };
}

/**
 * Decide against any region's rule set.
 *
 * Every input produces a verdict, `checkManually` in the worst case, and every
 * verdict carries the rule and the citation behind it. There is no outcome
 * with no rule attached.
 *
 * `learned` is optional, so every caller written against spec 0004 keeps
 * working unchanged and every test can pass a literal with no model file on
 * disk. Omitting it is not a neutral default dressed up as one: it means the
 * model was not consulted, and the verdict is then exactly what the written
 * rules alone produce.
 */
export function decideWith(ruleSet: RuleSet, read: VisionRead, learned?: LearnedTrust): Verdict {
  const { record, kind } = decidingRecord(ruleSet, read, learned);
  return verdictFrom(record, kind, read, ruleSet);
}
