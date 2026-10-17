import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';
import { ATTRIBUTE_LABEL, type AttributeKey, type DisplayAttribute } from '@/vision/types';

import {
  CONFIDENCE_TEXT_TONE,
  ConfidenceBar,
  confidenceText,
  type ConfidenceTone,
} from './confidence-bar';
import { IconTile } from './icon-tile';

type IconName = React.ComponentProps<typeof IconTile>['icon'];

/** One icon per observation, so the rows are scannable without reading them. */
const ICONS: Record<AttributeKey, IconName> = {
  material: 'leaf-outline',
  form: 'cube-outline',
  recyclingSymbol: 'search-outline',
  construction: 'layers-outline',
  contamination: 'water-outline',
  photoQuality: 'camera-outline',
};

/**
 * One line of what the app saw: an icon, the caption, the read, and how sure
 * it is, as a word and as a bar.
 *
 * The attribute is typed as `DisplayAttribute`, which has no `score` field, so
 * this component cannot print the raw number even by accident. Spec 0003 makes
 * that a compiler error rather than a written rule. The caption and the icon
 * come from the key, not the wire, because sending six constant strings per
 * scan buys nothing.
 *
 * `tone` defaults to neutral so the word never renders green by default. Only
 * a read the rule actually leaned on earns a tone, which the reads section
 * decides; see `confidence-bar.tsx` for why the default matters.
 *
 * An ABSENT attribute is a real state, not a missing prop. A scan saved before
 * an attribute existed genuinely has no reading for it (spec 0006), and the
 * screen used to skip the row entirely, which quietly showed a five row scan
 * as though six had been read. The row now says it was not recorded: no value,
 * no confidence word and no bar, because there is nothing to be confident
 * about (spec 0007, AC-5).
 */
export function AttributeRow({
  attributeKey,
  attribute,
  tone = 'neutral',
  className,
}: {
  attributeKey: AttributeKey;
  attribute?: DisplayAttribute<string>;
  tone?: ConfidenceTone;
  className?: string;
}) {
  return (
    <View
      className={cn(
        'bg-auth-surface border border-auth-hairline rounded-card p-4 gap-2',
        className,
      )}
    >
      <View className="flex-row items-start gap-2">
        <IconTile icon={ICONS[attributeKey]} />

        <View className="flex-1 gap-1">
          <Text className="text-label font-inter text-auth-ink-soft">
            {ATTRIBUTE_LABEL[attributeKey]}
          </Text>
          {attribute === undefined ? (
            <Text className="text-body font-inter text-auth-ink-soft">Not recorded</Text>
          ) : (
            <Text className="text-body font-inter-bold text-auth-ink">{attribute.display}</Text>
          )}
        </View>

        {attribute === undefined ? null : (
          <Text className={cn('text-label font-inter-bold', CONFIDENCE_TEXT_TONE[tone])}>
            {confidenceText(attribute.confidence)}
          </Text>
        )}
      </View>

      {attribute === undefined ? null : (
        <ConfidenceBar confidence={attribute.confidence} tone={tone} />
      )}
    </View>
  );
}
