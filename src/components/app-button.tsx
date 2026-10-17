import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';

import { authColors, colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Pressable, Text, View } from '@/tw';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * The two button shapes the app uses: a filled primary and an outlined
 * secondary.
 *
 * The reference implementation of the component contract: a variant set, every
 * state (pressed, focused, disabled, loading), a `className` merged last, and
 * an accessible name that survives the label being swapped for a spinner.
 *
 * 52px minimum height, comfortably over the 48dp floor, and a minimum rather
 * than a fixed height so a wrapped label at a large font size grows the button
 * instead of spilling out of it.
 */
export function AppButton({
  label,
  icon,
  variant = 'primary',
  tone = 'default',
  disabled = false,
  loading = false,
  onPress,
  className,
}: {
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary';
  /** Signed-in summary screens reuse the auth flow's warm brand treatment. */
  tone?: 'default' | 'auth';
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  className?: string;
}) {
  const isPrimary = variant === 'primary';
  const branded = tone === 'auth';
  const tint = isPrimary
    ? branded
      ? authColors.ink
      : colors.card
    : branded
      ? authColors.link
      : colors.primary;
  // A button mid action must not fire again, whatever the caller passed.
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={cn(
        'focus-ring flex-1 min-h-[52px] rounded-button items-center justify-center px-4',
        isPrimary
          ? branded
            ? 'bg-auth-primary'
            : 'bg-primary'
          : branded
            ? 'bg-auth-surface border border-auth-link'
            : 'bg-card border border-primary',
        inactive ? 'opacity-40' : 'active:opacity-85',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {icon ? <Ionicons name={icon} size={18} color={tint} /> : null}
          <Text
            className={cn(
              'text-body font-semibold text-center',
              isPrimary
                ? branded
                  ? 'font-inter-bold text-auth-ink'
                  : 'text-card'
                : branded
                  ? 'font-inter-bold text-auth-link'
                  : 'text-primary',
            )}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
