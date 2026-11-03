import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openShareSheet, SHEET_OPENING_MS } from './deviceShare.ts';

const DATA = { title: 'Yamaha RW350', text: 'Yamaha RW350', url: 'https://www.moto-scoot.tn/article/x' };

/** A share sheet that stays open until the test picks or cancels, like a real one. */
function installSheet() {
  const calls: Array<{ pick: () => void; cancel: () => void }> = [];
  let open = false;
  Object.defineProperty(globalThis.navigator, 'share', {
    configurable: true,
    value: () => {
      if (open) return Promise.reject(new DOMException('An earlier share has not yet completed.', 'InvalidStateError'));
      open = true;
      return new Promise<void>((resolve, reject) => {
        calls.push({
          pick: () => { open = false; resolve(); },
          cancel: () => { open = false; reject(new DOMException('Share canceled', 'AbortError')); },
        });
      });
    },
  });
  return calls;
}

beforeEach(() => mock.timers.enable({ apis: ['Date'], now: 1_000_000 }));
afterEach(() => {
  mock.timers.reset();
  delete (globalThis.navigator as { share?: unknown }).share;
  delete (globalThis.navigator as { canShare?: unknown }).canShare;
});

test('no Web Share API: unavailable, so the caller can fall back', async () => {
  assert.equal(await openShareSheet(DATA), 'unavailable');
});

test('a second tap while the sheet is opening is ignored, not answered with a fallback', async () => {
  const sheet = installSheet();
  const first = openShareSheet(DATA);
  mock.timers.tick(300);
  assert.equal(await openShareSheet(DATA), 'busy');
  assert.equal(sheet.length, 1, 'navigator.share called once');
  sheet[0].pick();
  assert.equal(await first, 'shared');
});

test('closing the sheet is the user\'s choice; the next tap opens it again', async () => {
  const sheet = installSheet();
  const first = openShareSheet(DATA);
  sheet[0].cancel();
  assert.equal(await first, 'cancelled');
  const second = openShareSheet(DATA);
  assert.equal(sheet.length, 2);
  sheet[1].pick();
  assert.equal(await second, 'shared');
});

test('a browser that never settles the promise does not block sharing forever', async () => {
  const sheet = installSheet();
  void openShareSheet(DATA); // never picked nor cancelled
  mock.timers.tick(SHEET_OPENING_MS + 1);
  // The browser still thinks a share is running: the caller gets 'failed' and can fall back.
  assert.equal(await openShareSheet(DATA), 'failed');
  assert.equal(sheet.length, 1);
});

test('a refused share (e.g. blocked in an in-app browser) is reported as failed', async () => {
  Object.defineProperty(globalThis.navigator, 'share', {
    configurable: true,
    value: () => Promise.reject(new DOMException('Not allowed', 'NotAllowedError')),
  });
  assert.equal(await openShareSheet(DATA), 'failed');
});

test('data the device cannot share is unavailable', async () => {
  installSheet();
  Object.defineProperty(globalThis.navigator, 'canShare', { configurable: true, value: () => false });
  assert.equal(await openShareSheet(DATA), 'unavailable');
});
