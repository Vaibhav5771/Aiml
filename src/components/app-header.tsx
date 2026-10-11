import { Ionicons } from '@expo/vector-icons';

import { REGION } from '@/constants';
import { colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';

import { IconTile } from './icon-tile';

/**
 * The Scan screen's header: the product mark on the left, and the region whose
 * rules are in force on the right.
 *
 * The region is not decoration. A verdict is only meaningful against a named
 * place, so it stays visible rather than being buried in a settings screen
 * nobody opens.
 */
export function AppHeader({ className }: { className?: string }) {
  return (
    <View className={cn('flex-row items-center justify-between gap-2 px-4 py-2', className)}>
      <View className="flex-row items-center gap-2">
        <IconTile icon="leaf" variant="accent" />
        <Text className="text-body font-bold text-ink">Recyclens</Text>
      </View>

      <View className="flex-row items-center gap-1 bg-card border border-hairline rounded-button px-3 py-1">
        <Ionicons
          name="location-outline"
          size={13}
          color={colors.inkSoft}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text className="text-label font-medium text-ink">{REGION.label}</Text>
      </View>
    </View>
  );
}
