import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { AppButton } from '@/components/app-button';
import { IconTile } from '@/components/icon-tile';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { VERDICT } from '@/components/verdict';
import { useScans } from '@/store/scans';
import { cn } from '@/tw/cn';
import { Pressable, ScrollView, Text, View } from '@/tw';
import type { VerdictKind } from '@/vision/types';

type IconName = React.ComponentProps<typeof IconTile>['icon'];

type Category = {
  readonly label: string;
  readonly caption: string;
  readonly icon: IconName;
};

/**
 * The material groups `src/vision/types.ts` actually recognises, collapsed
 * from its fourteen material codes to the four families a reader thinks in.
 * Deliberately not the reference mock's four (which included "Organic",
 * a material this app has no code for and no rule to decide): showing a
 * category Recyclens cannot read would be a claim it has no way to back.
 */
const CATEGORIES: readonly Category[] = [
  { label: 'Plastic', caption: 'PET, HDPE, PP and the rest', icon: 'flask-outline' },
  { label: 'Paper', caption: 'Paper and cardboard', icon: 'newspaper-outline' },
  { label: 'Glass', caption: 'Bottles and jars', icon: 'wine-outline' },
  { label: 'Metal', caption: 'Aluminium and steel', icon: 'magnet-outline' },
];

type Tip = {
  readonly title: string;
  readonly body: string;
  readonly icon: IconName;
};

/**
 * Each tip names a real gate from `src/rules/pune.json` rather than generic
 * eco advice, so this section stays honest about what actually changes a
 * verdict instead of reading like stock copy.
 */
const TIPS: readonly Tip[] = [
  {
    title: 'Rinse before you scan',
    body: 'Heavy food or liquid residue is its own stop rule: a soiled item is sent back to be cleaned before anything else is decided.',
    icon: 'water-outline',
  },
  {
    title: 'Separate multi-material packaging',
    body: "A chip packet's foil lining and plastic film have to be recycled apart, so a joined item is held back until you split it.",
    icon: 'layers-outline',
  },
  {
    title: 'A faded symbol means check manually',
    body: 'Recyclens would rather ask you to look again than guess from a recycling symbol it cannot actually read.',
    icon: 'help-circle-outline',
  },
];

/**
 * Home: a landing read on what Recyclens recognises and what you have
 * logged, with Scan one tap away.
 *
 * Every number here comes from a scan genuinely saved on the device, read
 * through the same `useScans` store the History tab uses. There is no
 * invented metric standing in for data this app does not compute, the way a
 * CO2 estimate or a points score would. Home carries the same warm brand
 * treatment as welcome and authentication, while verdict colours stay semantic.
 */
export function HomeScreen() {
  const summaries = useScans((state) => state.summaries);
  const refresh = useScans((state) => state.refresh);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const countOf = (verdict: VerdictKind) =>
    summaries.filter((summary) => summary.verdict === verdict).length;

  return (
    <Screen className="bg-auth-background">
      <ScrollView contentContainerClassName="p-4 pb-8 gap-6" showsVerticalScrollIndicator={false}>
        <View className="gap-1">
          <Text accessibilityRole="header" className="text-title font-display text-auth-ink">
            Home
          </Text>
          <Text className="text-body font-inter text-auth-ink-soft">
            Scan a piece of packaging and read the reasoning behind the answer.
          </Text>
        </View>

        <View className="flex-row bg-auth-surface border border-auth-hairline rounded-card">
          <StatTile label="Scans" value={summaries.length} />
          <View className="w-px my-3 bg-auth-hairline" />
          <StatTile
            label={VERDICT.recyclable.word}
            value={countOf('recyclable')}
            tone={VERDICT.recyclable.tone}
          />
          <View className="w-px my-3 bg-auth-hairline" />
          <StatTile
            label={VERDICT.checkManually.word}
            value={countOf('checkManually')}
            tone={VERDICT.checkManually.tone}
          />
        </View>

        <View className="gap-3">
          <SectionLabel>What Recyclens reads</SectionLabel>
          <View className="gap-3">
            <View className="flex-row gap-3">
              <CategoryCard category={CATEGORIES[0]} />
              <CategoryCard category={CATEGORIES[1]} />
            </View>
            <View className="flex-row gap-3">
              <CategoryCard category={CATEGORIES[2]} />
              <CategoryCard category={CATEGORIES[3]} />
            </View>
          </View>
        </View>

        <View className="gap-3">
          <SectionLabel>Good to know</SectionLabel>
          <View className="gap-2">
            {TIPS.map((tip) => (
              <TipRow key={tip.title} tip={tip} />
            ))}
          </View>
        </View>

        <AppButton
          label="Scan something"
          icon="scan"
          tone="auth"
          onPress={() => router.navigate('/')}
        />
      </ScrollView>
    </Screen>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <View className="flex-1 items-center gap-1 p-3">
      <Text className={cn('text-title font-inter-bold', tone ?? 'text-auth-ink')}>{value}</Text>
      <Text className="text-label font-inter text-auth-ink-soft text-center">{label}</Text>
    </View>
  );
}

function CategoryCard({ category }: { category: Category }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Scan a ${category.label.toLowerCase()} item`}
      onPress={() => router.navigate('/')}
      className="focus-ring flex-1 flex-row items-center gap-3 p-3 rounded-card border border-auth-hairline bg-auth-surface active:opacity-85"
    >
      <IconTile icon={category.icon} variant="soft" />
      <View className="flex-1 gap-1">
        <Text className="text-body font-inter-bold text-auth-ink">{category.label}</Text>
        <Text className="text-label font-inter text-auth-ink-soft">{category.caption}</Text>
      </View>
    </Pressable>
  );
}

function TipRow({ tip }: { tip: Tip }) {
  return (
    <View className="flex-row gap-3 p-4 rounded-card border border-auth-hairline bg-auth-surface">
      <IconTile icon={tip.icon} variant="soft" />
      <View className="flex-1 gap-1">
        <Text className="text-body font-inter-bold text-auth-ink">{tip.title}</Text>
        <Text className="text-label font-inter text-auth-ink-soft">{tip.body}</Text>
      </View>
    </View>
  );
}
