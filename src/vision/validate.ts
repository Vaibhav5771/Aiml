/**
 * Hold a response from `/api/vision` to the contract before the app believes it.
 *
 * The proxy already validates what Gemini said and normalises every field, so
 * this is not that check run twice. It guards a different seam: `types.ts` and
 * `proxy/api/schema.ts` are two hand kept copies of one vocabulary, and spec
 * 0003 names the silent drift between them as the single most likely thing in
 * the feature to bite you. Something else can also end up answering that URL,
 * a captive portal or a proxy error page being the ordinary cases.
 *
 * So the rule is that nothing reaches `decide()` until it has been checked
 * here. A read that fails becomes `unexpected_response`, which is a state
 * feature 10 can draw, rather than an attribute object with holes in it that
 * the rule engine would quietly match against.
 *
 * Pure, no network, no device. Covered by `validate.test.ts`.
 */

import { ATTRIBUTE_ORDER, VOCABULARY } from './types';
import type { AttributeKey, VisionAttributes, VisionRead } from './types';

/** The caps spec 0003 makes a wire guarantee. Checked, not re-applied: a longer field means drift. */
const MAX_ITEM_NAME = 60;
const MAX_DISPLAY = 60;
const MAX_NOTE = 160;

const BANDS: readonly string[] = ['high', 'medium', 'low'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A non empty string within its cap. Empty after the proxy's own trim is a contract breach. */
function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/**
 * One attribute, against its own closed list.
 *
 * The code is checked against `VOCABULARY[key]` rather than a shared set, so a
 * `photoQuality` of `unknown` fails here exactly as spec 0003 says it should:
 * that attribute describes the photo, not the packaging, so it has no
 * `unknown` to return.
 */
function isAttribute(key: AttributeKey, value: unknown): boolean {
  if (!isRecord(value)) return false;

  const { code, display, confidence, score } = value;

  return (
    typeof code === 'string' &&
    VOCABULARY[key].includes(code) &&
    isText(display, MAX_DISPLAY) &&
    typeof confidence === 'string' &&
    BANDS.includes(confidence) &&
    typeof score === 'number' &&
    Number.isInteger(score) &&
    score >= 0 &&
    score <= 100
  );
}

/**
 * Turn an unknown body into a `VisionRead`, or into nothing.
 *
 * Returns `undefined` rather than throwing or returning a partial read: a half
 * valid set of attributes is the one outcome that would let a bad read reach a
 * verdict, so there is no shape in which it can be expressed.
 *
 * Every one of the six attributes must be present and valid. There is no
 * tolerance for a missing one here, which is the opposite of how `src/db/map.ts`
 * reads a stored scan, and deliberately so: a scan saved last year may predate
 * an attribute, but a response from today's proxy may not.
 */
export function parseVisionRead(body: unknown): VisionRead | undefined {
  if (!isRecord(body)) return undefined;
  if (!isText(body.itemName, MAX_ITEM_NAME)) return undefined;
  if (body.note !== undefined && !isText(body.note, MAX_NOTE)) return undefined;
  if (!isRecord(body.attributes)) return undefined;

  const attributes = body.attributes;
  if (!ATTRIBUTE_ORDER.every((key) => isAttribute(key, attributes[key]))) return undefined;

  return {
    itemName: body.itemName,
    ...(body.note === undefined ? {} : { note: body.note }),
    // Checked key by key immediately above, which is what earns this cast. It
    // is the one place in the app where a wire shape becomes a typed one.
    attributes: attributes as unknown as VisionAttributes,
  };
}
