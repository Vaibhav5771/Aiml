/**
 * The rule set this build ships, bound to the engine.
 *
 * Everything the app needs from `src/rules/` comes through here. The engine in
 * `engine.ts` knows nothing about any region, so adding a second one later is
 * a second JSON file and a different import on this line, with no change to
 * the engine and no change to the screens.
 *
 * Since [spec 0005](../../docs/specs/0005-learned-second-opinion/index.md)
 * this file binds two artifacts rather than one: the written rules, and the
 * trained model that can hold one of their answers back. Both bindings live
 * here for the same reason, that the engine stays pure and knows nothing about
 * either.
 */

import { MODEL, scoreWith, trust } from '@/ml/score';
import type { ModelArtifact } from '@/ml/types';
import { UNAVAILABLE_VERSION } from '@/ml/types';
import type { ScanLearnedFields, VisionRead, Verdict } from '@/vision/types';

import { LEARNED_GATE_ID, decideWith, decidingRecord } from './engine';
import puneJson from './pune.json';
import type { RuleSet } from './types';

/**
 * Put the model's own numbers into the learned gate's citation.
 *
 * The record in `pune.json` carries a template rather than a finished
 * sentence, because what the refusal rests on is the measurement, and the
 * measurement changes every time `ml/train.py` runs. Filling it here keeps the
 * citation honest with no one having to remember to hand edit the JSON, and
 * keeps the engine from ever reading the artifact itself.
 *
 * With no usable model the gate can never fire, so this text can never reach a
 * screen. It is still filled in, so a reader of the bound rule set is never
 * shown a half written sentence.
 */
function withLearnedCitation(ruleSet: RuleSet, model: ModelArtifact | undefined): RuleSet {
  const document = (template: string) =>
    template
      .replace('{version}', model?.version ?? UNAVAILABLE_VERSION)
      .replace('{photos}', String(model?.trainedOn.photos ?? 0))
      .replace('{heldOut}', String(model?.trainedOn.heldOut ?? 0));

  return {
    ...ruleSet,
    gates: ruleSet.gates.map((gate) =>
      gate.id === LEARNED_GATE_ID
        ? { ...gate, source: { ...gate.source, document: document(gate.source.document) } }
        : gate,
    ),
  };
}

/**
 * The bundled rules. Read only, never fetched, and identical for every user of
 * a given build.
 *
 * The cast is the one unavoidable seam: JSON carries no types of its own, so
 * TypeScript sees plain strings where the rule set declares enums. That is
 * exactly what `rule-set.test.ts` exists to check, holding every code in every
 * condition to the spec 0003 vocabulary. If you change this file, that test is
 * what tells you whether you broke it.
 */
export const PUNE_RULES: RuleSet = withLearnedCitation(puneJson as RuleSet, MODEL);

/**
 * Turn one read into one defensible answer for Pune.
 *
 * Pure: the same read always gives the same verdict, with no network, no file
 * system read at call time, no clock and no randomness.
 *
 * The learned second opinion is consulted here and handed to the engine as two
 * numbers. It can only ever turn an answer into check manually; there is no
 * read for which consulting it produces a verdict the written rules would not
 * have reached on their own.
 */
export function decide(read: VisionRead): Verdict {
  return decideWith(PUNE_RULES, read, trust(read.attributes));
}

/**
 * What a saved scan records about the model, against any rule set and any
 * artifact.
 *
 * The `decideWith` to `assess`'s `decide`: it takes its artifact rather than
 * reaching for the bundled one, so every failure spec 0005 names can be put in
 * front of it without a file system in the way.
 *
 * `gateFired` comes from the same record selection `decideWith` uses, so a
 * stored scan and the screen it came from can never disagree about whether the
 * model is what refused.
 */
export function assessWith(
  ruleSet: RuleSet,
  read: VisionRead,
  model: ModelArtifact | undefined,
): ScanLearnedFields {
  const learned = model === undefined ? undefined : scoreWith(model, read.attributes);

  // Every way the model can fail arrives here the same way, as an absent trust
  // value: a missing artifact, a feature list that does not match, a weight
  // that is not a number, a score outside 0 to 1. All four record
  // `unavailable`, because from a stored scan's point of view they are the
  // same event, that nothing judged this read (spec 0005, AC-6).
  const judged = model !== undefined && learned !== undefined;

  return {
    trustScore: learned?.score,
    modelVersion: judged ? model.version : UNAVAILABLE_VERSION,
    gateFired: decidingRecord(ruleSet, read, learned).record.id === LEARNED_GATE_ID,
  };
}

/**
 * What feature 5 stores about the model that judged this read.
 *
 * Separate from `decide` rather than folded into the `Verdict`, because these
 * three are a storage concern: nothing on screen shows a trust score, and
 * spec 0005 is explicit that a learned number must never read as certainty.
 */
export function assess(read: VisionRead): ScanLearnedFields {
  return assessWith(PUNE_RULES, read, MODEL);
}

export { decideWith, decidingRecord, matchFirst, matches } from './engine';
export {
  DISAGREEMENT_GATE_ID,
  LEARNED_GATE_ID,
  MATERIAL_CONFIDENCE_GATE_ID,
  MIN_DECIDING_SCORE,
  MIN_DISAGREEMENT_SCORE,
  NO_MATCH_CONFIDENCE,
  RINSE_CLAUSE,
} from './engine';
export type { Decision } from './engine';
export type {
  Condition,
  Gate,
  LearnedTrust,
  NoteRule,
  Rule,
  RuleSet,
  Source,
  SourceScope,
} from './types';
