import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme';
import { cn } from '@/tw/cn';
import { Text, View } from '@/tw';

import { AppButton } from './app-button';
import { LinkButton } from './link-button';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type StateAction = {
  label: string;
  icon?: IconName;
  onPress: () => void;
};

/**
 * One screen filling state: an icon, a title, an explanation, and up to two
 * ways forward.
 *
 * Every state the app can land in that is not the happy path is built from
 * this: permission refused today, and no network, service failed and nothing
 * recognised when feature 10 lands. The point is that none of them is ever a
 * spinner left running or a blank screen, because this component cannot
 * render without a title and an explanation.
 *
 * Feature 6 owns the shape. The calling feature owns every word, every icon
 * and every action, because only it knows what went wrong and what to try.
 */
export function StateView({
  icon,
  title,
  explanation,
  action,
  secondaryAction,
  className,
}: {
  icon: IconName;
  title: string;
  explanation: string;
  action?: StateAction;
  secondaryAction?: StateAction;
  className?: string;
}) {
  return (
    <View className={cn('flex-1 items-center justify-center p-6 gap-4', className)}>
      <Ionicons
        name={icon}
        size={44}
        color={colors.inkSoft}
        // Decorative: the title below says the same thing in words.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <Text accessibilityRole="header" className="text-title text-ink text-center">
        {title}
      </Text>

      <Text className="text-body text-ink-soft text-center">{explanation}</Text>

      {action ? (
        <View className="flex-row self-stretch mt-2">
          <AppButton label={action.label} icon={action.icon} onPress={action.onPress} />
        </View>
      ) : null}

      {secondaryAction ? (
        <LinkButton label={secondaryAction.label} onPress={secondaryAction.onPress} />
      ) : null}
    </View>
  );
}
