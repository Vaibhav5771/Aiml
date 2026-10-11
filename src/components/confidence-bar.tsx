import { cn } from '@/tw/cn';
import { View } from '@/tw';
import type { ConfidenceBand } from '@/vision/types';

const BAND_FRACTION: Record<ConfidenceBand, number> = { high: 1, medium: 0.6, low: 0.3 };

/**
 * How a confidence should be coloured.
 *
 * `neutral` is the default and it is the important one. Before this prop
 * existed the bar and the number were always green, so a 38% read rendered as
 * reassuringly green and quietly claimed a confidence the attribute did not
 * support. Nothing on screen may claim more certainty than the attributes
 * support, so the default says nothing rather than something false.
 *
 * The thresholds that turn a number into one of the other three tones belong
 * to feature 4, which owns the point where the app stops trusting a read.
 */
export type ConfidenceTone = 'neutral' | 'ok' | 'caution' | 'poor';

const FILL: Record<ConfidenceTone, string> = {
  neutral: 'bg-ink',
  ok: 'bg-verdict-ok',
  caution: 'bg-verdict-maybe',
  poor: 'bg-verdict-no',
};

export const CONFIDENCE_TEXT_TONE: Record<ConfidenceTone, string> = {
  neutral: 'text-ink',
  ok: 'text-verdict-ok',
  caution: 'text-verdict-maybe',
  poor: 'text-verdict-no',
};

/**
 * How full the bar is, 0 to 1.
 *
 * Three widths, not a hundred. The percent path that used to live here is
 * gone: spec 0003 keeps the score off the wire shape screens read, because a
 * number like "88%" claims a precision nothing has measured.
 */
export function confidenceFraction(band: ConfidenceBand): number {
  return BAND_FRACTION[band];
}

/** What the word reads as on the right of the row. */
export function confidenceText(band: ConfidenceBand): string {
  return band.toUpperCase();
}

/**
 * A thin bar under an attribute.
 *
 * Deliberately quiet: it supports the value rather than competing with it, and
 * it is never the only way a confidence is shown, because the number sits
 * beside it in text.
 */
export function ConfidenceBar({
  confidence,
  tone = 'neutral',
  className,
}: {
  confidence: ConfidenceBand;
  tone?: ConfidenceTone;
  className?: string;
}) {
  const fraction = Math.max(0, Math.min(1, confidenceFraction(confidence)));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn('h-[3px] rounded-bar bg-track overflow-hidden', className)}>
      <View
        className={cn('h-[3px] rounded-bar', FILL[tone])}
        style={{ width: `${fraction * 100}%` }}
      />
    </View>
  );
}
