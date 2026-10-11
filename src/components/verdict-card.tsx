import { Ionicons } from '@expo/vector-icons';

import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';
import type { VerdictKind } from '@/vision/types';

import { VERDICT } from './verdict';

/**
 * The loudest thing on the Result screen. The answer, before the reasoning.
 *
 * Every visual part of the verdict (the word, the icon, the colour) comes from
 * the one record in `verdict.ts`, so this card cannot drift from the history
 * pill feature 11 will build. It used to hold three private maps of its own,
 * which is exactly the drift that spec 0002 closed.
 */
export function VerdictCard({
  verdict,
  action,
  confidence,
  className,
}: {
  verdict: VerdictKind;
  action: string;
  confidence: number;
  className?: string;
}) {
  const { word, icon, tone, surface, edge, iconColor } = VERDICT[verdict];

  return (
    <View className={cn('border rounded-card p-6 gap-2', surface, className)}>
      <View className="flex-row justify-end">
        <View className={cn('border rounded-button px-3 py-1 bg-card', edge)}>
          <Text className={cn('text-label font-bold', tone)}>{confidence}% confident</Text>
        </View>
      </View>

      <View className="flex-row items-center gap-4">
        <View
          className={cn(
            'w-[52px] h-[52px] rounded-full border-2 items-center justify-center',
            edge
          )}>
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
          <Text accessibilityRole="header" className={cn('text-verdict font-bold', tone)}>
            {word}
          </Text>
          <Text className="text-body font-medium text-ink-soft">{action}</Text>
        </View>
      </View>
    </View>
  );
}
