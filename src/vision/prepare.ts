/**
 * Get a camera shot ready to send: downscaled, JPEG, base64.
 *
 * A hook rather than a plain function, and not by choice. SDK 57 replaced the
 * old `manipulateAsync` with `useImageManipulator`, so the work can only start
 * from inside a component. That is the same constraint `src/db/index.ts`
 * records when it says the downscaled photo has to be handed to `saveScan`
 * rather than derived there.
 *
 * Because the hook takes the source at render, the component calling this must
 * already hold a capture. Mount it after the shutter, not before.
 *
 * Spec 0001 sets the numbers: the long edge to about 1568px at quality 0.8.
 * Reading a faded symbol is the whole product, so this is the wrong place to
 * economize, but above roughly this size the major vision models stop gaining.
 */

import { SaveFormat, useImageManipulator } from 'expo-image-manipulator';
import { useCallback } from 'react';

import { PHOTO } from '@/constants';

import type { PreparedPhoto } from './client';
import type { VisionErrorCode } from './errors';

/** What the camera or the gallery hands over. Both report their own dimensions. */
export type Capture = {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
};

/**
 * The downscaled JPEG.
 *
 * `uri` is the file feature 8 passes to `saveScan` as `sourcePhotoUri`: what
 * was actually sent, not the camera's original, so a saved scan shows the same
 * photo the verdict was read from.
 */
export type DownscaledPhoto = PreparedPhoto & { readonly uri: string };

export type PrepareResult =
  | { readonly ok: true; readonly photo: DownscaledPhoto }
  | { readonly ok: false; readonly error: VisionErrorCode };

const JPEG = 'image/jpeg';

/**
 * Which edge to pin, or neither.
 *
 * Only one dimension is given, so the manipulator keeps the ratio itself. A
 * photo already inside the budget is left at its own size: enlarging it would
 * cost bytes and add no detail that was not already there.
 */
function resizeTo(capture: Capture): { width?: number } | { height?: number } | undefined {
  const longEdge = Math.max(capture.width, capture.height);
  if (longEdge <= PHOTO.maxLongEdge) return undefined;

  return capture.width >= capture.height
    ? { width: PHOTO.maxLongEdge }
    : { height: PHOTO.maxLongEdge };
}

/**
 * Returns the one function that does the work, bound to this capture.
 *
 * Every failure comes back as `photo_unreadable`. The distinction between a
 * file that vanished, an unsupported format and a device out of space is real,
 * but none of them changes what the person can do about it, so collapsing them
 * costs nothing and saves feature 10 three states that would read alike.
 */
export function usePreparedPhoto(capture: Capture): () => Promise<PrepareResult> {
  const context = useImageManipulator(capture.uri);

  return useCallback(async () => {
    try {
      const size = resizeTo(capture);
      if (size !== undefined) context.resize(size);

      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: PHOTO.quality,
        base64: true,
      });

      // `base64: true` was asked for, so an absent one means the save did not
      // do what it said. Sending nothing is worse than failing here.
      if (saved.base64 === undefined || saved.base64.length === 0) {
        return { ok: false, error: 'photo_unreadable' };
      }

      return { ok: true, photo: { uri: saved.uri, base64: saved.base64, mimeType: JPEG } };
    } catch {
      return { ok: false, error: 'photo_unreadable' };
    }
  }, [context, capture]);
}
