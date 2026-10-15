import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Pressable, Text, View } from '@/tw';
import type { AppliedRule } from '@/vision/types';

import { IconTile } from './icon-tile';
import { ScopeChip } from './scope-chip';

/**
 * Open a citation without leaving the app.
 *
 * `createTask: false` is what makes "without leaving" true, and it is the
 * whole reason this call carries options. On its default of `true` the module
 * launches the browser through a proxy activity with a different task
 * affinity, so the tab lands in a task of its own. Closing it then returns to
 * whichever task sits on top rather than to this screen, which under Expo Go
 * is Expo Go's own home. `false` launches the tab in this app's task, so
 * closing it comes straight back to the verdict (AC-7).
 *
 * On Android the result is always `{ type: 'opened' }` and the system back
 * button is what returns here, so there is nothing to await for and no
 * dismissal to handle.
 *
 * A failure here is a device with no browser at all. The citation stays on
 * screen as it was, which is the honest outcome: the document name is still
 * readable, it just cannot be opened. Nothing is thrown at the screen, which
 * is the convention `AGENTS.md` sets for an expected failure.
 */
async function openCitation(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, { createTask: false });
  } catch (error) {
    if (__DEV__) console.warn('[rule-card] could not open the citation', error);
  }
}

/**
 * The rule that turned the observations into the verdict, with the source it
 * came from.
 *
 * This card is why the product is defensible rather than a guess, so it gets
 * real room on the screen instead of being a footnote under the verdict.
 *
 * Spec 0004 left feature 9 two questions and spec 0007 answered both. A
 * citation with a url IS tappable, because a source you cannot open is a
 * source you have to take on trust, which is the opposite of the point. And a
 * national citation DOES look different from a Pune one: the scope chip says
 * so, because most rules in this build rest on the national Rules and letting
 * one read as a municipal rule would be the kind of quiet overclaim this
 * screen exists to avoid.
 *
 * A citation with no url stays plain text. A missing url means the page was
 * never confirmed to load (spec 0004, AC-3), so making it tappable would
 * promise a document that may not be there.
 */
export function RuleCard({ rule, className }: { rule: AppliedRule; className?: string }) {
  const { document, url, scope } = rule.source;

  return (
    <View
      className={cn(
        'flex-row gap-2 bg-card border border-hairline border-l-4 border-l-accent rounded-card p-4',
        className,
      )}
    >
      <IconTile icon="reader-outline" />

      <View className="flex-1 gap-2">
        <Text className="text-body text-ink">{rule.text}</Text>

        {url === undefined ? (
          /* The citation reads as a source, so it takes the accent. 5.44:1. */
          <Text className="text-label font-semibold text-accent">{document}</Text>
        ) : (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${document}`}
            accessibilityHint="Opens the document in a browser inside the app"
            onPress={() => void openCitation(url)}
            // 48dp tall, so the one control that makes this product checkable
            // is not the one thing on screen too small to hit.
            className="focus-ring min-h-[48px] justify-center rounded-tile active:opacity-60"
          >
            <View className="flex-row items-center gap-1">
              <Text className="flex-1 text-label font-semibold text-accent">{document}</Text>
              <Ionicons
                name="open-outline"
                size={14}
                color={colors.accent}
                // The label already says it opens. An icon saying so again is noise.
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </View>
          </Pressable>
        )}

        {/*
         * Absent only on a scan saved before `MIGRATIONS[1]` recorded it. No
         * chip is the honest render there: the row genuinely does not know how
         * far its rule reached, and inventing a scope would be worse than
         * showing none (AC-18).
         */}
        {scope === undefined ? null : <ScopeChip scope={scope} />}
      </View>
    </View>
  );
}
