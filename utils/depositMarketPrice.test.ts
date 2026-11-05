import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('phones see the market price under the price field (desktops keep the side panel)', () => {
  const step = read('components/deposit/StepPublish.tsx');
  assert.match(step, /<p id="price-market" className="lg:hidden/);
  assert.match(step, /aria-describedby=\{hasMarketPrice \? 'price-market' : undefined\}/);
  assert.match(step, /priceEstimate\.n > 0 && priceEstimate\.avg != null/);
  const wizard = read('components/DepositAd.tsx');
  assert.match(wizard, /priceEstimate=\{category === 'Accessoires' \? null : priceEstimate\}/);
});
