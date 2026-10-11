import type { Ionicons } from '@expo/vector-icons';

import { verdictColors } from '@/theme';
import type { VerdictKind } from '@/vision/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * The one place a verdict is turned into something you can see.
 *
 * Spec 0001 set a hard rule: a verdict is carried by an icon AND a word AND a
 * colour, never by colour alone. That keeps the core answer of the product
 * readable for someone who cannot tell red from green, and in a greyscale
 * screenshot. A rule spread across three private maps in one component is a
 * rule you have to remember; a rule in one record is a rule the next screen
 * gets for free. Every verdict surface reads from here, and no component
 * keeps its own copy (invariant 5 of spec 0002).
 *
 * `iconColor` is the raw value rather than a class because Ionicons takes a
 * colour prop, not a className. It is read from `src/theme.ts`, the colours
 * only mirror of `global.css`, so it is still not a literal written twice.
 */
export type VerdictPresentation = {
  /** The word itself, e.g. "Not recyclable". Never shortened by a caller. */
  readonly word: string;
  readonly icon: IconName;
  /** Text colour class for the word and any number that belongs to it. */
  readonly tone: string;
  /** Background plus border class for the card behind the verdict. */
  readonly surface: string;
  /** Border colour class for a ring or chip that has to carry the verdict. */
  readonly edge: string;
  /** For props that take a colour value rather than a class. */
  readonly iconColor: string;
};

export const VERDICT: Record<VerdictKind, VerdictPresentation> = {
  recyclable: {
    word: 'Recyclable',
    icon: 'checkmark',
    tone: 'text-verdict-ok',
    surface: 'bg-surface-ok border-edge-ok',
    edge: 'border-verdict-ok',
    iconColor: verdictColors.recyclable,
  },
  notRecyclable: {
    word: 'Not recyclable',
    icon: 'close',
    tone: 'text-verdict-no',
    surface: 'bg-surface-no border-edge-no',
    edge: 'border-verdict-no',
    iconColor: verdictColors.notRecyclable,
  },
  checkManually: {
    word: 'Check manually',
    icon: 'help',
    tone: 'text-verdict-maybe',
    surface: 'bg-surface-maybe border-edge-maybe',
    edge: 'border-verdict-maybe',
    iconColor: verdictColors.checkManually,
  },
};
