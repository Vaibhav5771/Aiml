/**
 * THROWAWAY. Feature 7 scaffolding, and nothing else.
 *
 * This screen exists to prove one thing on a real device: that a photo taken
 * here reaches your deployed proxy and comes back as six named observations
 * the rule engine can decide on. It is not designed, it is not in the
 * navigation, and no user is ever meant to see it.
 *
 * **Feature 8 (Capture a photo) deletes this file**, along with the dev entry
 * point on the Scan screen that reaches it. By then the same four stages run
 * inside the real capture flow, and `src/vision/prepare.ts` and
 * `src/vision/client.ts` are the parts that survive. If you are reading this
 * while building feature 8, that is your cue.
 *
 * It reports each stage separately on purpose. When the chain fails, the thing
 * you need to know first is which link gave way: the photo never got prepared,
 * the request never arrived, the answer did not match the contract, or the
 * rules could not decide. One combined "it did not work" would send you
 * looking in the wrong place.
 */

import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SectionLabel } from '@/components/section-label';
import { PROXY_URL } from '@/constants';
import { decide } from '@/rules';
import { ScrollView, Text, View } from '@/tw';
import { readPackaging } from '@/vision/client';
import { VISION_ERROR_TEXT } from '@/vision/errors';
import { usePreparedPhoto } from '@/vision/prepare';
import type { Capture } from '@/vision/prepare';
import { ATTRIBUTE_LABEL, ATTRIBUTE_ORDER } from '@/vision/types';
import type { VisionRead } from '@/vision/types';

type Stage = {
  readonly label: string;
  readonly detail: string;
  readonly ok: boolean;
};

/** An asset from either picker, narrowed to what a `Capture` needs. */
function toCapture(asset: ImagePicker.ImagePickerAsset): Capture {
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/**
 * One run of the whole chain, from a capture to a verdict.
 *
 * A child component rather than part of the screen, because
 * `usePreparedPhoto` takes the capture at render and so cannot be called
 * before one exists. Mounted with a `key` of the photo's uri, so every new
 * capture is a fresh run rather than a second pass over stale state.
 */
function ChainRun({ capture }: { capture: Capture }) {
  const prepare = usePreparedPhoto(capture);
  const [stages, setStages] = useState<readonly Stage[]>([]);
  const [read, setRead] = useState<VisionRead | undefined>(undefined);
  const [running, setRunning] = useState(true);

  /*
   * Runs exactly once per mount. The guard is a ref rather than a dependency
   * list because the manipulator context is not promised to keep its identity
   * between renders, and a re-run would spend your Gemini quota twice on one
   * photo.
   */
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let live = true;
    const add = (stage: Stage) => {
      if (live) setStages((all) => [...all, stage]);
    };

    const run = async () => {
      add({
        label: 'Captured',
        detail: `${capture.width} by ${capture.height}`,
        ok: true,
      });

      const prepared = await prepare();
      if (!prepared.ok) {
        add({ label: 'Prepared', detail: VISION_ERROR_TEXT[prepared.error], ok: false });
        return;
      }
      // Base64 runs about a third larger than the bytes it encodes, which is
      // the same honest naming spec 0003 asked the proxy's log for.
      const kb = Math.round(prepared.photo.base64.length / 1024);
      add({ label: 'Prepared', detail: `${kb} KB of base64 JPEG`, ok: true });

      const result = await readPackaging(prepared.photo);
      if (!result.ok) {
        add({
          label: 'Read',
          detail: `${result.error}: ${VISION_ERROR_TEXT[result.error]}`,
          ok: false,
        });
        return;
      }
      add({ label: 'Read', detail: result.value.itemName, ok: true });
      if (live) setRead(result.value);

      const verdict = decide(result.value);
      add({
        label: 'Decided',
        detail: `${verdict.verdict}, ${verdict.confidence}%, by ${verdict.rule.id}`,
        ok: true,
      });
      add({ label: 'Action', detail: verdict.action, ok: true });
      add({ label: 'Cited', detail: verdict.rule.source.document, ok: true });
    };

    run().finally(() => {
      if (live) setRunning(false);
    });

    return () => {
      live = false;
    };
  }, [capture, prepare]);

  return (
    <View className="gap-6">
      <View className="gap-2">
        <SectionLabel>The chain</SectionLabel>

        {stages.map((stage) => (
          <View key={stage.label} className="gap-1 p-3 rounded-tile border border-hairline bg-card">
            <Text className="text-label text-ink-soft">
              {stage.ok ? stage.label : `${stage.label}, failed`}
            </Text>
            <Text className="text-body text-ink">{stage.detail}</Text>
          </View>
        ))}

        {running ? <Text className="text-label text-ink-soft">Working...</Text> : null}
      </View>

      {read ? (
        <View className="gap-2">
          <SectionLabel>The six, raw</SectionLabel>
          {ATTRIBUTE_ORDER.map((key) => {
            const attribute = read.attributes[key];
            return (
              <Text key={key} className="text-label text-ink-soft">
                {`${ATTRIBUTE_LABEL[key]}: ${attribute.code}, ${attribute.confidence}, ${attribute.score}`}
              </Text>
            );
          })}
          {read.note ? <Text className="text-label text-ink-soft">{read.note}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

export default function DevScan() {
  const [capture, setCapture] = useState<Capture | undefined>(undefined);
  const [message, setMessage] = useState('Take or pick a photo to run the whole chain.');

  const begin = async (launch: () => Promise<ImagePicker.ImagePickerResult>) => {
    const result = await launch();
    if (result.canceled || !result.assets[0]) {
      setMessage('Cancelled, nothing was sent.');
      return;
    }
    setMessage('');
    setCapture(toCapture(result.assets[0]));
  };

  /*
   * The system camera rather than the `CameraView` the Scan screen draws. This
   * screen is about the pipeline behind the shutter, and borrowing the system
   * one keeps it from duplicating a camera UI that feature 8 is about to own.
   */
  const onCamera = () => begin(() => ImagePicker.launchCameraAsync({ quality: 1 }));

  const onGallery = () =>
    begin(() => ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }));

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Dev: the chain" />

      <ScrollView contentContainerClassName="p-4 pb-8 gap-6" showsVerticalScrollIndicator={false}>
        <Text className="text-label text-ink-soft">
          Feature 7 scaffolding. Feature 8 deletes this screen.
        </Text>

        {/*
         * Worth saying out loud rather than letting it surface as a failure
         * four stages later. An unset proxy URL is the one problem here that
         * is fixed in `.env` and not in the code.
         */}
        <View className="gap-2">
          <SectionLabel>Proxy</SectionLabel>
          <Text className="text-body text-ink">
            {PROXY_URL.length === 0 ? 'EXPO_PUBLIC_PROXY_URL is not set' : PROXY_URL}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <AppButton label="Take a photo" icon="camera" onPress={onCamera} />
          <AppButton
            label="Pick one"
            icon="images-outline"
            variant="secondary"
            onPress={onGallery}
          />
        </View>

        {message.length > 0 ? <Text className="text-body text-ink">{message}</Text> : null}

        {/* Quality 1 above, because the downscale belongs to `prepare`, which
            is the step being proved. Letting the picker shrink it first would
            hide whether that step works. */}
        {capture ? <ChainRun key={capture.uri} capture={capture} /> : null}
      </ScrollView>
    </Screen>
  );
}
