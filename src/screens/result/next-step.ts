import type { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { ATTRIBUTE_LABEL, type AttributeKey } from '@/vision/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * What the app can do about a refusal, keyed by the record that refused.
 *
 * A record rather than a branch, because the set grows with the rule set and a
 * `switch` would have to be found and edited every time one is added.
 *
 * A key here is a promise that the app itself can perform this step. Most
 * refusals fail that test and deliberately carry no entry: separating two
 * joined materials, rinsing out a container and checking the packaging by hand
 * are all things only the person holding the item can do, and a button for
 * them would be a button that cannot work. Those outcomes show the primary
 * action alone (spec 0007, AC-9).
 *
 * Two records qualify today, and both resolve to the same step for the same
 * reason: the photo itself is what let the answer down, and taking another one
 * is the only next step in the Pune rule set that lives inside this app.
 */
export type NextStep = {
  readonly label: string;
  readonly icon: IconName;
  readonly go: () => void;
};

const RETAKE: NextStep = {
  label: 'Take another photo',
  icon: 'camera',
  // Back to Scan, which is the camera.
  go: () => router.navigate('/'),
};

export const NEXT_STEP: Readonly<Record<string, NextStep>> = {
  'gate-photo-unreadable': RETAKE,
  /*
   * A disagreement between the two models earns this where the other model
   * driven stop check does not, and the difference is worth stating: the
   * learned gate judges the READ and a second photo of the same item would
   * likely score the same way, while a disagreement is often an artefact of
   * this particular frame. The classifier centre crops to a square and sees no
   * printed symbol at all, so an angle that puts the whole item in frame is a
   * real move, not a shrug dressed up as a button.
   */
  'gate-models-disagree': RETAKE,
};

/**
 * Which read let the answer down, in words.
 *
 * Taken from the deciding record's own condition rather than guessed at from
 * the verdict, so the sentence names the attribute the engine actually stopped
 * on (AC-8). `undefined` where the record named none, which is the learned
 * gate, the no match rule, and a scan saved before the column existed. In all
 * three nothing specific blocked the answer, so the screen says nothing rather
 * than picking a read to blame.
 */
export function blockedBy(decidedOn: readonly AttributeKey[]): string | undefined {
  if (decidedOn.length === 0) return undefined;

  const labels = decidedOn.map((key) => ATTRIBUTE_LABEL[key].toLowerCase());
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

  return `It came down to the ${list} ${labels.length === 1 ? 'read' : 'reads'}.`;
}
