import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import '@/global.css';
import { sweepOrphanPhotos } from '@/db';
import { authColors, colors } from '@/theme';
import { Text } from '@/tw';

/**
 * Required by `@clerk/expo`: environment variables inside node_modules are
 * not inlined into a production build, so the key has to be read here and
 * passed down rather than read inside the SDK itself.
 */
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Copy .env.example to .env and add your Clerk publishable key.',
  );
}

// Held until the auth state resolves below, so a cold start never shows a
// blank frame between the native splash and the first real screen.
void SplashScreen.preventAutoHideAsync();

/**
 * Root navigator.
 *
 * The tabs group holds Home, Scan and History. The result screen is pushed on top of
 * the tabs rather than living inside them, because the prototype shows it with
 * a back arrow and no bottom navigation.
 */
const recyclensNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.ink,
    primary: colors.primary,
    border: colors.hairline,
  },
};

function RootNavigator() {
  /*
   * One sweep at app start removes every photo with no row behind it: a copy
   * that outlived a failed insert, and a file whose delete failed after its
   * row was already gone (spec 0006, AC-10).
   *
   * Deliberately not awaited and deliberately not surfaced. It touches nothing
   * the user can see, a failure is already a returned value rather than a
   * throw, and nothing about the app should wait on housekeeping.
   */
  useEffect(() => {
    void sweepOrphanPhotos();
  }, []);

  const { isLoaded, isSignedIn } = useAuth();

  // The welcome screen's brand moment: Bluu Next for its headline, Inter for
  // everything beside it. Neither replaces `--font-sans`, which still carries
  // every other screen (see the comment in global.css).
  const [fontsLoaded] = useFonts({
    'BluuNext-Bold': require('@/assets/fonts/BluuNext-Bold.otf'),
    Inter_400Regular,
    Inter_700Bold,
  });

  const ready = isLoaded && fontsLoaded;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Nothing to decide yet: the native splash is still covering this frame.
  if (!ready) return null;

  return (
    <ThemeProvider value={recyclensNavTheme}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Protected guard={isSignedIn === true}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/*
           * The real Stack header, not a hand drawn bar.
           *
           * The result screen used to draw its own, which spec 0002 recorded as
           * a known debt and a named tell: hand rolling it gives up the back
           * swipe gesture and tap to scroll to top, and it applies the top safe
           * area inset a second time on top of the one the navigator already
           * owns. Spec 0007 closed that debt, so `Screen` inside the result body
           * now asks for the bottom edge only (AC-11).
           *
           * `headerTitle` renders the title through the design system's own type
           * tokens rather than `headerTitleStyle`, which would take a raw font
           * size and a raw weight. It is the same `text-body font-bold` the hand
           * drawn bar used, so nothing moved visually.
           */}
          <Stack.Screen
            name="result/[id]"
            options={{
              title: 'Result',
              headerTitle: () => (
                <Text className="text-body font-display text-auth-ink">Result</Text>
              ),
              headerStyle: { backgroundColor: authColors.background },
              // No shadow: the screen is white, the header is white, and a line
              // between them would be the only separator in the app that is not
              // a hairline doing real work.
              headerShadowVisible: false,
              headerTintColor: authColors.ink,
            }}
          />
          <Stack.Screen
            name="result/unsaved"
            options={{
              title: 'Result',
              headerTitle: () => (
                <Text className="text-body font-display text-auth-ink">Result</Text>
              ),
              headerStyle: { backgroundColor: authColors.background },
              headerShadowVisible: false,
              headerTintColor: authColors.ink,
            }}
          />

          {/*
           * The photo, full screen. A modal rather than a push, because looking
           * closer at the photo is a detour from reading the verdict rather than
           * a step further into it (spec 0007, AC-10).
           */}
          <Stack.Screen name="photo" options={{ presentation: 'modal', headerShown: false }} />
        </Stack.Protected>

        {/* Signed out: only the sign-in / sign-up stack is reachable. */}
        <Stack.Protected guard={isSignedIn === false}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    // Non-null: the throw above already guarantees this by the time a screen
    // renders. TypeScript cannot see across the module-scope guard into this
    // closure on its own.
    <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
      <RootNavigator />
    </ClerkProvider>
  );
}
