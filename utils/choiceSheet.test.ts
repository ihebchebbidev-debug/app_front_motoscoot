import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placeMenu, rubberband, shouldCloseSheet } from '../components/search/ChoiceSheet';

const sheet = readFileSync(new URL('../components/search/ChoiceSheet.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');

test('dragging the sheet up resists more and more and never passes the drag', () => {
  assert.equal(rubberband(0, 600), 0);
  const a = rubberband(50, 600);
  const b = rubberband(200, 600);
  assert.ok(a > 0 && a < 50);
  assert.ok(b > a && b < 200);
  assert.ok(b / 200 < a / 50, 'the further, the less it follows');
});

test('a released drag closes past a quarter of the sheet or on a flick', () => {
  assert.equal(shouldCloseSheet(100, 600, 0.1), false); // short and slow: springs back
  assert.equal(shouldCloseSheet(160, 600, 0.1), true); // past 25 %
  assert.equal(shouldCloseSheet(40, 600, 0.8), true); // short flick
});

test('phones get no keyboard on open; a mouse keeps the direct focus', () => {
  assert.match(sheet, /autoFocus=\{finePointer\(\)\}/);
  assert.match(sheet, /matchMedia\('\(pointer: fine\)'\)/);
});

test('the page behind does not scroll, iPhone included, and comes back to its place', () => {
  assert.match(sheet, /body\.style\.position = 'fixed';/);
  assert.match(sheet, /body\.style\.top = `-\$\{y\}px`;/);
  assert.match(sheet, /window\.scrollTo\(0, y\);/);
});

test('phones: the sheet rises from the bottom edge and goes back down there', () => {
  assert.match(css, /@media \(max-width: 767px\) \{\s*\.ms-sheet\[data-state=open\] \{ animation: ms-sheet-up/);
  assert.match(css, /\.ms-sheet\[data-state=closed\] \{ animation: ms-sheet-down/);
  assert.match(css, /@keyframes ms-sheet-up \{ from \{ transform: translateY\(100%\); \}/);
  assert.match(css, /@keyframes ms-sheet-down \{ from \{ transform: none; \} to \{ transform: translateY\(100%\); \}/);
});

test('reduced motion: fades only, no movement', () => {
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n    .ms-sheet'));
  assert.match(block, /\.ms-sheet\[data-state=open\] \{ animation: ms-fade-in 150ms/);
  assert.match(block, /\.ms-sheet\[data-state=closed\] \{ animation: ms-fade-out 150ms/);
});

test('the sheet stays on screen while it leaves, and a drag-closed sheet does not replay the exit', () => {
  assert.match(sheet, /const EXIT_MS = 220;/);
  assert.match(sheet, /setMounted\(false\), draggedShut\.current \? 0 : EXIT_MS/);
  assert.match(sheet, /\.ms-sheet\[data-state=dragged\]|data-state=\{draggedShut\.current \? 'dragged' : state\}/);
});

test('the finger moves the sheet: the opening animation does not hold its transform afterwards', () => {
  assert.match(css, /\.ms-sheet\[data-state=open\] \{ animation: ms-sheet-up 320ms cubic-bezier\(0\.32, 0\.72, 0, 1\) backwards; \}/);
  assert.doesNotMatch(css, /\.ms-sheet\[data-state=open\] \{[^}]* both; \}/);
  assert.match(css, /@keyframes ms-fade-out \{ to \{ opacity: 0; \} \}/); // fades from where the drag left the scrim
});

test('the scroll lock is taken once per opening, not on every render', () => {
  assert.match(sheet, /onCloseRef\.current = onClose;/);
  assert.match(sheet, /return \(\) => \{ document\.removeEventListener\('keydown', onKey\); unlock\(\); \};\n    \/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\n  \}, \[mounted, menu\]\);/);
});

test('a flick is judged on how the finger left (last 100 ms)', () => {
  assert.match(sheet, /d\.samples\.find\(\(s\) => last\.t - s\.t <= 100\)/);
});

// ── From 768 px: a menu under the field (Apple analysis, priority 2) ──

const VIEW = { width: 1440, height: 900 };

test('the menu opens right under its field, left edges aligned, at least 240 px wide', () => {
  const m = placeMenu({ top: 300, bottom: 356, left: 400, width: 150 }, VIEW);
  assert.equal(m.side, 'bottom');
  assert.equal(m.top, 362); // 6 px under the field
  assert.equal(m.left, 400);
  assert.equal(m.width, 240);
  assert.equal(m.maxHeight, 360);
  // A wide field: the menu is as wide as the field.
  assert.equal(placeMenu({ top: 300, bottom: 356, left: 100, width: 300 }, VIEW).width, 300);
});

test('the menu goes above the field only when the room below is cramped', () => {
  const low = placeMenu({ top: 700, bottom: 756, left: 400, width: 200 }, VIEW);
  assert.equal(low.side, 'top');
  assert.equal(low.bottom, 900 - 700 + 6);
  assert.equal(low.top, undefined);
  // 250 px below is enough: stays below, shorter.
  const mid = placeMenu({ top: 572, bottom: 628, left: 400, width: 200 }, VIEW);
  assert.equal(mid.side, 'bottom');
  assert.equal(mid.maxHeight, 900 - 628 - 6 - 16);
});

test('the menu never leaves the window', () => {
  const right = placeMenu({ top: 300, bottom: 356, left: 1300, width: 120 }, VIEW);
  assert.equal(right.left + right.width, 1440 - 16);
  const narrow = placeMenu({ top: 300, bottom: 356, left: 0, width: 900 }, { width: 800, height: 900 });
  assert.equal(narrow.left, 16);
  assert.equal(narrow.width, 800 - 32);
});

test('the menu has no scrim and does not hold the page; Escape gives the focus back to the field', () => {
  const menuBlock = sheet.slice(sheet.indexOf('if (menu) {\n    if (!place) return null;'), sheet.indexOf('return createPortal(\n    <div\n      ref={scrimRef}'));
  assert.ok(menuBlock.length > 0);
  assert.doesNotMatch(menuBlock, /bg-black|backdrop-blur|aria-modal/);
  assert.match(sheet, /const unlock = menu \? \(\) => \{\} : lockScroll\(\);/);
  assert.match(sheet, /if \(menu\) anchor\?\.current\?\.querySelector<HTMLElement>\('button'\)\?\.focus\(\);/);
  assert.match(readFileSync(new URL('../components/search/SearchBar.tsx', import.meta.url), 'utf8'), /anchor=\{boxRef\}/);
});

test('the menu opens from its field, and only fades under reduced motion', () => {
  assert.match(css, /\.ms-menu \{ transform-origin: top center; \}/);
  assert.match(css, /\.ms-menu\[data-side=top\] \{ transform-origin: bottom center; \}/);
  assert.match(css, /\.ms-menu\[data-state=open\], \.ms-menu\[data-side=top\]\[data-state=open\] \{ animation: ms-fade-in 120ms/);
});
