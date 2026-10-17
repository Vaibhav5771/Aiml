import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

import { authColors } from '@/theme';
import { cn } from '@/tw/cn';
import { Image, Pressable, Text, View } from '@/tw';
import type { ScanSummary } from '@/vision/types';

import { VERDICT } from './verdict';
import { VerdictPill } from './verdict-pill';

/**
 * One past scan in the history list: its photo, what it was, what the app
 * decided, and when.
 *
 * The whole row is the target rather than a chevron at the end, which is what
 * gets it past 48dp without inventing a size: the thumbnail is 56dp and the
 * padding does the rest.
 *
 * The photo can genuinely be gone, the same way it can on the verdict screen:
 * a row whose file the startup sweep collected, or one restored from a backup.
 * `ScanPhoto` is not reused here because that component opens the photo full
 * screen on tap, and a tap inside this row has to open the scan. The fallback
 * tile is the same idea at this size.
 */
function Thumbnail({ uri }: { uri: string }) {
  const [broken, setBroken] = useState(false);

  if (uri.length === 0 || broken) {
    return (
      <View className="w-[56px] h-[56px] rounded-tile bg-auth-surface border border-auth-hairline items-center justify-center">
        <Ionicons
          name="image-outline"
          size={20}
          color={authColors.inkSoft}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      accessibilityIgnoresInvertColors
      // The row's own label names the item, so the image is decoration.
      alt=""
      onError={() => setBroken(true)}
      className="w-[56px] h-[56px] rounded-tile bg-auth-surface object-cover"
    />
  );
}

export function HistoryRow({
  summary,
  when,
  onPress,
  className,
}: {
  summary: ScanSummary;
  /** Already formatted by the caller, so this component stays pure of clocks. */
  when: string;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      /*
       * One label for the whole row, in reading order, so a screen reader says
       * "Yogurt tub, Recyclable, 2 hours ago" once instead of walking four
       * separate nodes. The verdict word comes from the same record the pill
       * draws from, so the spoken and the seen answer cannot drift.
       */
      accessibilityLabel={`${summary.itemName}, ${VERDICT[summary.verdict].word}${
        when ? `, ${when}` : ''
      }`}
      accessibilityHint="Opens this scan"
      onPress={onPress}
      className={cn(
        'focus-ring flex-row items-center gap-3 p-3 rounded-card border border-auth-hairline bg-auth-surface active:opacity-85',
        className,
      )}
    >
      <Thumbnail uri={summary.photoUri} />

      <View className="flex-1 gap-1">
        <Text numberOfLines={1} className="text-body font-inter-bold text-auth-ink">
          {summary.itemName}
        </Text>

        <View className="flex-row items-center gap-2">
          <VerdictPill verdict={summary.verdict} />
          {when ? <Text className="text-label font-inter text-auth-ink-soft">{when}</Text> : null}
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={authColors.inkSoft}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}
