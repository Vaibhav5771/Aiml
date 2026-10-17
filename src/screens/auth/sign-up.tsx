import { Ionicons } from '@expo/vector-icons';
import { useSignUp } from '@clerk/expo';
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
import { authColors } from '@/theme';
import { Image, Pressable, ScrollView, Text, View } from '@/tw';

/**
 * Create an account with a name, email and password, then verify the email
 * with a code.
 *
 * `signUp.status` decides the path after `password()`: 'complete' when the
 * Clerk instance does not require email verification, 'missing_requirements'
 * when it does. Both are handled, so this never assumes the dashboard's
 * verification setting.
 *
 * The full name is split into `firstName`/`lastName` for Clerk, which only
 * keeps either if "First and last name" is enabled on the instance; if it
 * is not, Clerk just ignores them rather than failing the sign-up. The
 * Terms checkbox maps to Clerk's own `legalAccepted` flag rather than being
 * a purely local gate.
 *
 * The cream, illustrated look here is deliberate and scoped to this screen
 * and sign-in only (prompts/login-signup.md, `auth-*` tokens in global.css).
 */
export function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const [fullName, setFullName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [note, setNote] = useState<string | undefined>();

  const submitting = fetchStatus === 'fetching';

  async function onCreateAccount() {
    setNote(undefined);

    if (!fullName.trim()) {
      setNote('Enter your full name.');
      return;
    }
    if (!agreed) {
      setNote('Agree to the Terms & Privacy Policy to continue.');
      return;
    }

    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    const lastName = rest.join(' ') || undefined;

    const { error } = await signUp.password({
      emailAddress,
      password,
      firstName,
      lastName,
      legalAccepted: true,
    });
    if (error) return;

    if (signUp.status === 'complete') {
      await signUp.finalize();
      return;
    }

    const { error: codeError } = await signUp.verifications.sendEmailCode();
    if (codeError) {
      setNote(codeError.longMessage ?? codeError.message);
      return;
    }
    setStep('verify');
  }

  async function onVerify() {
    setNote(undefined);
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return;

    if (signUp.status === 'complete') {
      await signUp.finalize();
    } else {
      setNote('That code did not complete your account. Try again.');
    }
  }

  async function onResendCode() {
    setNote(undefined);
    const { error } = await signUp.verifications.sendEmailCode();
    if (error) setNote(error.longMessage ?? error.message);
  }

  function onEditEmail() {
    setNote(undefined);
    setCode('');
    void signUp.reset();
    setStep('details');
  }

  const globalError = errors.global?.[0];
  const banner =
    note ?? (globalError ? (globalError.longMessage ?? globalError.message) : undefined);

  return (
    <Screen className="bg-auth-background">
      <Image
        source={require('@/assets/images/signup-asset.png')}
        alt=""
        accessibilityIgnoresInvertColors
        className="absolute top-[16px] right-[-72px] h-[285px] w-[190px] object-contain"
        style={{ transform: [{ rotate: '8deg' }] }}
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
          <AuthHeading title="Create account" subtitle="Start your sustainable journey." />
        ) : (
          <AuthHeading
            title="Check your email"
            subtitle={`Enter the code we sent to ${emailAddress}.`}
          />
        )}

        {banner ? <AuthBanner>{banner}</AuthBanner> : null}

        {step === 'details' ? (
          <View className="gap-4">
            <AuthField
              icon="person-outline"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              accessibilityLabel="Full name"
              autoCapitalize="words"
              autoComplete="name"
              editable={!submitting}
            />

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
              error={errors.fields.emailAddress?.longMessage ?? errors.fields.emailAddress?.message}
            />

            <AuthField
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 15 characters"
              accessibilityLabel="Password"
              secureToggle
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              editable={!submitting}
              // Only a real rejection shows here, not Clerk's own "Enter password."
              // for an empty field — see the matching comment in sign-in.tsx.
              error={
                password
                  ? (errors.fields.password?.longMessage ?? errors.fields.password?.message)
                  : undefined
              }
            />

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed, disabled: submitting }}
              accessibilityLabel="I agree to the Terms & Privacy Policy"
              disabled={submitting}
              onPress={() => setAgreed((value) => !value)}
              className="min-h-[48px] flex-row items-center gap-2 active:opacity-60"
            >
              <Ionicons
                name={agreed ? 'checkbox' : 'square-outline'}
                size={20}
                color={agreed ? authColors.link : authColors.inkSoft}
              />
              {/* No Terms/Privacy page exists yet; styled as a link for when one does. */}
              <Text className="flex-1 text-label font-inter text-auth-ink-soft">
                I agree to the{' '}
                <Text className="text-label font-inter-bold text-auth-link">Terms</Text> &{' '}
                <Text className="text-label font-inter-bold text-auth-link">Privacy Policy</Text>
              </Text>
            </Pressable>

            <AuthPrimaryButton
              label="Create Account"
              loading={submitting}
              onPress={onCreateAccount}
            />

            <AuthDivider label="or sign up with" />

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

            <View className="flex-row items-center justify-center gap-4">
              <AuthLinkText label="Resend code" onPress={onResendCode} disabled={submitting} />
              <AuthLinkText
                label="Use a different email"
                onPress={onEditEmail}
                disabled={submitting}
              />
            </View>
          </View>
        )}

        {step === 'details' ? (
          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-body font-inter text-auth-ink-soft">
              Already have an account?
            </Text>
            <AuthLinkText label="Sign in" onPress={() => router.replace('/(auth)/sign-in')} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
