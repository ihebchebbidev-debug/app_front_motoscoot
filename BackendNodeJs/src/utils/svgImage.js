/**
 * SVG uploads (brand logos, mostly).
 *
 * An SVG is code, not a picture: it can carry <script> and event handlers
 * that would run with the visitor's (or the admin's) session if the file
 * were served from our domain. We therefore NEVER store the SVG itself:
 * it is drawn once by sharp (librsvg, which runs no script and loads no
 * external resource from a buffer) into a transparent WebP, then goes
 * through the same /uploads/ storage as every other image.
 *
 * Logos are often tiny in their own units (viewBox 0 0 64 24): drawing at
 * the default 72 dpi then enlarging would give a blurry image, so the SVG
 * is drawn directly at the size we keep (longest side SVG_TARGET_PX).
 */

const SVG_MAX_BYTES = 2 * 1024 * 1024;
const SVG_TARGET_PX = 1200;

/** True when the upload is an SVG, whatever the browser called it. */
function isSvg(mimetype, buffer) {
  if (mimetype === 'image/svg+xml') return true;
  if (!buffer || !buffer.length) return false;
  const head = buffer.subarray(0, 1024).toString('utf8').replace(/^﻿/, '').trimStart().toLowerCase();
  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));
}

/**
 * dpi to draw an SVG of `width` × `height` (its size at 72 dpi) so that
 * its longest side is about SVG_TARGET_PX. Clamped to keep huge drawings
 * cheap and tiny ones sharp.
 */
function svgDensity(width, height) {
  const longest = Math.max(Number(width) || 0, Number(height) || 0);
  if (!longest) return 72;
  return Math.min(2400, Math.max(72, Math.round((72 * SVG_TARGET_PX) / longest)));
}

/**
 * Returns a sharp pipeline that reads the SVG at the right density, or
 * throws an Error with a French message (status 400) when it is too big
 * or unreadable.
 */
async function svgPipeline(sharp, buffer) {
  if (buffer.length > SVG_MAX_BYTES) {
    const e = new Error('Logo SVG trop lourd (2 Mo maximum).');
    e.status = 400;
    throw e;
  }
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    meta = null;
  }
  if (!meta || meta.format !== 'svg' || !meta.width || !meta.height) {
    const e = new Error('Fichier SVG illisible : ouvrez-le et réexportez-le, ou envoyez un PNG.');
    e.status = 400;
    throw e;
  }
  const density = svgDensity(meta.width, meta.height);
  return () => sharp(buffer, { density });
}

module.exports = { isSvg, svgDensity, svgPipeline, SVG_MAX_BYTES, SVG_TARGET_PX };
