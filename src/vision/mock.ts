/**
 * Mock scans, so the screens can be built and judged before the real pipeline
 * exists.
 *
 * NOTHING HERE IS REAL. No model has been called. The codes and bands follow
 * the vocabulary spec 0003 fixed, so the shape is exactly what `/api/vision`
 * returns, but the values are hand written. Feature 7 (Walking skeleton)
 * replaces this with a real call through `proxy/`, and when it does, every
 * screen should keep working because the shape is the same.
 */

import type { Scan } from './types';

const YOGURT_TUB: Scan = {
  id: 'demo',
  photoUri: '',
  itemName: 'Yogurt tub',
  scannedAt: new Date().toISOString(),
  verdict: 'recyclable',
  action: 'Kerbside bin, rinse it first',
  confidence: 86,
  attributes: {
    material: { code: 'pp', display: 'Polypropylene, code 5', confidence: 'high' },
    form: { code: 'rigid', display: 'Rigid, holds its shape', confidence: 'high' },
    recyclingSymbol: { code: 'faded', display: 'Found, partly faded', confidence: 'medium' },
    construction: { code: 'single_material', display: 'Single material', confidence: 'high' },
    contamination: { code: 'light_residue', display: 'A little yogurt left inside', confidence: 'medium' },
    photoQuality: { code: 'good', display: 'Sharp and well lit', confidence: 'high' },
  },
  rule: {
    text: 'Rigid polypropylene containers (code 5) are accepted in Pune kerbside recycling when they are clean, dry, and empty.',
    source: 'Pune Municipal Corporation recycling guidelines, rule 5.2',
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
  id: 'uncertain',
  photoUri: '',
  itemName: 'Coffee cup',
  scannedAt: new Date().toISOString(),
  verdict: 'checkManually',
  action: 'I am not confident enough to call this',
  confidence: 41,
  attributes: {
    material: { code: 'unknown', display: 'Could not tell, possibly a laminate', confidence: 'low' },
    form: { code: 'fibre', display: 'Moulded paper fibre', confidence: 'medium' },
    recyclingSymbol: { code: 'absent', display: 'Looked, and there is none', confidence: 'high' },
    construction: { code: 'multi_material', display: 'Two materials joined', confidence: 'medium' },
    contamination: { code: 'unknown', display: 'Too dark inside to see', confidence: 'low' },
    photoQuality: { code: 'poor', display: 'Low light, some blur', confidence: 'high' },
  },
  rule: {
    text: 'Not enough was readable to match a Pune kerbside rule. When the material cannot be identified with confidence, the safe answer is to check manually rather than guess.',
    source: 'Pune Municipal Corporation recycling guidelines, general guidance',
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
