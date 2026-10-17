import { Ionicons } from '@expo/vector-icons';

import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';
import type { VerdictKind } from '@/vision/types';

import { VERDICT } from './verdict';

/**
 * A verdict at list size: the icon, the word and the colour, in a tinted pill.
 *
 * Feature 6 deliberately left this unbuilt until a real list existed to design
 * it against. It is the same three signals `VerdictCard` carries, read from
 * the same `VERDICT` record, because a history row that disagreed with the
 * screen it opens would be a bug you could see (spec 0002, invariant 5).
 *
 * The icon is decorative here: the word beside it says the same thing, and a
 * row that announced "checkmark Recyclable" would read the answer twice.
 */
export function VerdictPill({ verdict, className }: { verdict: VerdictKind; className?: string }) {
  const { word, icon, tone, surface } = VERDICT[verdict];

  return (
    <View
      className={cn(
        'shrink flex-row items-center gap-1 border rounded-button px-2 py-1',
        surface,
        className,
      )}
    >
      <Ionicons
        name={icon}
        size={13}
        color={VERDICT[verdict].iconColor}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text className={cn('text-label font-semibold', tone)}>{word}</Text>
    </View>
  );
}
