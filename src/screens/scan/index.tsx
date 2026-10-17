import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { IconTile } from '@/components/icon-tile';
import { LoadingOverlay } from '@/components/loading-overlay';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { isFailure } from '@/db';
import { PUNE_RULES, assess, decide } from '@/rules';
import { useScans } from '@/store/scans';
import { colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Pressable, Text, View } from '@/tw';
import { readPackaging } from '@/vision/client';
import type { VisionErrorCode } from '@/vision/errors';
import { RECOVERY_LABEL, VISION_FAILURE } from '@/vision/failures';
import { usePreparedPhoto } from '@/vision/prepare';
import type { Capture } from '@/vision/prepare';

/**
 * Scan, the home screen, and the whole pipeline behind the shutter.
 *
 * Feature 8 (Capture a photo) is this file. What it replaced was a 1.2 second
 * delay followed by navigation to a hand written demo scan; what runs now is
 * the real chain, and every stage of it is a stage that can fail:
 *
 *   capture -> prepare -> the proxy (Gemini, and the classifier beside it)
 *           -> the rules -> storage -> the verdict screen
 *
 * The pieces were all built already and this is where they finally meet.
 * `prepare.ts` and `client.ts` came from feature 7, `decide` and `assess` from
 * features 4 and 13, `save` from feature 5. Nothing here reimplements any of
 * them; it sequences them and decides what a person sees at each point.
 *
 * NOTHING ENDS ON A SPINNER. Every exit from the run below is a verdict
 * screen, an unsaved verdict screen, or a named failure with one button. That
 * is feature 10's requirement, and `VISION_FAILURE` is what makes it a
 * compile error to add a failure with no way out of it.
 */

/**
 * The thinking state stays up for at least this long.
 *
 * A real read takes seconds, so this floor almost never applies to a success.
 * It applies to the fast failures: without it, an offline phone would flash
 * the overlay for 40 milliseconds and snap to an error, which reads as a
 * glitch rather than as the app having tried.
 */
const MIN_READING_MS = 1200;

/** What the screen is doing. It is in exactly one of these at a time. */
type Phase =
  | { readonly kind: 'idle' }
  /** A photo is in hand and the chain is running over it. */
  | { readonly kind: 'running'; readonly capture: Capture; readonly attempt: number }
  /** The chain gave way. The photo is kept, so a retry need not retake it. */
  | { readonly kind: 'failed'; readonly capture: Capture; readonly error: VisionErrorCode };

