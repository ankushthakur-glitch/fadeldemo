/**
 * ATTACHING A PICTURE TO A COMMENT.
 *
 * The most useful review comment is often a screenshot with the problem
 * circled, and the second most useful is a photograph of a whiteboard. Both
 * arrive from a phone or a Retina screen at four thousand pixels across and
 * several megabytes, and neither needs to be either of those things to make
 * its point.
 *
 * So nothing is uploaded as it arrives. Every image is drawn into a canvas at
 * a sane size first, which typically turns a 4 MB screenshot into 200 KB with
 * no visible difference at the size anyone will look at it. That is worth
 * doing for its own sake, and it is what makes the fallback below viable.
 *
 * WEBP, AND WHY IT MATTERS HERE. Re-encoding as JPEG would put a black
 * rectangle behind every screenshot with a transparent corner — which is most
 * screenshots of a rounded window. WebP keeps the alpha channel and is smaller
 * besides. A browser that cannot make one falls back to JPEG, and a browser
 * that cannot do either keeps the original bytes.
 *
 * IF THE BUCKET IS NOT THERE, the image is carried inside the comment as a
 * data URL instead — smaller again, because an image that has to travel in
 * every read of the table has to be cheap. It is the worse of the two
 * outcomes and it is very much better than telling somebody their screenshot
 * could not be saved, which in a review tool means they stop attaching them.
 */

import * as store from './store.js';

/** What the file picker will offer. */
export const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/avif';

/** More than this in one comment stops being evidence and starts being a mood
    board; the thread has no room to show them either. */
export const MAX_PER_COMMENT = 4;

/* Refuse before decoding rather than after: a 200 MP image can exhaust memory
   in createImageBitmap, and the failure there is a tab that dies rather than a
   message anyone can act on. */
const MAX_BYTES = 25 * 1024 * 1024;

/* Long edge and quality, for the two destinations. Inline images are smaller
   because they ride along on every read of the table for ever. */
const STORED = { edge: 1600, quality: 0.82 };
const INLINE = { edge: 1100, quality: 0.7 };

/**
 * Redraw an image at no more than `edge` pixels on its long side.
 * @returns {Promise<{ blob: Blob, w: number, h: number }>}
 */
async function shrink(file, { edge, quality }) {
  const source = await createImageBitmap(file);
  const scale = Math.min(1, edge / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, w, h);
  source.close?.();

  const blob = (await toBlob(canvas, 'image/webp', quality)) || (await toBlob(canvas, 'image/jpeg', quality));
  /* Neither encoder available is not a real browser, but returning the
     original beats returning nothing. */
  return { blob: blob || file, w, h };
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function dataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Bytes this browser has already got, keyed by the address they were uploaded
 * to.
 *
 * Without it there is a beat, right after sending a comment, where the person
 * who attached the picture is shown an empty grey square: the image has just
 * gone UP to Supabase, and the <img> that replaces the composer has to fetch
 * it back DOWN before it can draw anything. Everyone else in the review sees a
 * normal image load. The sender sees their own screenshot vanish and reappear,
 * which reads as a failed upload.
 *
 * They already have the file. This hands it back to them.
 *
 * Object URLs are revoked by the browser when the page goes, and a review
 * session attaches a handful of images, so there is nothing to clean up.
 *
 * @type {Map<string, string>}
 */
const previews = new Map();

/** The local copy of an uploaded image, if this browser is the one that sent it. */
export function localPreview(url) {
  return previews.get(url);
}

/**
 * Take one file from a picker, a paste or a drop and turn it into something a
 * comment can carry.
 *
 * @param {File} file
 * @returns {Promise<{ url: string, name: string, w: number, h: number, inline?: boolean }>}
 */
export async function attach(file) {
  if (!file.type.startsWith('image/')) throw new Error('Only images can be attached.');
  if (file.size > MAX_BYTES) throw new Error('That image is over 25 MB.');

  const name = file.name || 'screenshot';
  const stored = await shrink(file, STORED);

  try {
    const url = await store.uploadImage(stored.blob, name);
    previews.set(url, URL.createObjectURL(stored.blob));
    return { url, name, w: stored.w, h: stored.h };
  } catch (error) {
    /* The bucket has not been created, or the network is down. Either way the
       reviewer keeps their picture. */
    console.warn('[comments] image kept inside the comment —', error.message);
    const small = await shrink(file, INLINE);
    return { url: await dataUrl(small.blob), name, w: small.w, h: small.h, inline: true };
  }
}

/**
 * The image files in a paste or a drop, if there are any.
 *
 * Pasting is the reason this exists: on every platform the shortcut for "grab
 * that part of the screen" puts an image on the clipboard, and a review tool
 * that cannot take it straight from there is asking people to save a file they
 * did not want.
 *
 * @param {DataTransfer|null} data
 * @returns {File[]}
 */
export function imagesIn(data) {
  if (!data) return [];
  const files = data.files?.length
    ? [...data.files]
    : [...(data.items || [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile());
  return files.filter((f) => f && f.type.startsWith('image/'));
}
