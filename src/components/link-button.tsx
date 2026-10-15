import { cn } from '@/tw/cn';
import { Pressable, Text } from '@/tw';

/**
 * A text only action: "Retake", "Or pick a photo from your gallery".
 *
 * Replaces two inline pressables that each re-derived the same padding. The
 * padding is the point: the text is small, so the target is grown to the 48dp
 * floor with padding rather than with `hitSlop`, which leaves the tappable
 * area visible to the layout inspector and to anyone measuring it.
 *
 * Text with no surface behind it dims further on press than a filled surface
 * does, because there is no fill to carry the feedback.
 */
export function LinkButton({
  label,
  onPress,
  disabled = false,
  align = 'center',
  className,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  align?: 'start' | 'center';
  className?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'focus-ring min-h-[48px] justify-center px-3 rounded-tile',
        align === 'center' ? 'items-center' : 'items-start',
        disabled ? 'opacity-40' : 'active:opacity-60',
        className,
      )}
    >
      <Text className="text-body font-semibold text-accent">{label}</Text>
    </Pressable>
  );
}
