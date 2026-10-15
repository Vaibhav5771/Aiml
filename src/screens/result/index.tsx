import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator } from 'react-native';

import { AppButton } from '@/components/app-button';
import { NoteRow } from '@/components/note-row';
import { ReadsSection } from '@/components/reads-section';
import { RuleCard } from '@/components/rule-card';
import { ScanPhoto } from '@/components/scan-photo';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { StateView } from '@/components/state-view';
import { VerdictCard, verdictAnnouncement } from '@/components/verdict-card';
import { isFailure, type DbErrorCode } from '@/db';
import { LEARNED_GATE_ID, PUNE_RULES } from '@/rules';
import { useScans } from '@/store/scans';
import { colors } from '@/theme';
import { ScrollView, Text, View } from '@/tw';
import { getMockScan, hasMockScan } from '@/vision/mock';
import type { Scan } from '@/vision/types';

import { NEXT_STEP, blockedBy } from './next-step';

/**
 * The verdict screen: the answer, then the rule that produced it, then what it
 * saw.
 *
 * That order is the whole of [spec 0007](../../../docs/specs/0007-verdict-screen/index.md).
 * The reads used to sit above the rule, which left the reader assembling six
 * observations into a conclusion the app had already reached. Now the answer
 * leads, the reasoning is one glance behind it, and the observations are
 * underneath with only the load bearing ones open.
 *
 * One body serves three entries: a fresh scan, a scan reopened from history
 * months later, and a scan the database refused to save. The first two are the
 * same code path by design, because spec 0001 makes the database the source of
 * truth and both arrive by id. That is why feature 12 gets this screen almost
 * free.
 */

/** What the screen can be. It resolves into one of these and never moves. */
type ScreenState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly scan: Scan; readonly stored: boolean }
  | { readonly kind: 'unreadable'; readonly error: DbErrorCode };

/**
 * What each storage failure says.
 *
 * Every one gets its own words and a way forward rather than one shared
 * "something went wrong", because the three mean genuinely different things to
 * the person reading and only one of them suggests the app is broken.
 */
const UNREADABLE: Record<DbErrorCode, { title: string; explanation: string }> = {
  scan_not_found: {
    title: 'That scan is gone',
    explanation: 'It looks like it was deleted. Everything else in your history is still here.',
  },
  row_unreadable: {
    title: 'That scan could not be read',
    explanation:
      'Its record is damaged, or it was written by a newer version of this app. Nothing else is affected.',
  },
  db_unavailable: {
    title: 'Storage is unavailable',
    explanation:
      'The app could not open its own database, so saved scans cannot be reached right now. Scanning something new still works.',
  },
  // Neither of these can reach this screen: both are raised by writing and
  // deleting, never by reading a scan back. They are listed so the record stays
  // complete, and so a new code cannot be added without someone deciding what
  // it says here.
  photo_copy_failed: {
    title: 'That scan could not be opened',
    explanation: 'Something went wrong reaching it. Try scanning the item again.',
  },
  delete_failed: {
    title: 'That scan could not be opened',
    explanation: 'Something went wrong reaching it. Try scanning the item again.',
  },
};

/**
 * When it was scanned, in the phone's own format.
 *
 * Falls back to the raw ISO string rather than throwing, because a Hermes
 * build without full ICU would otherwise take down the whole screen over a
 * date. Ugly beats absent, and it is never wrong.
 */
function scannedAtLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/**
 * The screen body, identical whether the scan came from a row or from memory.
 *
 * `stored` changes exactly one line near the bottom. Everything above it is the
 * same render from the same fields, which is what stops a storage failure
 * quietly producing a lesser version of the answer (spec 0007, AC-13).
 */
