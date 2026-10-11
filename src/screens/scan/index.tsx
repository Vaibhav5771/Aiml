import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { IconTile } from '@/components/icon-tile';
import { LoadingOverlay } from '@/components/loading-overlay';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Pressable, Text, View } from '@/tw';

/**
 * Scan, the home screen.
 *
 * The camera is real; what happens after the shutter is not yet. Feature 3
 * (the vision read) and feature 7 (the walking skeleton) replace the fake
 * delay below with a real call through `proxy/`.
 */

/**
 * The thinking state stays up for at least this long.
 *
 * Capture can finish in 200ms or take two seconds. Without a floor the
 * overlay would flash and look like a glitch; with one it reads as the app
 * doing something. The real vision call will usually exceed this anyway.
 */
const MIN_READING_MS = 1200;

export function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [reading, setReading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  function goToResult(photoUri?: string) {
    setReading(false);
    router.push({
      pathname: '/result/[id]',
      params: { id: 'demo', photo: photoUri ?? '' },
    });
  }

  /**
   * Stands in for the real pipeline: resize, send to the proxy, read the
   * attributes back, run the rules. Feature 7 replaces the wait with that work.
   */
  function readPackaging(capture: () => Promise<string | undefined>) {
    if (reading) return;
    setReading(true);
    const startedAt = Date.now();

    capture()
      .catch(() => undefined)
      .then((uri) => {
        const elapsed = Date.now() - startedAt;
        setTimeout(() => goToResult(uri), Math.max(0, MIN_READING_MS - elapsed));
      });
  }

  function onShutter() {
    readPackaging(async () => {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      return shot?.uri;
    });
  }

  async function onPickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    readPackaging(async () => uri);
  }

  // Permission not answered yet. Expo returns null on the very first render.
  if (!permission) {
    return (
      <Screen>
        <AppHeader />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // Refused. Say what is needed and why, and give a way forward.
  if (!permission.granted) {
    return (
      <Screen>
        <AppHeader />
        <StateView
          icon="camera-outline"
          title="Recyclens needs the camera"
          /*
           * This copy says plainly that the photo leaves the device, because
           * it does: the read happens in `proxy/`, not on the phone. Keep that
           * sentence true if the pipeline ever changes.
           */
          explanation="It reads the packaging from a photo you take, which is sent to the Recyclens service to be read. Nothing is sent until you press the shutter."
          action={
            permission.canAskAgain
              ? { label: 'Allow camera', icon: 'camera', onPress: requestPermission }
              : {
                  label: 'Open settings',
                  icon: 'settings-outline',
                  onPress: () => Linking.openSettings(),
                }
          }
          secondaryAction={{
            label: 'Or pick a photo from your gallery',
            onPress: onPickFromGallery,
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader />

      <View className="flex-1 m-4 rounded-frame overflow-hidden bg-black">
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
        />

        {/*
         * Framing guides, held clear of the helper text below them. Their
         * colour sits over live video rather than over an app surface, so it
         * is on the drift check allow list rather than in the palette.
         */}
        <View className="absolute top-6 left-6 w-7 h-7 border-t-2 border-l-2 border-[#FFFFFFE6] rounded-tl-tile" />
        <View className="absolute top-6 right-6 w-7 h-7 border-t-2 border-r-2 border-[#FFFFFFE6] rounded-tr-tile" />
        <View className="absolute bottom-24 left-6 w-7 h-7 border-b-2 border-l-2 border-[#FFFFFFE6] rounded-bl-tile" />
        <View className="absolute bottom-24 right-6 w-7 h-7 border-b-2 border-r-2 border-[#FFFFFFE6] rounded-br-tile" />

        {!reading && (
          <View className="absolute left-0 right-0 bottom-6 px-6" pointerEvents="none">
            <Text className="text-label font-medium text-white text-center">
              Fill the frame with the packaging. Include any symbols you can see.
            </Text>
          </View>
        )}

        {reading && (
          <LoadingOverlay
            title="Reading the packaging..."
            detail="Checking material and local rules"
          />
        )}
      </View>

      <View className="flex-row items-center justify-around px-6 pb-4 pt-1">
        <ControlButton icon="images-outline" label="Gallery" onPress={onPickFromGallery} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          accessibilityState={{ disabled: reading, busy: reading }}
          onPress={onShutter}
          disabled={reading}
          className={cn(
            'focus-ring w-[84px] h-[84px] rounded-full border-[3px] border-accent items-center justify-center',
            reading ? 'opacity-40' : 'active:opacity-85'
          )}>
          <View className="w-[68px] h-[68px] rounded-full bg-primary items-center justify-center">
            <Ionicons name="camera" size={28} color={colors.card} />
          </View>
        </Pressable>

        <ControlButton
          icon={torch ? 'flash' : 'flash-outline'}
          label="Flash"
          active={torch}
          onPress={() => setTorch((on) => !on)}
        />
      </View>
    </Screen>
  );
}

/**
 * A camera control: a 48dp tile with its name under it.
 *
 * The label is visible as well as announced, because an icon alone leaves you
 * guessing what the tile does.
 */
function ControlButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof IconTile>['icon'];
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="focus-ring items-center gap-2 w-[72px] rounded-tile active:opacity-85">
      <IconTile icon={icon} size="md" variant={active ? 'accent' : 'soft'} />
      <Text className="text-label text-ink-soft text-center">{label}</Text>
    </Pressable>
  );
}
