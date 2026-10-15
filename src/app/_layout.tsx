import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import '@/global.css';
import { sweepOrphanPhotos } from '@/db';
import { colors } from '@/theme';
import { Text } from '@/tw';

/**
 * Root navigator.
 *
 * The tabs group holds Scan and History. The result screen is pushed on top of
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

export default function RootLayout() {
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

  return (
    <ThemeProvider value={recyclensNavTheme}>
      <StatusBar style="dark" />
      <Stack>
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
            headerTitle: () => <Text className="text-body font-bold text-ink">Result</Text>,
            headerStyle: { backgroundColor: colors.background },
            // No shadow: the screen is white, the header is white, and a line
            // between them would be the only separator in the app that is not
            // a hairline doing real work.
            headerShadowVisible: false,
            headerTintColor: colors.ink,
          }}
        />
        <Stack.Screen
          name="result/unsaved"
          options={{
            title: 'Result',
            headerTitle: () => <Text className="text-body font-bold text-ink">Result</Text>,
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerTintColor: colors.ink,
          }}
        />

        {/*
         * The photo, full screen. A modal rather than a push, because looking
         * closer at the photo is a detour from reading the verdict rather than
         * a step further into it (spec 0007, AC-10).
         */}
        <Stack.Screen name="photo" options={{ presentation: 'modal', headerShown: false }} />

        {/* Feature 7 scaffolding. Feature 8 deletes this screen and this line. */}
        <Stack.Screen name="dev-scan" options={{ headerShown: false }} />
        {/* Feature 5 scaffolding. Feature 11 deletes this screen and this line. */}
        <Stack.Screen name="dev-data" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
