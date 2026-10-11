import type { Edge } from 'react-native-safe-area-context';

import { cn } from '@/tw/cn';
import { SafeAreaView } from '@/tw';

/**
 * The outermost wrapper of every screen: the app background, a flex column,
 * and the safe area edges that screen is responsible for.
 *
 * It replaces three hand written scaffolds that had each drifted a little.
 * The default is `top` only, because the bottom inset belongs to whatever is
 * drawn at the bottom: the tab bar owns it inside the tabs group, and a
 * pushed screen asks for it here.
 */
export function Screen({
  children,
  edges = ['top'],
  className,
}: {
  children: React.ReactNode;
  edges?: readonly Edge[];
  className?: string;
}) {
  return (
    <SafeAreaView className={cn('flex-1 bg-background', className)} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
