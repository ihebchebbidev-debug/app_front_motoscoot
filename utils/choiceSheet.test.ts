import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rubberband, shouldCloseSheet } from '../components/search/ChoiceSheet';

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
  assert.match(sheet, /return \(\) => \{ document\.removeEventListener\('keydown', onKey\); unlock\(\); \};\n  \}, \[mounted\]\);/);
});

test('a flick is judged on how the finger left (last 100 ms)', () => {
  assert.match(sheet, /d\.samples\.find\(\(s\) => last\.t - s\.t <= 100\)/);
});
