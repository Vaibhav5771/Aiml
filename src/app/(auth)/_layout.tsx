import { Stack } from 'expo-router';

import { colors } from '@/theme';

/**
 * The sign-in / sign-up stack.
 *
 * Mounted only while signed out: the root layout's `Stack.Protected` guard
 * unmounts this whole group the moment a session exists.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
