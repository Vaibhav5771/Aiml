import { ResultScreen } from '@/screens/result';

/**
 * Route only. The screen body lives in `src/screens/result`.
 *
 * A static segment, so it wins over `[id]` and `unsaved` can never be mistaken
 * for a scan id. It is the one entry that reads the verdict out of memory
 * rather than out of the database, because a storage failure must never
 * swallow an answer the engine already reached (spec 0007, AC-13).
 */
export default function UnsavedResult() {
  return <ResultScreen unsaved />;
}
