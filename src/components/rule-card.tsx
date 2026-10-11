import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';
import type { AppliedRule } from '@/vision/types';

import { IconTile } from './icon-tile';

/**
 * The rule that turned the observations into the verdict, with the source it
 * came from.
 *
 * This card is why the product is defensible rather than a guess, so it gets
 * real room on the screen instead of being a footnote under the verdict.
 *
 * The data shape is owned by feature 4 (Local recycling rule set) and
 * `src/vision/types.ts` still marks it PROVISIONAL, so expect to touch this
 * component again once that feature settles the vocabulary.
 */
export function RuleCard({ rule, className }: { rule: AppliedRule; className?: string }) {
  return (
    <View
      className={cn(
        'flex-row gap-2 bg-card border border-hairline border-l-4 border-l-accent rounded-card p-4',
        className
      )}>
      <IconTile icon="reader-outline" />

      <View className="flex-1 gap-2">
        <Text className="text-body text-ink">{rule.text}</Text>
        {/* The citation reads as a source, so it takes the accent. 5.44:1. */}
        <Text className="text-label font-semibold text-accent">{rule.source}</Text>
      </View>
    </View>
  );
}
