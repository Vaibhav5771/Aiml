import { ResultScreen } from '@/screens/result';

/**
 * Route only. The screen body lives in `src/screens/result`.
 *
 * It takes a scan id rather than a scan object on purpose. Spec 0001 makes the
 * database the source of truth, so a fresh result and a reopened past scan both
 * arrive here the same way, and feature 12 comes almost free.
 */
export default function Result() {
  return <ResultScreen />;
}
