import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { HistoryRow } from '@/components/history-row';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useScans } from '@/store/scans';
import { authColors } from '@/theme';
import { FlatList, Pressable, Text, View } from '@/tw';
import type { ScanSummary } from '@/vision/types';

import { whenLabel } from './when';

/**
 * History: every scan held on this phone, newest first.
 *
 * It reads `summaries` rather than whole scans, which is the projection
 * `listScans` already returns: no attributes, no rule, no scores. Opening a
 * row re-reads that one scan at full fidelity through `/result/[id]`, the same
 * route a fresh verdict lands on, so there is one result screen and not two.
 *
 * The list refreshes on focus rather than once on mount. That is what makes a
 * scan appear here straight after you take it, and what keeps a row from
 * lingering after feature 12 deletes it: both of those arrive by navigation,
 * not by a render this screen is present for.
 *
 * `db_unavailable` is a state, not an exception. Spec 0006 keeps a storage
 * problem off the scan path entirely, so the worst a broken database does is
 * make this one screen say so and offer to try again.
 */
export function HistoryScreen() {
  const { signOut } = useAuth();
  const summaries = useScans((state) => state.summaries);
  const loading = useScans((state) => state.loading);
  const error = useScans((state) => state.error);
  const refresh = useScans((state) => state.refresh);

  const confirmSignOut = () => {
    Alert.alert(
      'Log out?',
      'You will need to sign in again to access Recyclens.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            void signOut().catch(() => {
              Alert.alert('Unable to log out', 'Check your connection and try again.');
            });
          },
        },
      ],
      { cancelable: true },
    );
  };

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const renderItem = useCallback(
    ({ item }: { item: ScanSummary }) => (
      <HistoryRow
        summary={item}
        when={whenLabel(item.scannedAt)}
        onPress={() => router.push({ pathname: '/result/[id]', params: { id: item.id } })}
      />
    ),
    [],
  );

  return (
    <Screen className="bg-auth-background">
      <View className="flex-row items-center justify-between gap-2 px-4 py-2">
        <Text accessibilityRole="header" className="text-title font-display text-auth-ink">
          History
        </Text>

        <View className="flex-row items-center gap-3">
          {summaries.length > 0 ? (
            <Text className="text-label font-inter text-auth-ink-soft">
              {`${summaries.length} ${summaries.length === 1 ? 'scan' : 'scans'}`}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityHint="Asks for confirmation before signing out"
            onPress={confirmSignOut}
            className="focus-ring w-[48px] h-[48px] rounded-full bg-auth-surface border border-auth-hairline items-center justify-center active:opacity-85"
          >
            <Ionicons name="log-out-outline" size={20} color={authColors.ink} />
          </Pressable>
        </View>
      </View>

      <Body
        summaries={summaries}
        loading={loading}
        failed={error === 'db_unavailable'}
        onRetry={refresh}
        renderItem={renderItem}
      />
    </Screen>
  );
}

/**
 * The four things this screen can be, picked in one place.
 *
 * Order matters. A stale list is better than a spinner, so a refresh over
 * rows already on screen shows the rows; the empty and loading states only
 * win when there is genuinely nothing to show yet.
 */
function Body({
  summaries,
  loading,
  failed,
  onRetry,
  renderItem,
}: {
  summaries: readonly ScanSummary[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  renderItem: ({ item }: { item: ScanSummary }) => React.ReactElement;
}) {
  if (summaries.length > 0) {
    return (
      <FlatList<ScanSummary>
        data={summaries as ScanSummary[]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerClassName="p-4 pb-8 gap-2"
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={onRetry}
      />
    );
  }

  if (failed) {
    return (
      <StateView
        icon="alert-circle-outline"
        title="History is unavailable"
        explanation="Past scans could not be read from this phone. Scanning still works, and anything you scan now will be saved once this clears."
        action={{ label: 'Try again', icon: 'refresh', onPress: onRetry }}
      />
    );
  }

  // Only before the first read has finished. After that an empty list is a
  // real answer, not a thing still loading.
  if (loading) {
    return <StateView icon="time-outline" title="Reading your scans" explanation="One moment." />;
  }

  return (
    <StateView
      icon="scan-outline"
      title="No scans yet"
      explanation="Scan a piece of packaging and it will appear here, with the verdict and the rule behind it, ready to reopen later."
      action={{ label: 'Scan something', icon: 'scan', onPress: () => router.navigate('/') }}
    />
  );
}
