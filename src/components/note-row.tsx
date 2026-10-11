import { Ionicons } from '@expo/vector-icons';

import { noteIcon } from '@/theme';
import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';

/**
 * A warm caveat under the attributes, e.g. that the symbol was faded so the
 * material was judged another way.
 *
 * It exists so nothing on screen claims more certainty than the attributes
 * support, which is an explicit requirement of feature 9.
 */
export function NoteRow({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <View
      className={cn(
        'flex-row gap-2 bg-note-surface border border-note-edge rounded-card p-4',
        className
      )}>
      <Ionicons
        name="information-circle-outline"
        size={18}
        color={noteIcon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text className="flex-1 text-label text-ink-soft">{children}</Text>
    </View>
  );
}
