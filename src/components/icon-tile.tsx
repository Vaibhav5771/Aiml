import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme';
import { cn } from '@/tw/cn';
import { View } from '@/tw';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * A rounded square with an icon in it. Three inline copies at 30, 34 and 46px
 * collapsed into this.
 *
 * Presentational on purpose: it never handles a press itself. A caller that
 * needs a tappable tile wraps `size="md"` in its own Pressable, which keeps
 * the press, the focus ring and the accessible label on the control that
 * actually acts rather than on the decoration inside it. That is also why the
 * icon is hidden from assistive tech: the label belongs to the control.
 *
 * `md` is 48px because that is the floor for anything tappable (AC-4). `sm`
 * is 34px and is only ever decorative.
 *
 * There are three variants rather than the two spec 0002 sketched, because
 * three genuinely exist in the shipped screens: a quiet tile reads as white
 * on a grey card and as grey on the white background, and those are different
 * fills. The contract says a caller reaching for `className` to change a
 * colour means the variant set is missing one, so it gained one instead.
 */
type Variant = 'quiet' | 'soft' | 'accent';

/** Fill and border per variant. Literal classes, never interpolated. */
const SURFACE: Record<Variant, string> = {
  /** On a card. The tile lifts out of the grey. */
  quiet: 'bg-background border border-hairline',
  /** On the app background. The tile settles into the white. */
  soft: 'bg-card border border-hairline',
  /** Carrying the brand: the wordmark mark, an active control. */
  accent: 'bg-primary border border-primary',
};

export function IconTile({
  icon,
  size = 'sm',
  variant = 'quiet',
  className,
}: {
  icon: IconName;
  size?: 'sm' | 'md';
  variant?: Variant;
  className?: string;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(
        'items-center justify-center rounded-tile',
        size === 'sm' ? 'w-[34px] h-[34px]' : 'w-[48px] h-[48px]',
        SURFACE[variant],
        className,
      )}
    >
      <Ionicons
        name={icon}
        size={size === 'sm' ? 18 : 20}
        color={variant === 'accent' ? colors.card : colors.primary}
      />
    </View>
  );
}
