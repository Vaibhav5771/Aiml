/**
 * The shape of a region's rule set.
 *
 * [Spec 0004](../../docs/specs/0004-local-recycling-rule-set/index.md) is the
 * authority. The short version: gates, rules and notes are all records with
 * the same `when` condition, so the reason the app declined to answer is as
 * quotable as the reason it answered.
 *
 * Nothing here decides anything. `engine.ts` reads these, `pune.json` fills
 * them in, and `rule-set.test.ts` is what actually holds the JSON to this
 * shape, because JSON has no types of its own.
 */

import type {
  ConstructionCode,
  ContaminationCode,
  FormCode,
  MaterialCode,
  PhotoQualityCode,
  SourceScope,
  SymbolCode,
  VerdictKind,
} from '@/vision/types';

/**
 * What has to be true of a read for a record to match.
 *
 * An omitted key means "any value", so a `Condition` with no keys matches
 * everything. That is how the no match record is expressed without the engine
 * needing a special case for it.
 */
export type Condition = {
  readonly material?: readonly MaterialCode[];
  readonly form?: readonly FormCode[];
  readonly recyclingSymbol?: readonly SymbolCode[];
  readonly construction?: readonly ConstructionCode[];
  readonly contamination?: readonly ContaminationCode[];
  readonly photoQuality?: readonly PhotoQualityCode[];
};

/*
 * `SourceScope` now lives in `@/vision/types`, beside the `RuleSource` that
 * carries it onto the screen (spec 0007). It is re-exported here so every
 * existing `from './types'` import keeps working, and because a rule set's
 * `Source` is still the only place a scope is ever written down by hand.
 *
 * A rule may never claim `pune` without a named Pune document behind it.
 */
export type { SourceScope };

export type Source = {
  readonly document: string;
  readonly scope: SourceScope;
  /** Only ever present for a page confirmed to load, so a missing URL beats a dead one. */
  readonly url?: string;
};

/**
 * What the learned stage hands the engine: two plain numbers.
 *
 * [Spec 0005](../../docs/specs/0005-learned-second-opinion/index.md) puts this
 * type here, in the rules module, rather than in `src/ml/`, because it is the
 * engine's input contract and the engine may not import from `src/ml/` at all.
 * The arrow points the other way: the scorer produces one of these, the engine
 * consumes it, and the engine never learns where either number came from, in
 * exactly the way it never learns what Pune is.
 *
 * `undefined` rather than a `LearnedTrust` means the model was not consulted,
 * which is the only state the engine has to tell apart from a real score.
 */
export type LearnedTrust = {
  /** 0 to 1. How far the vision read itself can be trusted. */
  readonly score: number;
  /** 0 to 1. Below this, the learned gate fires. Chosen from the artifact, never here. */
  readonly threshold: number;
};

/**
 * A stop check. Always yields `checkManually`, which is why it carries no
 * `verdict` field: there is only one answer a gate can give.
 */
export type Gate = {
  readonly id: string;
  readonly when: Condition;
  readonly action: string;
  /** Plain words a non expert can follow. */
  readonly text: string;
  readonly source: Source;
};

/** A gate that also names the verdict it reaches. Ordered specific to general, first match wins. */
export type Rule = Gate & { readonly verdict: VerdictKind };

/**
 * A caveat shown under the attributes.
 *
 * Carries no source, unlike a gate or a rule, because a note explains the
 * engine's own reasoning rather than asserting a municipal rule.
 */
export type NoteRule = {
  readonly id: string;
  readonly when: Condition;
  readonly text: string;
};

export type RuleSet = {
  /** Must equal `REGION.label` from `src/constants.ts`. A test asserts it. */
  readonly region: string;
  /** Hand bumped whenever a rule or a citation changes, so a stored scan can record which set judged it. */
  readonly version: string;
  readonly gates: readonly Gate[];
  readonly rules: readonly Rule[];
  readonly notes: readonly NoteRule[];
};
