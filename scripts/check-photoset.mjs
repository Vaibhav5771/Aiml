#!/usr/bin/env node
/**
 * The photo set baseline.
 *
 * Runs every photo in `docs/specs/0003-packaging-vision-read/photoset/`
 * against the deployed proxy and prints the code you expected beside the code
 * that came back, per attribute.
 *
 *   npm run check:photoset
 *   npm run check:photoset -- https://your-proxy.vercel.app
 *
 * This is the only thing in spec 0003 that turns the confidence bands from a
 * plausible guess into evidence. Until it runs, "88% sure" is the model's
 * guess about its own guess, dressed as a measurement.
 *
 * It sets NO pass bar and never exits non zero on a mismatch. Judging whether
 * a read is good enough is yours, because a wrong answer on a deliberately
 * terrible photo is the correct answer. It exits non zero only when it could
 * not run at all.
 *
 * It costs real Gemini quota, one call per photo. It is not a unit test and
 * does not belong in a pre commit hook.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SET_DIR = join(ROOT, 'docs', 'specs', '0003-packaging-vision-read', 'photoset');
const EXPECTED_FILE = join(SET_DIR, 'expected.json');

/** Keep in step with ATTRIBUTE_ORDER in src/vision/types.ts. */
const ATTRIBUTES = [
  'material',
  'form',
  'recyclingSymbol',
  'construction',
  'contamination',
  'photoQuality',
];

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function die(message, hint) {
  console.error(`check:photoset  ${message}`);
  if (hint) console.error(`\n${hint}`);
  process.exit(1);
}

const proxyUrl = (process.argv[2] ?? process.env.EXPO_PUBLIC_PROXY_URL ?? '').replace(/\/$/, '');
if (!proxyUrl) {
  die(
    'no proxy URL',
    'Pass it as an argument, or set EXPO_PUBLIC_PROXY_URL in your environment:\n' +
      '  npm run check:photoset -- https://your-proxy.vercel.app',
  );
}

if (!existsSync(EXPECTED_FILE)) {
  die(
    `no expected.json at ${EXPECTED_FILE}`,
    'Shoot the photos first, drop them in that folder, and write one entry per\n' +
      'photo in expected.json. The README beside it says what each field means.',
  );
}

const entries = JSON.parse(readFileSync(EXPECTED_FILE, 'utf8'));
if (!Array.isArray(entries) || entries.length === 0) {
  die(
    'expected.json is empty',
    'Spec 0003 asks for at least ten photos before this means anything.',
  );
}

const endpoint = `${proxyUrl}/api/vision`;
console.log(`check:photoset  ${entries.length} photo(s) against ${endpoint}\n`);

/** One request, returning either the read or the declared error code. */
async function read(file) {
  const path = join(SET_DIR, file);
  if (!existsSync(path)) return { error: `missing file: ${file}` };

  const mimeType = MIME[extname(file).toLowerCase()];
  if (!mimeType) return { error: `unsupported file type: ${file}` };

  const started = Date.now();
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: readFileSync(path).toString('base64'), mimeType }),
    });
  } catch (cause) {
    return { error: `could not reach the proxy: ${cause.message}` };
  }

  const ms = Date.now() - started;
  const body = await response.json().catch(() => ({}));

  return response.ok ? { read: body, ms } : { error: body.error ?? `http ${response.status}`, ms };
}

const tally = { attributes: 0, matched: 0, failed: 0 };

for (const entry of entries) {
  const { file, expected = {}, note } = entry;
  const result = await read(file);

  console.log(`${file}${note ? `  (${note})` : ''}`);

  if (result.error) {
    tally.failed += 1;
    // An expected error is a pass of a different kind: a photo of a cat SHOULD
    // come back no_packaging_found.
    const wanted = expected.error;
    const verdict = wanted ? (wanted === result.error ? 'as expected' : `expected ${wanted}`) : '';
    console.log(`  error: ${result.error}  ${verdict}`.trimEnd());
    console.log('');
    continue;
  }

  console.log(`  itemName: ${result.read.itemName}   (${result.ms}ms)`);
  if (result.read.note) console.log(`  note: ${result.read.note}`);

  for (const key of ATTRIBUTES) {
    const got = result.read.attributes?.[key];
    const want = expected[key];
    if (!got) {
      console.log(`  ${key.padEnd(16)} MISSING from the response`);
      continue;
    }

    tally.attributes += 1;
    const agreed = want === undefined || want === got.code;
    if (agreed && want !== undefined) tally.matched += 1;

    const mark = want === undefined ? ' ' : agreed ? '.' : 'x';
    const wanted = want === undefined ? '' : agreed ? '' : `  expected ${want}`;

    console.log(
      `  ${mark} ${key.padEnd(16)} ${String(got.code).padEnd(20)} ` +
        `${String(got.confidence).padEnd(7)} ${String(got.score).padStart(3)}${wanted}`,
    );
    console.log(`      ${got.display}`);
  }

  console.log('');
}

console.log(
  `check:photoset  ${tally.matched}/${tally.attributes} attribute(s) matched what you expected` +
    (tally.failed ? `, ${tally.failed} photo(s) returned an error` : ''),
);
console.log('No pass bar is set on purpose. Read the misses and decide for yourself.');
