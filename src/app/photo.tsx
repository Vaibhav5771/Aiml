import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppButton } from '@/components/app-button';
import { StateView } from '@/components/state-view';
import { Image, View } from '@/tw';

/**
 * The scanned photo, full screen.
 *
 * A modal rather than a pushed screen, because looking closer at the photo is
 * a detour from reading the verdict, not a step further into it. Dismissing it
 * puts you back exactly where you were.
 *
 * It draws on `bg-ink` rather than the app background: a photo judged against
 * white picks up a colour cast from the surface around it, and the point of
 * opening it is to see what the camera actually caught (spec 0007, AC-10).
 */
export default function Photo() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const [broken, setBroken] = useState(false);

  if (uri === undefined || uri.length === 0 || broken) {
    return (
      <View className="flex-1 bg-background">
        <StateView
          icon="image-outline"
          title="That photo is gone"
          explanation="The file is no longer on this device. The scan itself is still here, with everything it read and the rule it applied."
          action={{ label: 'Back to the result', icon: 'arrow-back', onPress: () => router.back() }}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink">
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        alt="The photo you took of this item"
        onError={() => setBroken(true)}
        className="flex-1 object-contain"
      />

      <View className="flex-row p-4">
        <AppButton label="Done" onPress={() => router.back()} />
      </View>
    </View>
  );
}
