/**
 * THROWAWAY. Feature 5 scaffolding, and nothing else.
 *
 * This screen exists to prove one thing on a real device: that a scan can be
 * saved, listed, reopened and deleted (spec 0006, AC-1, AC-2, AC-3, AC-9,
 * AC-12). It is not designed, it is not in the navigation, and no user is ever
 * meant to see it.
 *
 * **Feature 11 (Scan history list) deletes this file**, along with the dev
 * entry point on the Scan screen that reaches it. If you are reading this
 * while building feature 11, that is your cue.
 *
 * It drives the real pipeline rather than a stub: the sample reads go through
 * the real `decide()` and `assess()` in `src/rules/`, so what lands in the
 * database is exactly what a real scan would write, minus the camera and the
 * proxy.
 */

import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SectionLabel } from '@/components/section-label';
import { isFailure } from '@/db';
import { PUNE_RULES, assess, decide } from '@/rules';
import { useScans } from '@/store/scans';
import { Pressable, ScrollView, Text, View } from '@/tw';
import type { Scan, VisionRead } from '@/vision/types';

/**
 * Three reads that land on different rules, so the list is not three copies of
 * one row and the verdict column actually varies.
 */
const SAMPLES: readonly VisionRead[] = [
  {
    itemName: 'Yogurt tub',
    attributes: {
      material: { code: 'pp', display: 'Polypropylene, code 5', confidence: 'high', score: 91 },
      form: { code: 'rigid', display: 'Rigid, holds its shape', confidence: 'high', score: 88 },
      recyclingSymbol: {
        code: 'faded',
        display: 'Found, partly faded',
        confidence: 'medium',
        score: 64,
      },
      construction: {
        code: 'single_material',
        display: 'Single material',
        confidence: 'high',
        score: 86,
      },
      contamination: {
        code: 'light_residue',
        display: 'A little yogurt left inside',
        confidence: 'medium',
        score: 59,
      },
      photoQuality: { code: 'good', display: 'Sharp and well lit', confidence: 'high', score: 93 },
    },
  },
  {
    itemName: 'Snack pouch',
    attributes: {
      material: {
        code: 'composite_laminate',
        display: 'Foil and plastic bonded together',
        confidence: 'medium',
        score: 68,
      },
      form: { code: 'film', display: 'Thin and flexible', confidence: 'high', score: 84 },
      recyclingSymbol: {
        code: 'absent',
        display: 'Looked, and there is none',
        confidence: 'high',
        score: 81,
      },
      construction: {
        code: 'multi_material',
        display: 'Two materials joined',
        confidence: 'high',
        score: 87,
      },
      contamination: {
        code: 'clean',
        display: 'Looks empty and dry',
        confidence: 'medium',
        score: 61,
      },
      photoQuality: { code: 'fair', display: 'A little soft', confidence: 'high', score: 72 },
    },
  },
  {
    itemName: 'Jam jar',
    attributes: {
      material: { code: 'glass', display: 'Clear glass', confidence: 'high', score: 94 },
      form: { code: 'rigid', display: 'Rigid, holds its shape', confidence: 'high', score: 92 },
      recyclingSymbol: {
        code: 'readable',
        display: 'Found and readable',
        confidence: 'high',
        score: 89,
      },
      construction: {
        code: 'single_material',
        display: 'Single material',
        confidence: 'high',
        score: 90,
      },
      contamination: { code: 'clean', display: 'Rinsed out', confidence: 'high', score: 85 },
      photoQuality: { code: 'good', display: 'Sharp and well lit', confidence: 'high', score: 95 },
    },
  },
];

/**
 * A stand in for the downscaled JPEG feature 8 will hand `saveScan`.
 *
 * It is a real file in the cache directory, not a fake path, because the point
 * is to exercise the actual copy into app storage. Its contents are not a JPEG
 * and nothing tries to decode them: the image will not render, and that is
 * expected here.
 */
