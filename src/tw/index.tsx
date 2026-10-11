/**
 * className enabled wrappers.
 *
 * react-native-css does not patch React Native's components globally, so each
 * one you want to style with Tailwind classes has to be wrapped once, here.
 * Import these instead of the `react-native` originals:
 *
 *   import { View, Text } from '@/tw';
 *
 * Only the components this app actually uses are wrapped. Add more as needed
 * rather than wrapping everything up front.
 */
import { Image as ExpoImage } from 'expo-image';
import { Link as RouterLink } from 'expo-router';
import React from 'react';
import {
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  Text as RNText,
  View as RNView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import {
  useCssElement,
  useNativeVariable as useFunctionalVariable,
} from 'react-native-css';

/** Read a CSS variable from JS, for props that take a value not a class. */
export const useCSSVariable =
  process.env.EXPO_OS !== 'web'
    ? useFunctionalVariable
    : (variable: string) => `var(${variable})`;

export const View = (
  props: React.ComponentProps<typeof RNView> & { className?: string }
) => useCssElement(RNView, props, { className: 'style' });
View.displayName = 'CSS(View)';

export const Text = (
  props: React.ComponentProps<typeof RNText> & { className?: string }
) => useCssElement(RNText, props, { className: 'style' });
Text.displayName = 'CSS(Text)';

export const Pressable = (
  props: React.ComponentProps<typeof RNPressable> & { className?: string }
) => useCssElement(RNPressable, props, { className: 'style' });
Pressable.displayName = 'CSS(Pressable)';

export const ScrollView = (
  props: React.ComponentProps<typeof RNScrollView> & {
    className?: string;
    contentContainerClassName?: string;
  }
) =>
  useCssElement(RNScrollView, props, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle',
  });
ScrollView.displayName = 'CSS(ScrollView)';

export const SafeAreaView = (
  props: React.ComponentProps<typeof RNSafeAreaView> & { className?: string }
) => useCssElement(RNSafeAreaView, props, { className: 'style' });
SafeAreaView.displayName = 'CSS(SafeAreaView)';

export const Link = (
  props: React.ComponentProps<typeof RouterLink> & { className?: string }
) => useCssElement(RouterLink, props, { className: 'style' });

/** Remaps the CSS `object-fit` style onto expo-image's `contentFit` prop. */
function CSSImage(props: React.ComponentProps<typeof ExpoImage>) {
  // @ts-expect-error objectFit arrives via the style object, not as a prop.
  const { objectFit, objectPosition, ...style } = StyleSheet.flatten(props.style) || {};

  return (
    <ExpoImage
      contentFit={objectFit}
      contentPosition={objectPosition}
      {...props}
      source={typeof props.source === 'string' ? { uri: props.source } : props.source}
      style={style}
    />
  );
}

export const Image = (
  props: React.ComponentProps<typeof CSSImage> & { className?: string }
) => useCssElement(CSSImage, props, { className: 'style' });
Image.displayName = 'CSS(Image)';
