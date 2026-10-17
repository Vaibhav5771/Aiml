import { Ionicons } from '@expo/vector-icons';

import { authColors } from '@/theme';
import { Text, View } from '@/tw';
import type { Agreement, SecondOpinion } from '@/vision/types';

/**
 * What the second model made of the same photo.
 *
 * `prithivMLmods/Recycling-Net-11` reads the photograph while the vision stage
 * reads the packaging and its symbols. Showing its answer is not decoration:
 * the verdict above may have been held back BECAUSE these two disagreed, and a
 * refusal whose reason the reader cannot see is exactly the kind of answer
 * this product exists not to give.
 *
 * WHAT IT MAY NOT DO. It never contradicts the verdict and never offers an
 * alternative one. The classifier's label is evidence about the read, not a
 * second answer competing with the first, and a row that let a reader take
 * "takeaway cups, 88%" as a verdict would undo the whole reason the rules
 * carry citations and this does not.
 *
 * It renders nothing when there was no second opinion, which is an ordinary
 * state rather than an error: no classifier configured, its service asleep, a
 * scan saved before the column existed. See `SecondOpinion`.
 */

/**
 * The one line that says what the agreement means.
 *
 * Phrased as what the models did, never as what the reader should conclude.
 * `no_opinion` says so plainly rather than being hidden: a reader who can see
 * a second model was consulted deserves to know when it had nothing to add,
 * and silence there would look like agreement.
 */
const AGREEMENT_TEXT: Record<Agreement, string> = {
  agree: 'This matches the material read from the packaging.',
  disagree: 'This does not match the material read from the packaging.',
  no_opinion: 'This says nothing about the material either way.',
};

/**
 * The icon beside it, and the only thing on this row that carries a tone.
 *
 * Deliberately not the verdict colours. A disagreement is a caution about the
 * reading, not a verdict of its own, and borrowing the red that means "not
 * recyclable" would read as the classifier having overruled the rules.
 */
const AGREEMENT_ICON: Record<Agreement, React.ComponentProps<typeof Ionicons>['name']> = {
  agree: 'checkmark-circle-outline',
  disagree: 'alert-circle-outline',
  no_opinion: 'help-circle-outline',
};

export function SecondOpinionRow({ classifier }: { classifier: SecondOpinion }) {
  const { label, score, agrees, modelVersion } = classifier;

  return (
    <View
      className="gap-2 bg-auth-surface border border-auth-hairline rounded-card p-4"
      accessibilityRole="summary"
      /*
       * One node, read as one sentence. Swiping through "second opinion",
       * "takeaway cups", "88" and a disagreement line as four separate nodes
       * would make a reader assemble the meaning themselves, which is the work
       * this screen exists to do for them.
       */
      accessibilityLabel={`Second opinion. A separate image model saw ${label}, ${score} percent sure. ${AGREEMENT_TEXT[agrees]}`}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons
          name={AGREEMENT_ICON[agrees]}
          size={18}
          color={authColors.inkSoft}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text className="flex-1 text-label font-inter text-auth-ink-soft">
          A second model looked at this photo on its own
        </Text>
      </View>

      <Text className="text-body font-inter text-auth-ink">
        {/*
         * The classifier's own label, verbatim, rather than the material it
         * maps to. "takeaway cups" is more use to a reader than
         * `composite_laminate`, and showing the mapped code would hide the one
         * fact that makes this row worth reading: it recognised the ITEM where
         * the vision stage read a material.
         */}
        <Text className="font-inter-bold">{label}</Text>
        {` · ${score}% sure`}
      </Text>

      <Text className="text-label font-inter text-auth-ink-soft">{AGREEMENT_TEXT[agrees]}</Text>

      {/*
       * Which model, last and quiet. A stored scan reopened in a month has to
       * be able to say what judged it, and the label alone cannot: the same
       * word means something different once the model or its label map moves.
       */}
      <Text className="text-label font-inter text-auth-ink-soft">{modelVersion}</Text>
    </View>
  );
}