export function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const cameraRef = useRef<CameraView>(null);

  const reading = phase.kind === 'running';

  function begin(capture: Capture) {
    setPhase({ kind: 'running', capture, attempt: 0 });
  }

  /**
   * Resend the photo already taken.
   *
   * The attempt counter is not bookkeeping: it is the `key` on the run below,
   * so a retry mounts a fresh component rather than asking a finished one to
   * start again. The run guards itself against running twice, which is what
   * keeps a double tap from spending two Gemini calls, and a new key is the
   * only honest way past that guard.
   */
  function retry() {
    if (phase.kind !== 'failed') return;
    setPhase({ kind: 'running', capture: phase.capture, attempt: Date.now() });
  }

  async function onShutter() {
    if (reading) return;
    const shot = await cameraRef.current?.takePictureAsync({ quality: 1 });
    // Quality 1 here, because the downscale belongs to `prepare`, which is
    // sized by spec 0001. Letting the camera compress first would throw away
    // detail from a faded symbol before the step that budgets for it runs.
    if (shot === undefined) {
      // The shutter itself failed, which is rare and has no photo behind it,
      // so there is nothing to retry and the only honest recovery is another
      // shot. `photo_unreadable` already says exactly that.
      setPhase({
        kind: 'failed',
        capture: { uri: '', width: 0, height: 0 },
        error: 'photo_unreadable',
      });
      return;
    }
    begin({ uri: shot.uri, width: shot.width, height: shot.height });
  }

  async function onPickFromGallery() {
    if (reading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    begin({ uri: asset.uri, width: asset.width, height: asset.height });
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

  /*
   * A failure takes the whole screen rather than sitting over the viewfinder.
   * Three of these are deployment faults with a paragraph of explanation
   * behind them, and a caption floating over live video is the wrong place to
   * read one.
   */
  if (phase.kind === 'failed') {
    const failure = VISION_FAILURE[phase.error];
    return (
      <Screen>
        <AppHeader />
        <StateView
          icon={failure.recover === 'retake' ? 'camera-outline' : 'cloud-offline-outline'}
          title={failure.title}
          explanation={failure.explanation}
          action={{
            label: RECOVERY_LABEL[failure.recover],
            icon: failure.recover === 'retake' ? 'camera' : 'refresh',
            onPress: failure.recover === 'retake' ? () => setPhase({ kind: 'idle' }) : retry,
          }}
          secondaryAction={
            // Only where the photo is still worth keeping. After a retake
            // there is nothing to go back to, so offering it would be a button
            // that does nothing.
            failure.recover === 'retry'
              ? { label: 'Take a different photo', onPress: () => setPhase({ kind: 'idle' }) }
              : undefined
          }
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
         *
         * They are also load bearing beyond framing: the classifier centre
         * crops to a square before it scores, so an item outside these corners
         * is an item the second opinion never sees.
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

        {phase.kind === 'running' ? (
          <>
            <LoadingOverlay
              title="Reading the packaging..."
              detail="Checking material and local rules"
            />
            {/*
             * Keyed on the photo AND the attempt, so a new photo and a retry
             * of the same one both mount a fresh run. Rendered here rather
             * than above the camera because `usePreparedPhoto` takes its
             * capture at render time and so cannot be called before one
             * exists.
             */}
            <ScanRun
              key={`${phase.capture.uri}#${phase.attempt}`}
              capture={phase.capture}
              onSettled={() => setPhase({ kind: 'idle' })}
              onFailed={(error) => setPhase({ kind: 'failed', capture: phase.capture, error })}
            />
          </>
        ) : null}
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
            reading ? 'opacity-40' : 'active:opacity-85',
          )}
        >
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
 * One photo, all the way to a screen. Renders nothing.
 *
 * A component rather than a function, and not by choice: SDK 57 made the image
 * manipulator a hook, so the work can only start from inside something that
 * renders, and the hook takes its capture at render time. Mounting it is the
 * only way to begin.
 *
 * It calls exactly one of its two callbacks, exactly once. `onFailed` means
 * the chain gave way and the photo is still worth keeping; `onSettled` means
 * the screen has moved on and the camera should be idle behind it.
 */
function ScanRun({
  capture,
  onSettled,
  onFailed,
}: {
  capture: Capture;
  onSettled: () => void;
  onFailed: (error: VisionErrorCode) => void;
}) {
  const prepare = usePreparedPhoto(capture);
  const save = useScans((state) => state.save);

  /*
   * Runs exactly once per mount. A ref rather than a dependency list, because
   * the manipulator context is not promised to keep its identity between
   * renders, and a second run would spend another Gemini call and another
   * classifier call on a photo already in flight.
   */
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let live = true;
    const startedAt = Date.now();

    /** Hold the overlay up for its floor, then do the thing. */
    const settle = (go: () => void) => {
      const waited = Date.now() - startedAt;
      setTimeout(
        () => {
          if (live) go();
        },
        Math.max(0, MIN_READING_MS - waited),
      );
    };

    const run = async () => {
      const prepared = await prepare();
      if (!prepared.ok) {
        settle(() => onFailed(prepared.error));
        return;
      }

      // The one network call the app ever makes. Gemini reads the packaging
      // and the classifier reads the photograph beside it; both arrive here as
      // one validated `VisionRead`, and the second opinion is simply a field
      // on it that may or may not be there.
      const result = await readPackaging(prepared.photo);
      if (!result.ok) {
        settle(() => onFailed(result.error));
        return;
      }

      /*
       * The rules decide, not the models. Both of them are inputs to `decide`
       * and neither can reach a verdict on its own: the written gates run
       * first, then the classifier's disagreement, then the learned score, and
       * every one of those three can only ever answer "check manually".
       *
       * Pure and synchronous, so there is no failure to handle between here
       * and storage. A read always produces a verdict.
       */
      const verdict = decide(result.value);
      const learned = assess(result.value);

      const saved = await save({
        // What was SENT, not what the camera wrote. A saved scan has to show
        // the same pixels the verdict was read from.
        sourcePhotoUri: prepared.photo.uri,
        read: result.value,
        verdict,
        learned,
        ruleSet: { region: PUNE_RULES.region, version: PUNE_RULES.version },
      });

      settle(() => {
        /*
         * A storage failure must never swallow an answer. The store has
         * already put the finished scan in `pending`, so the unsaved route
         * shows it in full and says, in one line near the bottom, that it is
         * not in your history (spec 0007, AC-13).
         */
        if (isFailure(saved)) {
          router.push('/result/unsaved');
        } else {
          router.push({ pathname: '/result/[id]', params: { id: saved.value.id } });
        }
        // Reset the camera behind the result, so coming back lands on a
        // viewfinder rather than on a spinner for a scan already read.
        onSettled();
      });
    };

    void run();

    return () => {
      live = false;
    };
  }, [prepare, save, onFailed, onSettled]);

  return null;
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
      className="focus-ring items-center gap-2 w-[72px] rounded-tile active:opacity-85"
    >
      <IconTile icon={icon} size="md" variant={active ? 'accent' : 'soft'} />
      <Text className="text-label text-ink-soft text-center">{label}</Text>
    </Pressable>
  );
}
