import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';

import { colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Image, Pressable, View } from '@/tw';

/**
 * The photo that was scanned, small, opening full screen on tap.
 *
 * Small on purpose: the answer is what the screen is for, and a large photo at
 * the top would push the verdict below the fold on a short phone. Tapping it
 * is how you check the app looked at what you thought it did (AC-10).
 *
 * The file can genuinely be gone. A scan whose row survived a photo the
 * startup sweep collected, or one restored from a backup, both land here with
 * a uri pointing at nothing. A placeholder tile says so quietly, and it is
 * deliberately NOT tappable: there is nothing to open, and a control that does
 * nothing is worse than no control.
 */
export function ScanPhoto({
  uri,
  itemName,
  className,
}: {
  uri: string;
  itemName: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const missing = uri.length === 0 || broken;

  if (missing) {
    return (
      <View
        className={cn(
          'w-[48px] h-[48px] rounded-thumb bg-card border border-hairline items-center justify-center',
          className,
        )}
      >
        <Ionicons
          name="image-outline"
          size={18}
          color={colors.inkSoft}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`The photo you took of ${itemName}`}
      accessibilityHint="Opens the photo full screen"
      onPress={() => router.push({ pathname: '/photo', params: { uri } })}
      className={cn('focus-ring rounded-thumb active:opacity-85', className)}
    >
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        // The pressable above carries the name, so the image inside it is
        // decoration as far as assistive tech is concerned.
        alt=""
        onError={() => setBroken(true)}
        className="w-[48px] h-[48px] rounded-thumb bg-card object-cover"
      />
    </Pressable>
  );
}
