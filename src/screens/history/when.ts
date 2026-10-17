/**
 * When a scan happened, in the fewest words that are still true.
 *
 * The verdict screen prints the full timestamp, because reopening one scan is
 * a deliberate act and the exact moment is part of the record. A list is read
 * by scanning down it, so a column of `16 Oct 2026, 14:32` is noise: what you
 * are actually asking is "is this the one I just took, or an old one".
 *
 * Pure and injectable on purpose. `now` is a parameter rather than a call to
 * `Date.now()` inside, so the boundaries below are testable without freezing
 * the clock (spec 0001: side effects live at the edges).
 *
 * Calendar days, not 24 hour blocks: a scan at 23:50 is "Yesterday" at 00:10,
 * which is what a reader means by the word.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const startOfDay = (ms: number): number => {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export function whenLabel(iso: string, now: number = Date.now()): string {
  const at = new Date(iso).getTime();

  // A row whose timestamp did not parse still has to render. The id and the
  // verdict are the useful parts; the date quietly says nothing rather than
  // printing `Invalid Date` across the list.
  if (Number.isNaN(at)) return '';

  const elapsed = now - at;

  // Clock skew, or a row written a moment ahead of this render. Reads better
  // than a negative age and never claims a future.
  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return `${minutes} min ago`;
  }

  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);

  if (days === 0) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
