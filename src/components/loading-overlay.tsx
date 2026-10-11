import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';

/**
 * The scrim that covers live content while the app is thinking.
 *
 * Its colours are deliberately NOT tokens, and they are on the drift check
 * allow list saying so: this sits over camera video rather than over an app
 * surface, so it answers to the photographed scene, not to the palette. A
 * palette value here would be a lie about where the number came from.
 *
 * It announces itself to a screen reader as a live status rather than leaving
 * someone who cannot see the scrim wondering whether the shutter worked.
 */
export function LoadingOverlay({
  title,
  detail,
  className,
}: {
  title: string;
  detail?: string;
  className?: string;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={detail ? `${title} ${detail}` : title}
      accessibilityLiveRegion="polite"
      className={cn(
        'absolute inset-0 bg-[#00000099] items-center justify-center gap-2 px-6',
        className
      )}>
      <View className="w-[84px] h-[84px] rounded-full border-2 border-[#FFFFFFBF] items-center justify-center mb-2">
        <Ionicons name="sparkles" size={24} color={colors.card} />
      </View>

      <Text className="text-title font-bold text-white text-center">{title}</Text>

      {detail ? (
        <Text className="text-label text-[#FFFFFFD9] text-center">{detail}</Text>
      ) : null}
    </View>
  );
}
