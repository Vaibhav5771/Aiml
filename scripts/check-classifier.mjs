#!/usr/bin/env node
/**
 * The second opinion, checked against the real service.
 *
 * Calls your classifier endpoint directly, with no proxy and no Gemini, and
 * prints the label distribution it comes back with.
 *
 *   CLASSIFIER_URL=https://<you>-<space>.hf.space/classify \
 *   CLASSIFIER_TOKEN=... npm run check:classifier -- path/to/photo.jpg
 *
 *   # or, with no photo, the whole spec 0003 photo set
 *   CLASSIFIER_URL=... npm run check:classifier
 *
 * This exists because the unit tests in `proxy/api/classifier.test.ts` cover
 * every pure part of the integration and NONE of the live call. Until this
 * runs, the label strings, the endpoint and the token are three assumptions
 * rather than three facts.
 *
 * It sets no pass bar and never exits non zero on a surprising label: the
 * classifier was trained on a different dataset and is expected to be wrong
 * sometimes, which is the entire reason it is only ever allowed to refuse.
 * It exits non zero only when it could not run at all.
 *
 * It does NOT point at Hugging Face's inference API, and that is not an
 * oversight. No provider serves `prithivMLmods/Recycling-Net-11`:
 *
 *   GET /api/models/prithivMLmods/Recycling-Net-11?expand[]=inferenceProviderMapping
 *   -> "inferenceProviderMapping": {}
 *
 * so that route returns `Model not supported` whatever token you hold.
 * `classifier/README.md` is the ten minute deploy that gives it a URL.
 *
 * Not a unit test, and not for a pre commit hook. It spends CPU on a free
 * Space, one call per photo.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SET_DIR = join(ROOT, 'docs', 'specs', '0003-packaging-vision-read', 'photoset');

/** Keep in step with LABEL_TO_MATERIAL in proxy/api/classifier.ts. */
const LABEL_TO_MATERIAL = {
  aluminium: 'aluminium',
  batteries: '(no material)',
  cardboard: 'cardboard',
  'disposable plates': '(no material)',
  glass: 'glass',
  'hard plastic': 'other_plastic',
  paper: 'paper',
  'paper towel': 'paper',
  polystyrene: 'ps',
  'soft plastics': 'other_plastic',
  'takeaway cups': 'composite_laminate',
};

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const url = process.env.CLASSIFIER_URL;
if (!url) {
  die(
    'CLASSIFIER_URL is not set.\n' +
      '  Deploy the service in classifier/ to a free Hugging Face Space\n' +
      '  (see classifier/README.md), then:\n\n' +
      '    CLASSIFIER_URL=https://<you>-<space>.hf.space/classify \\\n' +
      '    npm run check:classifier -- photo.jpg',
  );
}

const token = process.env.CLASSIFIER_TOKEN ?? '';

const argPath = process.argv[2];

const photos = argPath
  ? [argPath]
  : existsSync(SET_DIR)
    ? readdirSync(SET_DIR)
        .filter((f) => MIME[extname(f).toLowerCase()])
        .map((f) => join(SET_DIR, f))
    : [];

if (photos.length === 0) {
  die(
    argPath
      ? `No such photo: ${argPath}`
      : `No photos found in ${SET_DIR}\n  Pass one explicitly: npm run check:classifier -- photo.jpg`,
  );
}

/**
 * Wake the Space and say what is actually loaded there.
 *
 * Worth its own call rather than letting the first photo discover it. A free
 * Space cold starts in 30 to 60 seconds, so without this the first photo looks
 * like a broken integration; and the reply names the model and the processor's
 * own numbers, which is the fastest way to catch a container serving something
 * other than what this script's label map expects.
 */
async function health() {
  const base = url.replace(/\/classify\/?$/, '');
  try {
    const response = await fetch(`${base}/health`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}

async function classify(path) {
  const ext = extname(path).toLowerCase();
  const mimeType = MIME[ext];
  if (!mimeType) return { error: `unsupported extension ${ext}` };
  if (!existsSync(path)) return { error: 'file not found' };

  const startedAt = Date.now();

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'content-type': mimeType,
      },
      body: readFileSync(path),
    });
  } catch (e) {
    return { error: `network: ${e.message}` };
  }

  const ms = Date.now() - startedAt;

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    // A 5xx here is ordinarily the Space still waking, which is the designed
    // failure rather than a broken integration.
    return { error: `HTTP ${response.status} ${detail.slice(0, 200)}`, ms };
  }

  const body = await response.json().catch(() => undefined);
  if (!Array.isArray(body)) {
    return { error: `unexpected body ${JSON.stringify(body)?.slice(0, 200)}`, ms };
  }

  return { rows: [...body].sort((a, b) => b.score - a.score), ms };
}

console.log(`\n  ${url}`);

const info = await health();
if (info) {
  console.log(`  ${info.model}  ${info.serving}  crop=${info.crop}`);
  if (!info.protected) {
    console.log('  WARNING  no CLASSIFIER_TOKEN set on the service, so the URL is open');
  }
} else {
  console.log('  (no /health answer — the Space may still be waking)');
}

console.log(`  ${photos.length} photo${photos.length === 1 ? '' : 's'}\n`);

let failures = 0;

for (const path of photos) {
  const { rows, error, ms } = await classify(path);

  if (error) {
    failures++;
    console.log(`  ${basename(path)}\n    ERROR  ${error}${ms ? `  (${ms}ms)` : ''}\n`);
    continue;
  }

  const top = rows[0];
  const material = LABEL_TO_MATERIAL[top.label] ?? '(UNKNOWN LABEL — the map is out of date)';

  console.log(`  ${basename(path)}  (${ms}ms)`);
  console.log(`    -> ${top.label}  ${Math.round(top.score * 100)}%  maps to ${material}`);

  for (const row of rows.slice(1, 3)) {
    console.log(`       ${row.label}  ${Math.round(row.score * 100)}%`);
  }
  console.log('');
}

if (failures === photos.length) {
  die(`Every call failed. Check CLASSIFIER_URL, the token, and that the Space is awake.`);
}

console.log(`  Done. ${photos.length - failures} of ${photos.length} classified.\n`);
