import { useSignIn } from '@clerk/expo';
import { router } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/screen';
import {
  AuthBanner,
  AuthDivider,
  AuthField,
  AuthHeading,
  AuthLinkText,
  AuthLogo,
  AuthPrimaryButton,
  GoogleButton,
} from '@/screens/auth/components';
import { Image, ScrollView, Text, View } from '@/tw';

/**
 * Sign in with email and password.
 *
 * On success this does not navigate: `signIn.finalize()` activates the
 * session, `useAuth()`'s `isSignedIn` flips to true, and the root layout's
 * `Stack.Protected` guard takes it from there.
 *
 * This Clerk instance has device trust on (`auth_password.device_trust`), so
 * a sign-in from a device Clerk has not seen comes back `needs_client_trust`
 * rather than `complete` on the very first try. That status resolves through
 * the same `mfa.sendEmailCode()` / `mfa.verifyEmailCode()` pair a true second
 * factor would, which is also the only second factor this instance has
 * configured (no authenticator app, no backup codes), so one code step
 * handles both.
 *
 * Only the password strategy is wired for the first factor. Native
 * Google/Apple sign-in and passkeys need a development build, and this is an
 * Expo Go, Android only build (AGENTS.md) — the Google button below is
 * visible to match the reference screenshot but owns up to that limit rather
 * than doing nothing silently.
 *
 * The cream, illustrated look here is deliberate and scoped to this screen
 * and sign-up only (prompts/login-signup.md, `auth-*` tokens in global.css).
 */
export function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [note, setNote] = useState<string | undefined>();

  const submitting = fetchStatus === 'fetching';

  async function onSignIn() {
    setNote(undefined);
    const { error } = await signIn.password({ emailAddress, password });
    if (error) return;

    if (signIn.status === 'complete') {
      await signIn.finalize();
      return;
    }

    if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
      const { error: codeError } = await signIn.mfa.sendEmailCode();
      if (codeError) {
        setNote(codeError.longMessage ?? codeError.message);
        return;
      }
      setStep('verify');
      return;
    }

    // Passkeys, a forced password reset and the rest of the sign-in surface
    // are not built: this app only ever asks for email, password and, when
    // this device is new to Clerk, an email code.
    setNote('This account needs a verification step this app does not support yet.');
  }

  async function onVerify() {
    setNote(undefined);
    const { error } = await signIn.mfa.verifyEmailCode({ code });
    if (error) return;

    if (signIn.status === 'complete') {
      await signIn.finalize();
    } else {
      setNote('That code did not complete sign in. Try again.');
    }
  }

  async function onResendCode() {
    setNote(undefined);
    const { error } = await signIn.mfa.sendEmailCode();
    if (error) setNote(error.longMessage ?? error.message);
  }

  const globalError = errors.global?.[0];
  const banner =
    note ?? (globalError ? (globalError.longMessage ?? globalError.message) : undefined);

  return (
    <Screen className="bg-auth-background">
      <Image
        source={require('@/assets/images/login-asset.png')}
        alt=""
        accessibilityIgnoresInvertColors
        className="absolute top-[12px] right-[-64px] h-[225px] w-[210px] object-contain"
        style={{ transform: [{ rotate: '12deg' }] }}
      />

      <Image
        source={require('@/assets/images/login-bottom-asset.png')}
        alt=""
        accessibilityIgnoresInvertColors
        className="absolute left-0 right-0 bottom-[-16px] w-full object-contain"
        style={{ aspectRatio: 2144 / 733 }}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow justify-center gap-6 p-6"
      >
        <AuthLogo />

        {step === 'details' ? (
          <AuthHeading title="Welcome back" subtitle="Let's make less waste together." />
        ) : (
          <AuthHeading
            title="Confirm it's you"
            subtitle={`This device is new. Enter the code we sent to ${emailAddress}.`}
          />
        )}

        {banner ? <AuthBanner>{banner}</AuthBanner> : null}

        {step === 'details' ? (
          <View className="gap-4">
            <AuthField
              icon="mail-outline"
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder="Email address"
              accessibilityLabel="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!submitting}
              error={errors.fields.identifier?.longMessage ?? errors.fields.identifier?.message}
            />

            <AuthField
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              accessibilityLabel="Password"
              secureToggle
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              editable={!submitting}
              // Only a real rejection (wrong password, too short, ...) shows here —
              // not Clerk's own "Enter password." for an empty field, which just
              // repeats what the placeholder already says.
              error={
                password
                  ? (errors.fields.password?.longMessage ?? errors.fields.password?.message)
                  : undefined
              }
            />

            <View className="items-end">
              <AuthLinkText
                label="Forgot password?"
                size="sm"
                tone="leaf"
                disabled={submitting}
                onPress={() => setNote("Password reset isn't available in the app yet.")}
              />
            </View>

            <AuthPrimaryButton label="Sign in" loading={submitting} onPress={onSignIn} />

            <AuthDivider label="or continue with" />

            <GoogleButton
              onPress={() =>
                setNote(
                  'Continue with Google needs a development build. Use email and password for now.',
                )
              }
            />
          </View>
        ) : (
          <View className="gap-4">
            <AuthField
              icon="keypad-outline"
              value={code}
              onChangeText={setCode}
              placeholder="Verification code"
              accessibilityLabel="Verification code"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              editable={!submitting}
              error={errors.fields.code?.longMessage ?? errors.fields.code?.message}
            />

            <AuthPrimaryButton label="Verify" loading={submitting} onPress={onVerify} />

            <View className="items-center">
              <AuthLinkText label="Resend code" onPress={onResendCode} disabled={submitting} />
            </View>
          </View>
        )}

        {step === 'details' ? (
          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-body font-inter text-auth-ink-soft">New to Recyclens?</Text>
            <AuthLinkText
              label="Create account"
              onPress={() => router.replace('/(auth)/sign-up')}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
