import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const lib = read('../src/lib/posthog.ts');
const main = read('../index.tsx');
const banner = read('../components/ui/CookieConsent.tsx');
const user = read('../context/UserContext.tsx');

test('PostHog loads only after « Accepter » in the cookie banner', () => {
  assert.match(lib, /localStorage\.getItem\(CONSENT_KEY\) === 'accepted'/);
  assert.match(lib, /if \(!isPostHogConfigured \|\| !hasAnalyticsConsent\(\)\) return Promise\.resolve\(null\);/);
  assert.match(lib, /if \(!isPostHogConfigured \|\| !hasAnalyticsConsent\(\)\) return;\n  if \(queue\.length < MAX_QUEUE\)/); // no consent: calls are dropped
  assert.match(banner, /updatePostHogConsent\(value === 'accepted'\)/);
  assert.match(lib, /client\?\.opt_out_capturing\(\);/); // refusing later stops capture
});

test('PostHog stays out of the main bundle: dynamic import, started when idle', () => {
  assert.match(lib, /import\('posthog-js'\)/);
  assert.match(lib, /^import type \{ PostHog \} from 'posthog-js';$/m);
  assert.match(lib, /requestIdleCallback\(go, \{ timeout: 4000 \}\)/);
  assert.match(main, /startPostHog\(\);/);
  assert.doesNotMatch(main, /PostHogProvider|@posthog\/react/);
  const files = execSync("git ls-files '*.ts' '*.tsx'", { encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const f of files) {
    if (f === 'src/lib/posthog.ts' || f.endsWith('.test.ts')) continue;
    assert.doesNotMatch(readFileSync(f, 'utf8'), /from 'posthog-js'|import posthog\b/, f);
  }
});

test('signed-in users are known by their account id only (no email or name)', () => {
  assert.match(user, /analytics\.identify\(String\(user\.id\), \{\n\s*member_type: user\.memberType,/);
  assert.doesNotMatch(user, /email: user\.email|\{ name \}/);
});