function seedPhoto(): string {
  const file = new File(Paths.cache, `dev-seed-${Date.now()}.jpg`);
  if (file.exists) file.delete();
  file.create();
  file.write('feature 5 scaffolding, not a real JPEG');
  return file.uri;
}

export default function DevDataScreen() {
  const { summaries, loading, error, refresh, save, open, remove } = useScans();
  const [message, setMessage] = useState('Seed a scan to begin.');
  const [opened, setOpened] = useState<Scan | undefined>(undefined);
  const [seeded, setSeeded] = useState(0);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSeed() {
    const read = SAMPLES[seeded % SAMPLES.length];
    setSeeded((n) => n + 1);

    const result = await save({
      sourcePhotoUri: seedPhoto(),
      read,
      verdict: decide(read),
      learned: assess(read),
      ruleSet: { region: PUNE_RULES.region, version: PUNE_RULES.version },
    });

    setMessage(
      isFailure(result)
        ? `Save failed: ${result.error}`
        : `Saved ${read.itemName} as ${result.value.verdict}, rule ${result.value.rule.id}`,
    );
  }

  async function onOpen(id: string) {
    const result = await open(id);
    if (isFailure(result)) {
      setOpened(undefined);
      setMessage(`Open failed: ${result.error}`);
      return;
    }
    setOpened(result.value);
    setMessage(`Reopened ${result.value.itemName}`);
  }

  async function onRemove(id: string) {
    const result = await remove(id);
    if (opened?.id === id) setOpened(undefined);
    setMessage(isFailure(result) ? `Delete reported ${result.error}` : 'Deleted, row and photo');
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Dev: data layer" />

      <ScrollView contentContainerClassName="p-4 pb-8 gap-6" showsVerticalScrollIndicator={false}>
        <Text className="text-label text-ink-soft">
          Feature 5 scaffolding. Feature 11 deletes this screen.
        </Text>

        <View className="flex-row gap-2">
          <AppButton label="Seed a scan" icon="add" onPress={onSeed} />
          <AppButton label="Refresh" icon="refresh" variant="secondary" onPress={refresh} />
        </View>

        <View className="gap-2">
          <SectionLabel>What happened</SectionLabel>
          <Text className="text-body text-ink">{message}</Text>
          {error ? <Text className="text-body text-ink-soft">Store error: {error}</Text> : null}
        </View>

        <View className="gap-2">
          <SectionLabel>{`Stored scans (${summaries.length})`}</SectionLabel>

          {loading ? <Text className="text-label text-ink-soft">Reading...</Text> : null}

          {summaries.length === 0 && !loading ? (
            <Text className="text-label text-ink-soft">
              Nothing stored. Seed one, then close and reopen the app to prove it survived.
            </Text>
          ) : null}

          {summaries.map((summary) => (
            <View
              key={summary.id}
              className="flex-row items-center gap-2 p-3 rounded-tile border border-hairline bg-card"
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reopen ${summary.itemName}`}
                onPress={() => onOpen(summary.id)}
                className="focus-ring flex-1 gap-1 active:opacity-85"
              >
                <Text className="text-body font-semibold text-ink">{summary.itemName}</Text>
                <Text className="text-label text-ink-soft">
                  {`${summary.verdict} · ${summary.confidence}% · ${summary.scannedAt}`}
                </Text>
              </Pressable>

              <AppButton label="Delete" variant="secondary" onPress={() => onRemove(summary.id)} />
            </View>
          ))}
        </View>

        {opened ? (
          <View className="gap-2">
            <SectionLabel>Reopened at full fidelity</SectionLabel>
            <Text className="text-label text-ink-soft">
              {`rule ${opened.rule.id} · ${opened.region} ${opened.ruleSetVersion} · model ${opened.modelVersion}`}
            </Text>
            <Text className="text-label text-ink-soft">
              {`${Object.keys(opened.attributes).length} attributes · ${opened.rule.source.document}`}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
