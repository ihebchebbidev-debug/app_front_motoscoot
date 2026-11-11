import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('hover styles apply only with a mouse (no stuck hover after a tap)', () => {
  const tw = read('tailwind.config.js');
  assert.match(tw, /future: \{ hoverOnlyWhenSupported: true \}/);
  assert.match(tw, /addVariant\('touch', '@media \(hover: none\), \(pointer: coarse\)'\)/);
});

test('controls shown on hover with a mouse stay visible to a finger', () => {
  for (const f of ['components/EditListing.tsx', 'components/admin/AdminImageUpload.tsx', 'components/admin/AdminGalleryUpload.tsx']) {
    const s = read(f);
    const hidden = s.match(/opacity-0 group-hover:opacity-100[^"`]*/g) || [];
    for (const cls of hidden) {
      if (/pointer-events-none/.test(cls)) continue; // decorative hint only
      assert.match(cls, /touch:opacity-100/, `${f}: ${cls}`);
    }
  }
});

test('landscape iPhone: content and header clear of the notch, no text enlargement', () => {
  const css = read('src/styles/globals.css');
  assert.match(css, /-webkit-text-size-adjust: 100%;/);
  assert.match(css, /padding-left: env\(safe-area-inset-left, 0px\);/);
  assert.match(read('index.html'), /viewport-fit=cover/);
  assert.match(read('components/layout/Header.tsx'), /pl-\[env\(safe-area-inset-left,0px\)\] pr-\[env\(safe-area-inset-right,0px\)\]/);
});
