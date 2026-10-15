/**
 * Mock scans, so the screens can be built and judged before the real pipeline
 * exists.
 *
 * NOTHING HERE IS REAL. No model has been called. The codes and bands follow
 * the vocabulary spec 0003 fixed, so the shape is exactly what `/api/vision`
 * returns, but the values are hand written. Feature 7 built the real call
 * (`src/vision/client.ts`); feature 8 is what points the Result screen at it
 * and deletes this file, and when it does, every screen should keep working
 * because the shape is the same.
 */

import { UNAVAILABLE_VERSION } from '@/ml/types';

import type { Scan, ScanLearnedFields } from './types';

/**
 * The learned second opinion never looked at these.
 *
 * No read means no scores, and no scores means no feature vector, so there is
 * nothing for the model to judge. `unavailable` is the honest record of that,
 * and it is the same record a real scan carries when the artifact cannot be
 * used. Feature 8 replaces these with `assess()` over a real read.
 */
const NOT_JUDGED: ScanLearnedFields = {
  trustScore: undefined,
  modelVersion: UNAVAILABLE_VERSION,
  gateFired: false,
};

/**
 * Which rules these pretend to have been decided by.
 *
 * Written out rather than imported from `src/rules/`, so the mock stays a
 * plain fixture with no dependency on the engine. Keep it in step with
 * `pune.json` by hand; nothing breaks if it drifts, because nothing reads it
 * back, but a mismatched version in a screenshot is confusing.
 */
const PUNE = { region: 'Pune, India', ruleSetVersion: '1.1.0' };

const YOGURT_TUB: Scan = {
  ...NOT_JUDGED,
  ...PUNE,
  id: 'demo',
  photoUri: '',
  itemName: 'Yogurt tub',
  scannedAt: new Date().toISOString(),
  verdict: 'recyclable',
  action: 'Dry waste, rinse it first',
  // The PP rule names `material` alone, so the confidence is that one read's
  // score and `decidedOn` is that one key. Keep the three in step by hand here:
  // a real scan gets all three from one selection in the engine, a mock cannot.
  confidence: 86,
  confidenceBand: 'high',
  decidedOn: ['material'],
  attributes: {
    material: { code: 'pp', display: 'Polypropylene, code 5', confidence: 'high' },
    form: { code: 'rigid', display: 'Rigid, holds its shape', confidence: 'high' },
    recyclingSymbol: { code: 'faded', display: 'Found, partly faded', confidence: 'medium' },
    construction: { code: 'single_material', display: 'Single material', confidence: 'high' },
    contamination: {
      code: 'light_residue',
      display: 'A little yogurt left inside',
      confidence: 'medium',
    },
    photoQuality: { code: 'good', display: 'Sharp and well lit', confidence: 'high' },
  },
  rule: {
    id: 'rule-pp',
    text: 'Rigid polypropylene, resin code 5, is a recyclable plastic. Empty it, rinse it, and keep it with your dry waste.',
    source: {
      document: 'Plastic Waste Management Rules, 2016 (India)',
      scope: 'national',
      url: 'https://cpcb.nic.in/plastic-waste/',
    },
  },
  note: 'The symbol was faded, so the material was judged from the shape and surface too.',
};

/**
 * The uncertain outcome. This is the one that matters most: the product's whole
 * claim is that it says so plainly when it cannot be sure.
 *
 * Note every `unknown` code carries a `low` band. That is not a style choice,
 * it is what the proxy forces, and the mock has to tell the same truth.
 */
const COFFEE_CUP: Scan = {
  ...NOT_JUDGED,
  ...PUNE,
  id: 'uncertain',
  photoUri: '',
  itemName: 'Coffee cup',
  scannedAt: new Date().toISOString(),
  verdict: 'checkManually',
  action: 'I am not confident enough to call this',
  // The material gate names `material` alone, so that is the read that blocked
  // the answer and the one the screen promotes. 41 bands as low.
  confidence: 41,
  confidenceBand: 'low',
  decidedOn: ['material'],
  attributes: {
    material: {
      code: 'unknown',
      display: 'Could not tell, possibly a laminate',
      confidence: 'low',
    },
    form: { code: 'fibre', display: 'Moulded paper fibre', confidence: 'medium' },
    recyclingSymbol: { code: 'absent', display: 'Looked, and there is none', confidence: 'high' },
    construction: { code: 'multi_material', display: 'Two materials joined', confidence: 'medium' },
    contamination: { code: 'unknown', display: 'Too dark inside to see', confidence: 'low' },
    photoQuality: { code: 'poor', display: 'Low light, some blur', confidence: 'high' },
  },
  rule: {
    id: 'gate-material-unreadable',
    text: 'Not enough was readable to match a rule. When the material cannot be identified with confidence, the safe answer is to check manually rather than guess.',
    source: { document: 'General recycling practice', scope: 'general' },
  },
  note: 'No symbol was visible and the photo was too dark to read the surface.',
};

const BY_ID: Record<string, Scan> = {
  [YOGURT_TUB.id]: YOGURT_TUB,
  [COFFEE_CUP.id]: COFFEE_CUP,
};

/** Look up a mock scan, falling back to the confident one. */
export function getMockScan(id: string | undefined, photoUri?: string): Scan {
  const found = (id && BY_ID[id]) || YOGURT_TUB;
  return photoUri ? { ...found, photoUri } : found;
}

/**
 * Whether this id is one of the two demo scans.
 *
 * The Result screen reads the database first and only falls back here for an
 * id it recognises, so a real saved scan is never shadowed by a mock. Feature
 * 8 deletes this function along with the rest of the file.
 */
export function hasMockScan(id: string | undefined): boolean {
  return id !== undefined && id in BY_ID;
}
