import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scheduleContentView, VIEW_DELAY_MS, type ViewEnv } from './contentView';

/** Fake clock + visibility, driven by the test. */
function fakeEnv(visible = true) {
  let now = 0;
  let isVisible = visible;
  const timers = new Map<number, { at: number; cb: () => void }>();
  let id = 0;
  const listeners = new Set<() => void>();
  const sent = new Set<string>();
  const env: ViewEnv = {
    isVisible: () => isVisible,
    onVisibilityChange: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    setTimer: (cb, ms) => { timers.set(++id, { at: now + ms, cb }); return id; },
    clearTimer: (h) => { timers.delete(h as number); },
    now: () => now,
    wasSent: (k) => sent.has(k),
    markSent: (k) => { sent.add(k); },
  };
  return {
    env,
    sent,
    listeners,
    advance(ms: number) {
      now += ms;
      for (const [k, t] of [...timers]) if (t.at <= now) { timers.delete(k); t.cb(); }
    },
    setVisible(v: boolean) { isVisible = v; listeners.forEach((l) => l()); },
  };
}

test('a reader who stays 5 seconds counts once', () => {
  const f = fakeEnv();
  let calls = 0;
  scheduleContentView('articles:a', () => calls++, f.env);
  f.advance(VIEW_DELAY_MS - 1);
  assert.equal(calls, 0);
  f.advance(1);
  assert.equal(calls, 1);
  f.advance(60_000);
  assert.equal(calls, 1);
});

test('a quick bounce does not count', () => {
  const f = fakeEnv();
  let calls = 0;
  const stop = scheduleContentView('articles:a', () => calls++, f.env);
  f.advance(2000);
  stop();
  f.advance(60_000);
  assert.equal(calls, 0);
});

test('time in a hidden tab does not count', () => {
  const f = fakeEnv(false);
  let calls = 0;
  scheduleContentView('tips:t', () => calls++, f.env);
  f.advance(60_000);
  assert.equal(calls, 0, 'opened in background');
  f.setVisible(true);
  f.advance(3000);
  f.setVisible(false);
  f.advance(60_000);
  assert.equal(calls, 0, 'only 3 s visible');
  f.setVisible(true);
  f.advance(2000);
  assert.equal(calls, 1, '3 s + 2 s visible');
});

test('the same tab does not send twice for the same content', () => {
  const f = fakeEnv();
  let calls = 0;
  scheduleContentView('articles:a', () => calls++, f.env);
  f.advance(VIEW_DELAY_MS);
  scheduleContentView('articles:a', () => calls++, f.env);
  f.advance(VIEW_DELAY_MS);
  assert.equal(calls, 1);
  scheduleContentView('articles:b', () => calls++, f.env);
  f.advance(VIEW_DELAY_MS);
  assert.equal(calls, 2);
});

test('cleanup removes the visibility listener', () => {
  const f = fakeEnv();
  const stop = scheduleContentView('articles:a', () => {}, f.env);
  assert.equal(f.listeners.size, 1);
  stop();
  assert.equal(f.listeners.size, 0);
});

test('article and conseil pages send their view, admin shows the Vues column', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.match(read('../components/ArticleDetails.tsx'), /useContentView\('articles', article \? String\(article\.id\) : null\)/);
  assert.match(read('../components/TipDetails.tsx'), /useContentView\('tips', tip \? String\(tip\.id\) : null\)/);
  for (const tab of ['ArticlesTab', 'TipsTab']) {
    const src = read(`../components/admin/${tab}.tsx`);
    assert.match(src, /'Vues', 'Actions'\]/, tab);
    assert.match(src, /<ViewsCell total=/, tab);
    assert.match(src, /<option value="views">Plus vus<\/option>/, tab);
  }
});
