import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Text, TextInput, View } from '@/tw';

/**
 * A labelled text input: email, password and verification code fields for
 * sign in and sign up.
 *
 * A wrong field is marked with an icon and a word, never a red border.
 * `verdict-no` is reserved for the verdict itself (design.md: "never anything
 * else"), so a form error has no colour of its own to reach for.
 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoComplete,
  autoCorrect = true,
  editable = true,
  className,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences';
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  autoCorrect?: boolean;
  editable?: boolean;
  className?: string;
}) {
  return (
    <View className={cn('gap-1', className)}>
      <Text className="text-label font-medium text-ink-soft">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        editable={editable}
        accessibilityLabel={label}
        className={cn(
          'focus-ring min-h-[48px] rounded-tile border border-hairline bg-card px-4 text-body text-ink',
          !editable && 'opacity-40',
        )}
      />
      {error ? (
        <View className="flex-row items-start gap-1">
          <Ionicons name="alert-circle" size={14} color={colors.inkSoft} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-label font-medium text-ink">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
