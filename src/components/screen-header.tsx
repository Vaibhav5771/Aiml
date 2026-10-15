import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Pressable, Text, View } from '@/tw';

/**
 * The bar at the top of a pushed screen: a back control, a title, and an
 * optional slot on the right.
 *
 * The title sits between two equal 48px columns, so it stays optically
 * centred whether or not the right slot is filled. At a large font size it
 * wraps rather than truncating, which is the whole point of AC-5: a wrapped
 * title is readable, an ellipsis is not.
 *
 * Feature 9 owns the result screen and should reconsider whether this bar
 * should be the Stack header instead. Hand drawing it gives up back swipe and
 * scroll to top, and it is a named tell (the Hand Rolled Header). It is kept
 * here because the current screen already works this way and spec 0002 is
 * about the system, not about relitigating that screen.
 */
export function ScreenHeader({
  title,
  onBack,
  right,
  className,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('flex-row items-center gap-2 px-4 py-2', className)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack ?? (() => router.back())}
        className="focus-ring w-[48px] h-[48px] rounded-full bg-card border border-hairline items-center justify-center active:opacity-85"
      >
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>

      <Text className="flex-1 text-body font-bold text-ink text-center">{title}</Text>

      {right ?? <View className="w-[48px] h-[48px]" />}
    </View>
  );
}
