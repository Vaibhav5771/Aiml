import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

/**
 * The two tab bottom navigation: Scan and History.
 *
 * This is the JS `Tabs` navigator rather than `NativeTabs`. The native one
 * renders real Material 3 navigation on Android, which looks native but
 * accepts almost no styling, and it went dark against our light surfaces
 * whenever the phone was set to dark. Spec 0002 locks the app to one palette,
 * so a bar that follows the system theme was a live bug, not a feature.
 *
 * Drawing your own tab bar is a named anti pattern (the Floating Pill Tab
 * Bar) and it is only safe because of what is NOT here: no margin, no inset,
 * no corner radius, no shadow and no elevation. The bar sits flush and full
 * width against the bottom of the screen with a hairline above it, which is
 * what react-navigation's `uikit` variant already draws. If you are tempted
 * to float it, read the Consequences section of spec 0002 first.
 *
 * Imported from `expo-router/js-tabs`: the same navigator, but the path that
 * is not deprecated in expo-router 57.
 */

/** Matches `--text-label--line-height` in `src/global.css`. */
const LABEL_LINE_HEIGHT = 18;
const ICON_SIZE = 24;
const BREATHING_ROOM = 8;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();

  /*
   * 48dp floor, grown by the system font setting so a scaled up label still
   * fits instead of clipping (AC-4 and AC-5 pull in opposite directions here,
   * and a fixed height can only satisfy one of them). The bottom safe area
   * inset is added on top because the bar owns it now that it is flush.
   */
  const barHeight = Math.max(
    48,
    ICON_SIZE + LABEL_LINE_HEIGHT * fontScale + BREATHING_ROOM
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.hairline,
          height: barHeight + insets.bottom,
          // Flush means flush: no lift off the surface, on either platform.
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '500' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'scan' : 'scan-outline'} size={ICON_SIZE} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
