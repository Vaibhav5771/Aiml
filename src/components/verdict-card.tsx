import { Ionicons } from '@expo/vector-icons';

import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';
import type { AttributeKey, ConfidenceBand, VerdictKind } from '@/vision/types';

import { ConfidenceChip, confidencePhrase } from './confidence-chip';
import { VERDICT } from './verdict';

/**
 * The loudest thing on the Result screen. The answer, before the reasoning.
 *
 * Every visual part of the verdict (the word, the icon, the colour) comes from
 * the one record in `verdict.ts`, so this card cannot drift from the history
 * pill feature 11 will build. It used to hold three private maps of its own,
 * which is exactly the drift that spec 0002 closed.
 *
 * Note what this component is NOT given: the 0 to 100 confidence number. It
 * takes the band instead, so it physically cannot print a percentage even by
 * mistake. That is the same trick `DisplayAttribute` plays on the raw score,
 * and it is here for the same reason: the rule that nothing claims more
 * certainty than it has works better as a missing parameter than as a comment.
 */

/**
 * Everything the card says, as one sentence.
 *
 * AC-14 asks for the verdict, its action and its confidence to arrive as a
 * single screen reader announcement rather than three stops on a swipe path.
 * Built here, from the same records the visible card reads, so the spoken
 * version cannot drift from the seen one.
 */
export function verdictAnnouncement({
  verdict,
  action,
  confidenceBand,
  decidedOn,
}: {
  verdict: VerdictKind;
  action: string;
  confidenceBand: ConfidenceBand;
  decidedOn: readonly AttributeKey[];
}): string {
  const { word } = VERDICT[verdict];
  // Same rule as the chip: a decision that rested on no attribute reports no
  // confidence, so the announcement does not mention one either.
  const confidence = decidedOn.length === 0 ? '' : `. ${confidencePhrase(confidenceBand, verdict)}`;
  return `${word}. ${action}${confidence}`;
}

export function VerdictCard({
  verdict,
  action,
  confidenceBand,
  decidedOn,
  className,
}: {
  verdict: VerdictKind;
  action: string;
  confidenceBand: ConfidenceBand;
  /** Only its length is read here: an empty list means no chip. See below. */
  decidedOn: readonly AttributeKey[];
  className?: string;
}) {
  const { word, icon, tone, surface, edge, iconColor } = VERDICT[verdict];

  return (
    <View
      // One stop, one announcement (AC-14). The three parts below are read as
      // a sentence rather than as three separate swipes, which is how someone
      // using a screen reader gets the answer in two seconds the way everyone
      // else does.
      accessible
      accessibilityLabel={verdictAnnouncement({ verdict, action, confidenceBand, decidedOn })}
      className={cn('border rounded-card p-6 gap-2', surface, className)}
    >
      {/*
       * No chip at all where the deciding record named no attribute, which is
       * the learned gate and the no match rule. Those decisions rested on
       * nothing measurable, so the honest confidence is silence rather than
       * the "0% confident" the old percentage chip would have printed
       * (spec 0007, AC-2).
       */}
      {decidedOn.length > 0 ? (
        <View className="flex-row justify-end">
          <ConfidenceChip band={confidenceBand} verdict={verdict} />
        </View>
      ) : null}

      <View className="flex-row items-center gap-4">
        <View
          className={cn(
            'w-[52px] h-[52px] rounded-full border-2 items-center justify-center',
            edge,
          )}
        >
          <Ionicons
            name={icon}
            size={26}
            color={iconColor}
            // The word beside it already says this. Saying it twice is noise.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>

        <View className="flex-1 gap-1">
          <Text className={cn('text-verdict font-display', tone)}>{word}</Text>
          <Text className="text-body font-inter text-auth-ink-soft">{action}</Text>
        </View>
      </View>
    </View>
  );
}