function Body({ scan, stored }: { scan: Scan; stored: boolean }) {
  /*
   * AC-14: arriving says the verdict, its action and its confidence as one
   * sentence, rather than leaving someone using a screen reader to swipe
   * through three nodes to learn what the app decided.
   *
   * Guarded on the screen reader actually running, because the call is a no-op
   * otherwise and there is no reason to ask the platform to speak into an
   * empty room.
   */
  useEffect(() => {
    const message = verdictAnnouncement(scan);
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (on) AccessibilityInfo.announceForAccessibility(message);
    });
  }, [scan]);

  const refused = scan.verdict === 'checkManually';
  const blocked = refused ? blockedBy(scan.decidedOn) : undefined;
  const nextStep = refused ? NEXT_STEP[scan.rule.id] : undefined;

  // The rules shipped today against the rules that judged this scan. Equality
  // only: it can say they are different, never whether they got stricter. That
  // limit is recorded as a deferred item in the scope.
  const stale = stored && scan.ruleSetVersion !== PUNE_RULES.version;

  // AC-19: the model is named only where its own gate is the reason. Both of
  // the sources spec 0007 lists, which always agree, because `assess` derives
  // `gateFired` from the same record selection the verdict came from.
  const modelRefused = scan.gateFired || scan.rule.id === LEARNED_GATE_ID;

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerClassName="p-4 pb-8 gap-6" showsVerticalScrollIndicator={false}>
        {/* What was scanned. Small, and above the answer so the answer still leads. */}
        <View className="flex-row items-center gap-2">
          <ScanPhoto uri={scan.photoUri} itemName={scan.itemName} />
          <View className="flex-1 gap-1">
            <Text className="text-label text-ink-soft">Scanned item</Text>
            <Text className="text-body font-semibold text-ink">{scan.itemName}</Text>
          </View>
        </View>

        <VerdictCard
          verdict={scan.verdict}
          action={scan.action}
          confidenceBand={scan.confidenceBand}
          decidedOn={scan.decidedOn}
        />

        {/*
         * AC-8: on a refusal, name the read that let it down. Without this the
         * reader has to work out which of six observations the gate stopped
         * on, which is exactly the work this screen exists to do for them.
         */}
        {blocked === undefined ? null : <Text className="text-body text-ink-soft">{blocked}</Text>}

        <View className="gap-2">
          <SectionLabel>{refused ? 'Why I stopped' : 'The rule I applied'}</SectionLabel>
          <RuleCard rule={scan.rule} />
        </View>

        <ReadsSection attributes={scan.attributes} decidedOn={scan.decidedOn} />

        {scan.note ? <NoteRow>{scan.note}</NoteRow> : null}

        {/*
         * Provenance, last and quiet. It answers when, under whose rules, and
         * whether those are still current. That matters most on a scan reopened
         * months later, and it must never compete with the answer itself (AC-12).
         */}
        <View className="gap-1">
          <Text className="text-label text-ink-soft">Scanned {scannedAtLabel(scan.scannedAt)}</Text>
          <Text className="text-label text-ink-soft">
            {scan.region} · rules {scan.ruleSetVersion}
          </Text>

          {stale ? (
            <Text className="text-label font-semibold text-ink">
              The rules have changed since this scan. This is the answer exactly as it was given on
              the day.
            </Text>
          ) : null}

          {/* AC-19: named, never scored. The trust number reaches no state of this screen. */}
          {modelRefused ? (
            <Text className="text-label text-ink-soft">
              Held back by reliability model {scan.modelVersion}
            </Text>
          ) : null}

          {/* AC-13: the answer survived, the record of it did not. Say so plainly. */}
          {stored ? null : (
            <Text className="text-label font-semibold text-ink">
              This scan could not be saved, so it is not in your history.
            </Text>
          )}
        </View>

        {/*
         * One primary action. Where the app can perform the next step the
         * verdict just recommended, that IS the primary: a filled "Scan
         * another" beside an outlined "Take another photo" would steer away
         * from the advice the card gave two blocks up (AC-9).
         */}
        <View className="flex-row gap-2">
          {nextStep === undefined ? (
            <AppButton label="Scan another" icon="camera" onPress={() => router.navigate('/')} />
          ) : (
            <>
              <AppButton label={nextStep.label} icon={nextStep.icon} onPress={nextStep.go} />
              <AppButton
                label="Scan another"
                variant="secondary"
                onPress={() => router.navigate('/')}
              />
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

/** A scan the database could not save, shown from memory and never refetched. */
function FromMemory() {
  const pending = useScans((state) => state.pending);

  useEffect(() => {
    // The slot is empty only on a direct deep link to this route, since the
    // save path is the one thing that writes it. There is nothing to show, so
    // go where a scan starts rather than render an empty screen.
    if (pending === undefined) router.replace('/');
  }, [pending]);

  return pending === undefined ? null : <Body scan={pending} stored={false} />;
}

/** A scan read back by its id: a fresh one, or one reopened from history. */
function FromStorage() {
  const { id, photo } = useLocalSearchParams<{ id: string; photo?: string }>();
  const open = useScans((state) => state.open);
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;

    void open(id).then((result) => {
      if (!alive) return;

      if (!isFailure(result)) {
        setState({ kind: 'ready', scan: result.value, stored: true });
        return;
      }

      /*
       * The demo scans, and the only reason this branch exists. Feature 8
       * replaces the Scan screen's placeholder navigation with the real
       * pipeline and deletes `src/vision/mock.ts`, and this branch goes with
       * it. Until then it is the only way to reach this screen on a device,
       * which the accessibility sweeps still outstanding on it need.
       *
       * Storage is asked FIRST, and only an id the mock actually recognises is
       * answered here, so a real saved scan can never be shadowed by a mock.
       */
      if (result.error === 'scan_not_found' && hasMockScan(id)) {
        setState({ kind: 'ready', scan: getMockScan(id, photo || undefined), stored: true });
        return;
      }

      setState({ kind: 'unreadable', error: result.error });
    });

    return () => {
      alive = false;
    };
  }, [id, photo, open]);

  if (state.kind === 'loading') {
    return (
      <Screen edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (state.kind === 'unreadable') {
    const { title, explanation } = UNREADABLE[state.error];
    return (
      <Screen edges={['bottom']}>
        <StateView
          icon="document-outline"
          title={title}
          explanation={explanation}
          action={{ label: 'Scan something', icon: 'camera', onPress: () => router.navigate('/') }}
        />
      </Screen>
    );
  }

  return <Body scan={state.scan} stored={state.stored} />;
}

export function ResultScreen({ unsaved = false }: { unsaved?: boolean }) {
  return unsaved ? <FromMemory /> : <FromStorage />;
}
