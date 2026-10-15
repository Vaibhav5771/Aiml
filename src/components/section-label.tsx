import { cn } from '@/tw/cn';
import { Text } from '@/tw';

/**
 * The small uppercase heading above a block, e.g. WHAT I SAW.
 *
 * Quiet on purpose. It orients you without competing with the verdict, and it
 * is announced as a heading so a screen reader can jump between the sections
 * rather than reading the whole screen in order.
 */
export function SectionLabel({ children, className }: { children: string; className?: string }) {
  return (
    <Text
      accessibilityRole="header"
      className={cn('text-label uppercase tracking-widest font-semibold text-ink-soft', className)}
    >
      {children}
    </Text>
  );
}
