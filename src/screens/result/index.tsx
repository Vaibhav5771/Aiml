import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { AppButton } from '@/components/app-button';
import { AttributeRow } from '@/components/attribute-row';
import { LinkButton } from '@/components/link-button';
import { NoteRow } from '@/components/note-row';
import { RuleCard } from '@/components/rule-card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SectionLabel } from '@/components/section-label';
import { VerdictCard } from '@/components/verdict-card';
import { colors } from '@/theme';
import { Image, ScrollView, Text, View } from '@/tw';
import { getMockScan } from '@/vision/mock';
import { ATTRIBUTE_ORDER } from '@/vision/types';

/**
 * The verdict screen. The answer, then what it saw, then the rule that turned
 * one into the other.
 *
 * The scan is mock data for now; feature 7 swaps `getMockScan` for a real read
 * without this layout changing. Feature 9 owns the screen itself and will
 * revisit the copy and the hand drawn header.
 */
export function ResultScreen() {
  const { id, photo } = useLocalSearchParams<{ id: string; photo?: string }>();
  const scan = getMockScan(id, photo || undefined);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Result" />

      <ScrollView
        contentContainerClassName="p-4 pb-8 gap-6"
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-2">
          {scan.photoUri ? (
            <Image
              source={{ uri: scan.photoUri }}
              accessibilityIgnoresInvertColors
              alt={`The photo you took of ${scan.itemName}`}
              className="w-[48px] h-[48px] rounded-thumb bg-card object-cover"
            />
          ) : (
            <View className="w-[48px] h-[48px] rounded-thumb bg-card border border-hairline items-center justify-center">
              <Ionicons
                name="image-outline"
                size={18}
                color={colors.inkSoft}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </View>
          )}

          <View className="flex-1 gap-1">
            <Text className="text-label text-ink-soft">Scanned item</Text>
            <Text className="text-body font-semibold text-ink">{scan.itemName}</Text>
          </View>

          <LinkButton label="Retake" onPress={() => router.back()} className="-mr-3" />
        </View>

        <VerdictCard
          verdict={scan.verdict}
          action={scan.action}
          confidence={scan.confidence}
        />

        <View className="gap-2">
          <SectionLabel>What I saw</SectionLabel>
          <View className="gap-2">
            {/* The order is the app's, not the wire's: attributes arrive as an
                object and objects carry no order. */}
            {ATTRIBUTE_ORDER.map((key) => (
              <AttributeRow key={key} attributeKey={key} attribute={scan.attributes[key]} />
            ))}
          </View>
        </View>

        <View className="gap-2">
          <SectionLabel>The rule I applied</SectionLabel>
          <RuleCard rule={scan.rule} />
        </View>

        {scan.note ? <NoteRow>{scan.note}</NoteRow> : null}

        <View className="flex-row gap-2">
          <AppButton label="Scan another" icon="camera" onPress={() => router.back()} />
          <AppButton
            label="Save to history"
            icon="time-outline"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
