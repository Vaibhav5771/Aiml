import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';
import type { SourceScope } from '@/vision/types';

/**
 * How far the cited document's authority actually reaches.
 *
 * Load bearing, not decoration. The source check behind spec 0004 could not
 * load a single quotable Pune document, so most rules in this build rest on
 * the national Rules instead. Without this chip a national rule reads on
 * screen exactly like a municipal one, and someone in Pune would reasonably
 * take it as their council's word (spec 0007, AC-6).
 *
 * `model` is deliberately worded as a measurement rather than a rule. A
 * learned refusal rests on the team's own numbers and on no published
 * document at all, and it may never read as law.
 */
const SCOPE_LABEL: Record<SourceScope, string> = {
  pune: 'Pune rule',
  maharashtra: 'Maharashtra rule',
  national: 'National rule',
  general: 'General practice',
  model: 'Our own measurement',
};

/**
 * A quiet chip, on purpose.
 *
 * It qualifies the citation beside it rather than competing with it, so it
 * takes no verdict colour and no accent: white on the grey card, the same
 * quiet treatment `IconTile`'s `quiet` variant uses and for the same reason.
 * Nothing here needed a new token.
 */
export function ScopeChip({ scope, className }: { scope: SourceScope; className?: string }) {
  return (
    <View
      className={cn(
        'self-start shrink border border-hairline rounded-button px-3 py-1 bg-background',
        className,
      )}
    >
      <Text className="text-label font-medium text-ink-soft">{SCOPE_LABEL[scope]}</Text>
    </View>
  );
}
