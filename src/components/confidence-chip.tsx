import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';
import type { ConfidenceBand, VerdictKind } from '@/vision/types';

import { VERDICT } from './verdict';

/**
 * A word, not a number.
 *
 * This chip replaced one that printed `{confidence}% confident`, which was
 * quietly the worst thing on the screen: a gate firing on an unreadable photo
 * still scored its own read highly, so the card could read "95% confident"
 * directly above "Check manually". A percentage claims a precision nothing
 * here has measured (spec 0007, AC-2).
 *
 * The band arrives already computed, on the verdict, from the one `bandFor` in
 * `src/vision/types.ts`. This component never derives one, so there is no
 * second place a band can be decided.
 */
const BAND_WORD: Record<ConfidenceBand, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/**
 * What the confidence is confidence IN, which is not the same thing on both
 * sides of the screen (spec 0007, AC-3).
 *
 * On a decided verdict the number is the weakest read the rule leaned on, so
 * it measures the answer. On a check manually there is no answer: the number
 * is the score of the read that blocked one, so saying "confidence in this
 * answer" would be claiming an answer exists. It measures the read instead.
 */
const SUBJECT: Record<VerdictKind, string> = {
  recyclable: 'answer',
  notRecyclable: 'answer',
  checkManually: 'read',
};

/**
 * The chip's words, also used to build the screen reader announcement, so the
 * spoken version and the seen version can never say different things.
 */
export function confidencePhrase(band: ConfidenceBand, verdict: VerdictKind): string {
  return `${BAND_WORD[band]} confidence in this ${SUBJECT[verdict]}`;
}

/**
 * How sure the verdict is, in the verdict's own colour.
 *
 * It takes the verdict's tone rather than a tone of its own because it is part
 * of the answer, not a second signal competing with it. A separate confidence
 * colour here would be a fourth thing to read on a card whose whole job is to
 * be read in two seconds.
 *
 * The caller decides whether this appears at all: a decision that rested on no
 * attribute has no confidence to report. See `VerdictCard`.
 */
export function ConfidenceChip({
  band,
  verdict,
  className,
}: {
  band: ConfidenceBand;
  verdict: VerdictKind;
  className?: string;
}) {
  const { tone, edge } = VERDICT[verdict];

  return (
    <View className={cn('shrink border rounded-button px-3 py-1 bg-card', edge, className)}>
      <Text className={cn('text-label font-bold', tone)}>{confidencePhrase(band, verdict)}</Text>
    </View>
  );
}
