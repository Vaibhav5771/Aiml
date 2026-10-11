import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import '@/global.css';
import { colors } from '@/theme';

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
  return (
    <ThemeProvider value={recyclensNavTheme}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* The result screen draws its own header, to match the prototype. */}
        <Stack.Screen name="result/[id]" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
