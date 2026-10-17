import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Merge class names so a caller's `className` always wins.
 *
 * Every component in `src/components` takes a `className` and merges it LAST
 * through this helper, so a screen can nudge a margin without forking the
 * component. `clsx` flattens the conditionals; `tailwind-merge` resolves the
 * conflicts, dropping the component's own class when the caller passes one
 * from the same group.
 *
 * The extension below is load bearing. `tailwind-merge` only knows Tailwind's
 * own class names, so our custom tokens (`rounded-tile`, `text-verdict`) are
 * invisible to it: without registering them, `cn('rounded-card', 'rounded-frame')`
 * would keep BOTH and the component's own radius would win by source order.
 * That failure is silent, which is what makes it worth the care.
 *
 * The two group ids are `font-size` and `rounded`, confirmed against the
 * installed tailwind-merge 3.7.0 rather than assumed.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-label', 'text-body', 'text-title', 'text-verdict', 'text-auth-heading'],
      rounded: [
        'rounded-bar',
        'rounded-tile',
        'rounded-thumb',
        'rounded-card',
        'rounded-frame',
        'rounded-button',
      ],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => merge(clsx(inputs));
