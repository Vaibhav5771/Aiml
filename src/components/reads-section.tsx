import { useEffect, useState } from 'react';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';

import { cn } from '@/tw/cn';
import { Pressable, Text, View } from '@/tw';
import {
  ATTRIBUTE_ORDER,
  type AttributeKey,
  type ConfidenceBand,
  type StoredDisplayAttributes,
} from '@/vision/types';

import { AttributeRow } from './attribute-row';
import type { ConfidenceTone } from './confidence-bar';
import { SectionLabel } from './section-label';

/**
 * How sure a promoted read is, as a colour.
 *
 * Only ever applied to a read the rule actually leaned on. Every other row
 * stays neutral, because a tone on a read that decided nothing would be
 * colouring in a number the answer never rested on (spec 0007, invariant 1).
 */
const TONE: Record<ConfidenceBand, ConfidenceTone> = {
  high: 'ok',
  medium: 'caution',
  low: 'poor',
};

/** Matches `--duration-base` in `src/global.css`: something entering or leaving. */
const DISCLOSURE_MS = 250;

/**
 * Whether the phone asks for less movement.
 *
 * Local to this file because the disclosure is the only thing in the app that
 * animates today. A second caller is when it earns a home in a shared hook; a
 * primitive invented ahead of its first caller is a guess.
 */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduce(on);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}

/**
 * Everything the app saw, with the reads that decided the answer open and the
 * rest one tap away.
 *
 * This is the most arguable call in spec 0007 and it is worth naming: five of
 * six reads start hidden on a product whose whole pitch is showing its
 * working. What makes it defensible is the promotion rule, not the disclosure.
 * The rows that decided the answer are never the hidden ones, so the reasoning
 * is always in front of you and only the reads that changed nothing are folded
 * away (AC-4).
 *
 * `decidedOn` is empty for the learned gate, for the no match rule, and for a
 * scan saved before the column existed. All three genuinely rested on no
 * single read, so there is nothing to promote and all six open instead.
 */
export function ReadsSection({
  attributes,
  decidedOn,
  className,
}: {
  attributes: StoredDisplayAttributes;
  decidedOn: readonly AttributeKey[];
  className?: string;
}) {
  // Already in the app's reading order, by `decidedOnFrom` in the engine and
  // by `readDecidedOn` on the way out of storage, so neither list needs sorting.
  const promoted = decidedOn;
  const rest = ATTRIBUTE_ORDER.filter((key) => !decidedOn.includes(key));
  const nothingPromoted = promoted.length === 0;

  const [expanded, setExpanded] = useState(nothingPromoted);
  const reduceMotion = useReduceMotion();

  const toggle = () => {
    if (!reduceMotion) {
      // The rows mount and unmount, so this is a layout change rather than a
      // style transition, and CSS cannot reach it. Honouring reduce motion is
      // the reason it is a branch rather than always on.
      LayoutAnimation.configureNext({
        duration: DISCLOSURE_MS,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'easeInEaseOut' },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
    }
    setExpanded((open) => !open);
  };

  const noun = rest.length === 1 ? 'read' : 'reads';
  const label = expanded ? `Hide ${rest.length} ${noun}` : `Show ${rest.length} more ${noun}`;

  const row = (key: AttributeKey, toned: boolean) => {
    const attribute = attributes[key];
    return (
      <AttributeRow
        key={key}
        attributeKey={key}
        attribute={attribute}
        // A missing read has no band to tone, and a read the rule did not lean
        // on has not earned one.
        tone={toned && attribute !== undefined ? TONE[attribute.confidence] : 'neutral'}
      />
    );
  };

  return (
    <View className={cn('gap-2', className)}>
      <SectionLabel className="font-inter text-auth-ink-soft">
        {nothingPromoted ? 'What I saw' : 'What the answer rested on'}
      </SectionLabel>

      <View className="gap-2">
        {promoted.map((key) => row(key, true))}

        {expanded ? rest.map((key) => row(key, false)) : null}

        {rest.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            // AC-14: the control says whether it is open, so someone using a
            // screen reader knows there is more here and whether it is showing.
            accessibilityState={{ expanded }}
            onPress={toggle}
            className="focus-ring min-h-[48px] justify-center items-center px-3 rounded-tile active:opacity-60"
          >
            <Text className="text-body font-inter-bold text-auth-link">{label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
