import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Screen } from '@/components/screen';
import { colors } from '@/theme';
import { Image, Pressable, Text, View } from '@/tw';

/**
 * The first thing a signed out person sees. Tapping the chevron moves on to sign in,
 * which carries its own link across to sign up for anyone new.
 *
 * The layout and the two brand fonts (`font-display`, `font-inter`) come from
 * a reference mock the app's own warm eco palette was deliberately dropped
 * from everywhere except the signed out flow (see `src/global.css`). This
 * screen shares `auth-background` with sign-in and sign-up for one consistent
 * backdrop; the heading, tagline and chevron action stay on the Apple tokens
 * (`ink`, `ink-soft`, `primary`) rather than picking up the rest of that
 * warm palette too.
 */
export function WelcomeScreen() {
  return (
    <Screen className="justify-between bg-auth-background">
      <View className="flex-row items-start justify-between gap-4 p-6">
        <View className="flex-1 gap-2">
          <Text accessibilityRole="header" className="text-welcome-heading font-display text-ink">
            Recycle garbage
          </Text>
          <Text className="text-body font-inter text-ink-soft">There is no planet B</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue to sign in"
          onPress={() => router.push('/(auth)/sign-in')}
          className="focus-ring w-[56px] h-[56px] items-center justify-center rounded-full active:opacity-60"
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={colors.ink}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </Pressable>
      </View>

      <Image
        source={require('@/assets/images/splash-screen-asset.png')}
        alt=""
        accessibilityIgnoresInvertColors
        className="w-full flex-1 object-cover"
      />
    </Screen>
  );
}
