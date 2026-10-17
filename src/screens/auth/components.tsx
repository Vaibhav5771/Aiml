import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { authColors, colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Pressable, Text, TextInput, View } from '@/tw';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Shared pieces for the sign-in / sign-up redesign (prompts/login-signup.md).
 *
 * Deliberately separate from `src/components/`: that directory is the design
 * system's general inventory (docs/design.md), and everything here reads the
 * `auth-*` tokens scoped to this one flow rather than the Apple palette every
 * other screen uses. Same reasoning as the welcome screen's own one-off brand
 * treatment.
 */

export function AuthLogo() {
  return (
    <View className="items-center gap-2">
      <Ionicons
        name="leaf"
        size={32}
        color={authColors.leaf}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text className="text-body font-inter-bold text-auth-ink">Recyclens</Text>
    </View>
  );
}

/**
 * BluuNext-Bold silently drops "ack": its GSUB table substitutes the
 * sequence for a glyph that paints as nothing on Android, so "Welcome back"
 * rendered as just "Welcome" with no error, warning, or fallback. Every
 * individual glyph and its metrics are normal (checked against the font's
 * own cmap/hmtx tables), and the system font renders the same string
 * correctly, so this is the font's own lookup table, not a layout bug. A
 * zero-width non-joiner between "a" and "ck" blocks that lookup without
 * showing up — confirmed on device — so this only has to run for text set in
 * `font-display`. Breaking directly before "ck" instead did not work: the
 * lookup is keyed off the full three letter run, not the pair.
 */
function breakBrokenLigatures(text: string): string {
  return text.replace(/ack/g, 'a‌ck');
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        {/* font-display is BluuNext-Bold, a single weight, so no font-bold alongside it (same rule as the welcome screen: see src/global.css). */}
        <Text accessibilityRole="header" className="text-auth-heading font-display text-auth-ink">
          {breakBrokenLigatures(title)}
        </Text>
        <Ionicons
          name="sparkles"
          size={18}
          color={authColors.spark}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
      <Text className="text-body font-inter text-auth-ink-soft">{subtitle}</Text>
    </View>
  );
}

/**
 * An email / password / name field for the auth redesign: a leading icon
 * instead of a label, since the placeholder carries that role in the
 * reference screenshots, and an optional trailing show/hide toggle for a
 * password.
 */
export function AuthField({
  icon,
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  error,
  secureToggle = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoComplete,
  autoCorrect = true,
  editable = true,
}: {
  icon: IconName;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  error?: string;
  secureToggle?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  autoCorrect?: boolean;
  editable?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  const hidden = secureToggle && !reveal;

  return (
    <View className="gap-1">
      <View
        className={cn(
          'min-h-[52px] flex-row items-center gap-3 rounded-card border border-auth-hairline bg-auth-surface px-4',
          !editable && 'opacity-40',
        )}
      >
        <Ionicons
          name={icon}
          size={20}
          color={authColors.inkSoft}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={authColors.inkSoft}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          editable={editable}
          accessibilityLabel={accessibilityLabel}
          className="flex-1 text-body font-inter text-auth-ink"
        />
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
            onPress={() => setReveal((value) => !value)}
            className="h-[48px] w-[48px] items-center justify-center"
          >
            <Ionicons
              name={reveal ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={authColors.inkSoft}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View className="flex-row items-start gap-1 px-1">
          <Ionicons
            name="alert-circle"
            size={14}
            color={authColors.inkSoft}
            style={{ marginTop: 2 }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text className="flex-1 text-label font-inter text-auth-ink">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function AuthPrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={cn(
        'focus-ring min-h-[52px] flex-row items-center justify-center gap-2 rounded-button bg-auth-primary px-4',
        inactive ? 'opacity-40' : 'active:opacity-85',
      )}
    >
      {/*
       * White label on `auth-primary`: ~2.7:1, below the 4.5:1 this file holds
       * every other colour to. `auth-ink` on the fill clears 6.9:1, but white
       * is what was asked for after seeing the dark-ink version live, so this
       * is a known, flagged exception rather than an oversight.
       */}
      {loading ? (
        <ActivityIndicator color={colors.card} />
      ) : (
        <>
          <Text className="text-body font-inter-bold text-card">{label}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.card} />
        </>
      )}
    </Pressable>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-[1px] flex-1 bg-auth-hairline" />
      <Text className="text-label font-inter text-auth-ink-soft">{label}</Text>
      <View className="h-[1px] flex-1 bg-auth-hairline" />
    </View>
  );
}

export function GoogleButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      onPress={onPress}
      className="focus-ring min-h-[52px] flex-row items-center justify-center gap-2 rounded-button border border-auth-hairline bg-auth-surface px-4 active:opacity-85"
    >
      <Ionicons name="logo-google" size={18} color={authColors.ink} />
      <Text className="text-body font-inter-bold text-auth-ink">Continue with Google</Text>
    </Pressable>
  );
}

/** Literal class map for `AuthLinkText`'s `tone`, never interpolated (docs/design.md). */
const AUTH_LINK_TONE = {
  link: 'text-auth-link',
  leaf: 'text-auth-leaf',
} as const;

/** A text only action: "Create account", "Forgot password?". */
export function AuthLinkText({
  label,
  onPress,
  disabled = false,
  size = 'md',
  tone = 'link',
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  tone?: keyof typeof AUTH_LINK_TONE;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'focus-ring min-h-[48px] justify-center px-1',
        disabled ? 'opacity-40' : 'active:opacity-60',
      )}
    >
      <Text
        className={cn(
          'font-inter-bold',
          AUTH_LINK_TONE[tone],
          size === 'md' ? 'text-body' : 'text-label',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** An info banner in the auth palette, standing in for `NoteRow` on these two screens. */
export function AuthBanner({ children }: { children: string }) {
  return (
    <View className="flex-row gap-2 rounded-card border border-auth-hairline bg-auth-surface p-4">
      <Ionicons
        name="information-circle-outline"
        size={18}
        color={authColors.inkSoft}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text className="flex-1 text-label font-inter text-auth-ink-soft">{children}</Text>
    </View>
  );
}
