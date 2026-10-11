import { Screen } from '@/components/screen';
import { Text, View } from '@/tw';

/**
 * History, the list of past scans held on this phone.
 *
 * Placeholder. Feature 11 (Scan history list) builds the real list, the empty
 * state and the swipe to delete action, reading from `src/db`. Feature 6
 * deliberately did not build `HistoryRow`, `VerdictPill` or `EmptyList`:
 * there is no real history screen to design them against yet, and a primitive
 * invented ahead of its first caller is a guess.
 */
export default function HistoryScreen() {
  return (
    <Screen>
      <View className="flex-1 p-6 gap-4">
        <Text accessibilityRole="header" className="text-title text-ink">
          History
        </Text>
        <Text className="text-body text-ink-soft">
          Past scans appear here, newest first. Feature 11 builds it.
        </Text>
      </View>
    </Screen>
  );
}
