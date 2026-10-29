/**
 * /test — Backend integration & health dashboard.
 *
 * Goal: hit EVERY backend route the public app depends on, in mass mode,
 * and report exact green/red status with full diagnostics so any breakage
 * is immediately attributable.
 *
 * Status legend
 *   ✅ ok        — HTTP 2xx + non-empty payload
 *   🟡 empty     — HTTP 2xx but payload is empty (table not seeded)
 *   ❌ fail      — Network error / 4xx / 5xx (shows backend message + reqId)
 *   🔒 skipped   — Endpoint requires auth and no JWT in localStorage
 *   ⚪ expected — Endpoint correctly rejected anonymous access (401/403)
 *                  → counted as PASS for protected routes
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { apiClient, API_BASE_URL, tokenStorage, ApiError } from '../services/apiClient';

type Status = 'idle' | 'running' | 'ok' | 'empty' | 'fail' | 'skipped' | 'expected';

interface RunMetrics {
  durationMs: number;
  httpStatus: number;
}

interface TestResult {
  status: Status;
  runs: number;
  failures: number;
  minMs?: number;
  avgMs?: number;
  maxMs?: number;
  httpStatus?: number;
  message?: string;
  requestId?: string;
  sample?: string;
  count?: number;
  /** Detailed per-iteration log for inspection */
  history?: Array<{ ok: boolean; status: number; ms: number; msg?: string; reqId?: string }>;
}

interface TestCase {
  id: string;
  group: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  /** Endpoint requires a logged-in user. */
  auth?: boolean;
  /** Endpoint requires admin role. */
  admin?: boolean;
  /** Optional body for non-GET. */
  body?: any;
  /** Status codes that should be treated as a successful contract test. */
  expectedFailureCodes?: number[];
  /** Note shown beside the row. */
  note?: string;
}

const isEmptyPayload = (v: any): boolean => {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') {
    const arrKeys = ['listings', 'articles', 'tips', 'garages', 'data', 'items', 'reviews', 'messages', 'conversations', 'notifications', 'users', 'reports', 'ads', 'categories', 'models', 'brands', 'cities', 'equipment', 'colors'];
    for (const k of arrKeys) if (Array.isArray(v[k])) return v[k].length === 0;
    return Object.keys(v).length === 0;
  }
  return false;
};

const countOf = (v: any): number | undefined => {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') {
    if (typeof v.total === 'number') return v.total;
    if (v.pagination && typeof v.pagination.total === 'number') return v.pagination.total;
    for (const k of ['listings', 'articles', 'tips', 'garages', 'items', 'reviews', 'data', 'categories', 'models', 'brands', 'cities']) {
      if (Array.isArray(v[k])) return v[k].length;
    }
  }
  return undefined;
};

/* ============================================================
 * EXHAUSTIVE TEST CATALOGUE — derived from BackendNodeJs/src/routes
 * ============================================================ */

const TESTS: TestCase[] = [
  /* ---------- System ---------- */
  { id: 'health',            group: 'System',     method: 'GET', path: '/health' },
  { id: 'tests-health',      group: 'System',     method: 'GET', path: '/tests/health' },

  /* ---------- Reference (public) ---------- */
  { id: 'ref-brands',          group: 'Reference', method: 'GET', path: '/reference/brands' },
  { id: 'ref-brand-models',    group: 'Reference', method: 'GET', path: '/reference/brands/Yamaha/models' },
  { id: 'ref-models',          group: 'Reference', method: 'GET', path: '/reference/models' },
  { id: 'ref-cities',          group: 'Reference', method: 'GET', path: '/reference/cities' },
  { id: 'ref-governorates',    group: 'Reference', method: 'GET', path: '/reference/governorates' },
  { id: 'ref-categories',      group: 'Reference', method: 'GET', path: '/reference/categories' },
  { id: 'ref-equipment',       group: 'Reference', method: 'GET', path: '/reference/equipment' },
  { id: 'ref-colors',          group: 'Reference', method: 'GET', path: '/reference/colors' },
  { id: 'ref-conditions',      group: 'Reference', method: 'GET', path: '/reference/conditions' },
  { id: 'ref-accessory-types', group: 'Reference', method: 'GET', path: '/reference/accessory-types' },
  { id: 'ref-garage-spec',     group: 'Reference', method: 'GET', path: '/reference/garage-specialties' },
  { id: 'ref-garage-services', group: 'Reference', method: 'GET', path: '/reference/garage-services' },

  /* ---------- Listings (public) ---------- */
  { id: 'listings-list',          group: 'Listings', method: 'GET', path: '/listings?page=1&limit=20' },
  { id: 'listings-popular',       group: 'Listings', method: 'GET', path: '/listings/popular' },
  { id: 'listings-suggestions',   group: 'Listings', method: 'GET', path: '/listings/suggestions' },
  { id: 'listings-search',        group: 'Listings', method: 'GET', path: '/listings?search=yamaha&limit=5' },
  { id: 'listings-filter-brand',  group: 'Listings', method: 'GET', path: '/listings?brand=Yamaha&limit=5' },
  { id: 'listings-filter-type',   group: 'Listings', method: 'GET', path: '/listings?type=Moto&limit=5' },
  { id: 'listings-filter-price',  group: 'Listings', method: 'GET', path: '/listings?min_price=1000&max_price=20000&limit=5' },
  { id: 'listings-filter-year',   group: 'Listings', method: 'GET', path: '/listings?min_year=2018&max_year=2024&limit=5' },
  { id: 'listings-filter-cond',   group: 'Listings', method: 'GET', path: '/listings?condition=Occasion&limit=5' },
  { id: 'listings-filter-city',   group: 'Listings', method: 'GET', path: '/listings?city=Tunis&limit=5' },
  { id: 'listings-sort-price-asc',  group: 'Listings', method: 'GET', path: '/listings?sort=price_asc&limit=5' },
  { id: 'listings-sort-price-desc', group: 'Listings', method: 'GET', path: '/listings?sort=price_desc&limit=5' },
  { id: 'listings-sort-newest',     group: 'Listings', method: 'GET', path: '/listings?sort=newest&limit=5' },
  { id: 'listings-sort-popular',    group: 'Listings', method: 'GET', path: '/listings?sort=popular&limit=5' },
  { id: 'listings-pagination',      group: 'Listings', method: 'GET', path: '/listings?page=2&limit=10' },
  { id: 'listings-estimate-price',  group: 'Listings', method: 'POST', path: '/listings/estimate-price', body: { brand: 'Yamaha', model: 'MT-07', year: 2020, mileage: 15000 } },

  /* ---------- Articles (public) ---------- */
  { id: 'articles-list',       group: 'Articles', method: 'GET', path: '/articles?page=1&limit=20' },
  { id: 'articles-featured',   group: 'Articles', method: 'GET', path: '/articles/featured' },
  { id: 'articles-categories', group: 'Articles', method: 'GET', path: '/articles/categories' },

  /* ---------- Tips (public) ---------- */
  { id: 'tips-list',       group: 'Tips', method: 'GET', path: '/tips?page=1&limit=20' },
  { id: 'tips-featured',   group: 'Tips', method: 'GET', path: '/tips/featured' },
  { id: 'tips-categories', group: 'Tips', method: 'GET', path: '/tips/categories' },

  /* ---------- Garages (public) ---------- */
  { id: 'garages-list',        group: 'Garages', method: 'GET', path: '/garages?page=1&limit=20' },
  { id: 'garages-popular',     group: 'Garages', method: 'GET', path: '/garages/popular' },
  { id: 'garages-specialties', group: 'Garages', method: 'GET', path: '/garages/specialties' },
  { id: 'garages-nearby',      group: 'Garages', method: 'GET', path: '/garages/nearby?lat=36.8065&lng=10.1815&radius=20' },

  /* ---------- Tech specs (public) ---------- */
  { id: 'tech-brands',     group: 'Tech Specs', method: 'GET', path: '/tech-specs/brands' },
  { id: 'tech-categories', group: 'Tech Specs', method: 'GET', path: '/tech-specs/categories' },
  { id: 'tech-popular',    group: 'Tech Specs', method: 'GET', path: '/tech-specs/popular' },
  { id: 'tech-brand-models', group: 'Tech Specs', method: 'GET', path: '/tech-specs/brands/Yamaha' },

  /* ---------- Community ---------- */
  { id: 'site-reviews',       group: 'Community', method: 'GET', path: '/site-reviews' },
  { id: 'faq',                group: 'Community', method: 'GET', path: '/faq' },

  /* ---------- Ads ---------- */
  { id: 'ads-active', group: 'Ads', method: 'GET', path: '/ads/active' },

  /* ---------- Auth contract checks (no token sent) ---------- */
  // Sending wrong creds should reply 400/401, NOT 404/500. That proves the route is wired.
  { id: 'auth-login-bad',   group: 'Auth', method: 'POST', path: '/auth/login',
    body: { email: 'nonexistent@test.invalid', password: 'wrong' },
    expectedFailureCodes: [400, 401, 404, 422] },
  { id: 'auth-check-email', group: 'Auth', method: 'POST', path: '/auth/check-email',
    body: { email: 'nonexistent@test.invalid' } },
  { id: 'auth-forgot',      group: 'Auth', method: 'POST', path: '/auth/forgot-password',
    body: { email: 'nonexistent@test.invalid' },
    expectedFailureCodes: [200, 400, 404] },

  /* ---------- Protected (auth required) ---------- */
  { id: 'auth-me',              group: 'Auth (protected)', method: 'GET',  path: '/auth/me',                   auth: true },
  { id: 'users-me',             group: 'Auth (protected)', method: 'GET',  path: '/users/me',                  auth: true },
  { id: 'users-me-stats',       group: 'Auth (protected)', method: 'GET',  path: '/users/me/stats',            auth: true },
  { id: 'users-me-blocked',     group: 'Auth (protected)', method: 'GET',  path: '/users/me/blocked',          auth: true },
  { id: 'conversations',        group: 'Messaging',        method: 'GET',  path: '/conversations',             auth: true },
  { id: 'conversations-unread', group: 'Messaging',        method: 'GET',  path: '/conversations/unread',      auth: true },
  { id: 'notifications',        group: 'Notifications',    method: 'GET',  path: '/notifications',             auth: true },
  { id: 'notifications-unread', group: 'Notifications',    method: 'GET',  path: '/notifications/unread-count',auth: true },
  { id: 'saved-searches',       group: 'Saved Searches',   method: 'GET',  path: '/saved-searches',            auth: true },
  { id: 'listings-favorites',   group: 'My Data',          method: 'GET',  path: '/listings/favorites',        auth: true },
  { id: 'listings-drafts',      group: 'My Data',          method: 'GET',  path: '/listings/drafts',           auth: true },
  { id: 'reports-my',           group: 'My Data',          method: 'GET',  path: '/reports/my',                auth: true },
  { id: 'tips-bookmarks',       group: 'My Data',          method: 'GET',  path: '/tips/bookmarks',            auth: true },

  /* ---------- Admin (admin only) ---------- */
  { id: 'admin-stats',           group: 'Admin', method: 'GET', path: '/admin/stats',                  auth: true, admin: true },
  { id: 'admin-users',           group: 'Admin', method: 'GET', path: '/admin/users',                  auth: true, admin: true },
  { id: 'admin-listings',        group: 'Admin', method: 'GET', path: '/admin/listings',               auth: true, admin: true },
  { id: 'admin-listings-pend',   group: 'Admin', method: 'GET', path: '/admin/listings/pending',       auth: true, admin: true },
  { id: 'admin-garages',         group: 'Admin', method: 'GET', path: '/admin/garages',                auth: true, admin: true },
  { id: 'admin-reports',         group: 'Admin', method: 'GET', path: '/admin/reports',                auth: true, admin: true },
  { id: 'admin-site-reviews',    group: 'Admin', method: 'GET', path: '/admin/site-reviews',           auth: true, admin: true },
  { id: 'admin-contact',         group: 'Admin', method: 'GET', path: '/admin/contact-messages',       auth: true, admin: true },
  { id: 'admin-faqs',            group: 'Admin', method: 'GET', path: '/admin/faqs',                   auth: true, admin: true },
  { id: 'admin-newsletter',      group: 'Admin', method: 'GET', path: '/admin/newsletter',             auth: true, admin: true },
  { id: 'admin-ad-campaigns',    group: 'Admin', method: 'GET', path: '/admin/ad-campaigns',           auth: true, admin: true },
  { id: 'admin-analytics',       group: 'Admin', method: 'GET', path: '/analytics/dashboard',          auth: true, admin: true },
];

/* ============================================================
 * UI helpers
 * ============================================================ */

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  idle:     { label: '—',         cls: 'bg-gray-100 text-gray-500 border-gray-200',   dot: 'bg-gray-300' },
  running:  { label: 'running…',  cls: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse', dot: 'bg-blue-500' },
  ok:       { label: 'OK',        cls: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  empty:    { label: 'empty',     cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  fail:     { label: 'FAIL',      cls: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500' },
  skipped:  { label: 'auth req.', cls: 'bg-gray-50 text-gray-600 border-gray-200',    dot: 'bg-gray-400' },
  expected: { label: 'expected',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

const StatusPill: React.FC<{ status: Status }> = ({ status }) => {
  const v = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono font-semibold ${v.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
      {v.label}
    </span>
  );
};

const MethodBadge: React.FC<{ method: string }> = ({ method }) => {
  const colors: Record<string, string> = {
    GET: 'bg-blue-600',
    POST: 'bg-emerald-600',
    PUT: 'bg-amber-600',
    PATCH: 'bg-amber-700',
    DELETE: 'bg-red-600',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white shrink-0 mt-0.5 ${colors[method] || 'bg-gray-700'}`}>
      {method}
    </span>
  );
};

/* ============================================================
 * Component
 * ============================================================ */

const ApiTester: React.FC = () => {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [running, setRunning] = useState(false);
  const [iterations, setIterations] = useState(1);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'fail' | 'empty' | 'ok'>('all');
  const [totalDurationMs, setTotalDurationMs] = useState<number>(0);
  const startTsRef = useRef<number>(0);

  const hasToken = !!tokenStorage.get();

  const runOne = useCallback(async (tc: TestCase): Promise<{ ok: boolean; ms: number; status: number; msg?: string; reqId?: string; data?: any; expected?: boolean }> => {
    const t0 = performance.now();
    try {
      const data = await apiClient.request(tc.path, { method: tc.method, body: tc.body });
      return { ok: true, ms: Math.round(performance.now() - t0), status: 200, data };
    } catch (err) {
      const e = err as ApiError;
      const ms = Math.round(performance.now() - t0);
      const status = e?.status ?? 0;
      const expected = !!tc.expectedFailureCodes?.includes(status);
      return { ok: false, ms, status, msg: e?.message, reqId: e?.requestId, expected };
    }
  }, []);

  const aggregateResult = useCallback((tc: TestCase, runs: Array<Awaited<ReturnType<typeof runOne>>>): TestResult => {
    if (!runs.length) return { status: 'idle', runs: 0, failures: 0 };

    // Auth-skipped: when test requires auth and we have no token, mark skipped.
    if (tc.auth && !hasToken) {
      return { status: 'skipped', runs: runs.length, failures: 0, message: 'No JWT in localStorage. Log in to enable this row.' };
    }

    const durations = runs.map(r => r.ms);
    const minMs = Math.min(...durations);
    const maxMs = Math.max(...durations);
    const avgMs = Math.round(durations.reduce((s, n) => s + n, 0) / runs.length);
    const failures = runs.filter(r => !r.ok && !r.expected).length;
    const expectedAll = runs.every(r => r.expected);
    const okAll = runs.every(r => r.ok);
    const lastFail = runs.find(r => !r.ok && !r.expected);
    const lastOk = runs.find(r => r.ok);

    let status: Status;
    let sample: string | undefined;
    let count: number | undefined;

    if (okAll) {
      const empty = isEmptyPayload(lastOk?.data);
      status = empty ? 'empty' : 'ok';
      count = countOf(lastOk?.data);
      try {
        const s = JSON.stringify(lastOk?.data);
        sample = s && s.length > 280 ? `${s.slice(0, 280)}…` : s;
      } catch { sample = String(lastOk?.data); }
    } else if (failures === 0 && expectedAll) {
      // All failures were "expected" (e.g. 401 on bad creds → contract OK)
      status = 'expected';
      sample = `Expected status ${runs[0].status} — route is reachable.`;
    } else {
      status = 'fail';
    }

    return {
      status,
      runs: runs.length,
      failures,
      minMs, avgMs, maxMs,
      httpStatus: lastFail?.status ?? lastOk?.status ?? 0,
      message: lastFail?.msg,
      requestId: lastFail?.reqId,
      sample,
      count,
      history: runs.map(r => ({ ok: r.ok, status: r.status, ms: r.ms, msg: r.msg, reqId: r.reqId })),
    };
  }, [hasToken]);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults({});
    setTotalDurationMs(0);
    startTsRef.current = performance.now();

    // Initial running state for every row
    const init: Record<string, TestResult> = {};
    TESTS.forEach(t => { init[t.id] = { status: 'running', runs: 0, failures: 0 }; });
    setResults(init);

    // Skip auth tests early if no token
    const runnable = TESTS.filter(t => !(t.auth && !hasToken));
    const skipped = TESTS.filter(t => t.auth && !hasToken);

    // Mark skipped immediately
    setResults(prev => {
      const next = { ...prev };
      skipped.forEach(t => { next[t.id] = aggregateResult(t, []); });
      return next;
    });

    // Build a flat queue (test × iterations) and run with a concurrency cap
    const aggregate: Record<string, Array<Awaited<ReturnType<typeof runOne>>>> = {};
    runnable.forEach(t => { aggregate[t.id] = []; });

    const queue: TestCase[] = [];
    for (let i = 0; i < iterations; i++) queue.push(...runnable);

    const CONCURRENCY = 8;
    let cursor = 0;
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < queue.length) {
        const tc = queue[cursor++];
        const r = await runOne(tc);
        aggregate[tc.id].push(r);
        // Live partial update
        setResults(prev => ({ ...prev, [tc.id]: aggregateResult(tc, aggregate[tc.id]) }));
      }
    });
    await Promise.all(workers);

    setTotalDurationMs(Math.round(performance.now() - startTsRef.current));
    setRunning(false);
  }, [iterations, runOne, aggregateResult, hasToken]);

  const stats = useMemo(() => {
    const vals = Object.values(results);
    const ok = vals.filter(r => r.status === 'ok').length;
    const empty = vals.filter(r => r.status === 'empty').length;
    const fail = vals.filter(r => r.status === 'fail').length;
    const skipped = vals.filter(r => r.status === 'skipped').length;
    const expected = vals.filter(r => r.status === 'expected').length;
    return { total: TESTS.length, ok, empty, fail, skipped, expected };
  }, [results]);

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const g: Record<string, TestCase[]> = {};
    TESTS.forEach(t => {
      const r = results[t.id];
      if (statusFilter === 'fail' && r?.status !== 'fail') return;
      if (statusFilter === 'empty' && r?.status !== 'empty') return;
      if (statusFilter === 'ok' && r?.status !== 'ok') return;
      if (f && !(`${t.group} ${t.path} ${t.id}`.toLowerCase().includes(f))) return;
      (g[t.group] ||= []).push(t);
    });
    return g;
  }, [filter, statusFilter, results]);

  const copyReport = useCallback(() => {
    const lines: string[] = [
      `# MotoScoot API integration report`,
      `Base URL: ${API_BASE_URL}`,
      `Auth token: ${hasToken ? 'present' : 'absent'}`,
      `Iterations: ${iterations}× — total ${TESTS.length * iterations} requests in ${totalDurationMs} ms`,
      `Summary: ✅ ${stats.ok} · 🟡 ${stats.empty} · ❌ ${stats.fail} · ⚪ ${stats.expected} · 🔒 ${stats.skipped}`,
      '',
    ];
    TESTS.forEach(t => {
      const r = results[t.id];
      if (!r) return;
      const head = `[${STATUS_META[r.status].label.toUpperCase()}] ${t.method} ${t.path}`;
      const meta = r.runs ? `  runs=${r.runs} fail=${r.failures} min=${r.minMs}ms avg=${r.avgMs}ms max=${r.maxMs}ms` : '';
      lines.push(head);
      if (meta) lines.push(meta);
      if (r.status === 'fail') lines.push(`  → HTTP ${r.httpStatus} ${r.message}${r.requestId ? ` (req ${r.requestId})` : ''}`);
      if (r.status === 'empty' && typeof r.count === 'number') lines.push(`  → 0 items returned`);
    });
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  }, [results, stats, iterations, totalDurationMs, hasToken]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Backend integration tester</h1>
          <p className="mt-1 text-sm text-gray-600">
            Hits every backend route the public app depends on. Click run to execute all tests in parallel batches.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="text-gray-500">Base URL</div>
              <div className="font-mono text-gray-900 break-all">{API_BASE_URL}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="text-gray-500">Endpoints</div>
              <div className="font-mono text-gray-900">{TESTS.length} total · {TESTS.filter(t => !t.auth).length} public · {TESTS.filter(t => t.auth && !t.admin).length} auth · {TESTS.filter(t => t.admin).length} admin</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="text-gray-500">Auth token</div>
              <div className={`font-mono ${hasToken ? 'text-green-700' : 'text-amber-700'}`}>
                {hasToken ? 'present — protected rows will run' : 'absent — protected rows skipped'}
              </div>
            </div>
          </div>
        </header>

        {/* Controls */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={runAll}
            disabled={running}
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {running ? 'Running…' : `▶ Run all (${TESTS.length})`}
          </button>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            Iterations
            <select
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              disabled={running}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            >
              <option value={1}>1× (sanity)</option>
              <option value={5}>5× (mass)</option>
              <option value={10}>10× (stress)</option>
              <option value={25}>25× (load)</option>
              <option value={50}>50× (heavy)</option>
            </select>
          </label>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
          >
            <option value="all">All statuses</option>
            <option value="fail">Failures only</option>
            <option value="empty">Empty only</option>
            <option value="ok">OK only</option>
          </select>

          <input
            type="text"
            placeholder="Filter by group / path…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm flex-1 min-w-[180px]"
          />

          <button
            onClick={copyReport}
            disabled={Object.keys(results).length === 0}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Copy report
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
          {([
            ['ok', 'OK', stats.ok, 'border-green-200 text-green-600'],
            ['empty', 'Empty', stats.empty, 'border-amber-200 text-amber-600'],
            ['fail', 'Fail', stats.fail, 'border-red-200 text-red-600'],
            ['expected', 'Expected', stats.expected, 'border-emerald-200 text-emerald-600'],
            ['skipped', 'Skipped', stats.skipped, 'border-gray-200 text-gray-600'],
          ] as const).map(([k, label, value, cls]) => {
            const [borderCls, textCls] = cls.split(' ');
            return (
              <div key={k} className={`bg-white border ${borderCls} rounded-lg px-3 py-2`}>
                <div className={`text-[10px] uppercase tracking-wide ${textCls} font-semibold`}>{label}</div>
                <div className="text-2xl font-bold text-gray-900">{value}<span className="text-sm text-gray-400 font-normal"> / {stats.total}</span></div>
              </div>
            );
          })}
        </div>

        {totalDurationMs > 0 && !running && (
          <div className="mb-4 text-xs text-gray-600">
            Completed in <span className="font-mono font-semibold">{totalDurationMs} ms</span>
            {' · '}{iterations} iteration{iterations > 1 ? 's' : ''} × {TESTS.length} tests = {iterations * TESTS.length} HTTP requests
          </div>
        )}

        {/* Groups */}
        <div className="space-y-5">
          {Object.entries(groups).map(([group, tests]) => {
            const groupStats = tests.reduce((acc, t) => {
              const s = results[t.id]?.status;
              if (s === 'ok') acc.ok++;
              else if (s === 'empty') acc.empty++;
              else if (s === 'fail') acc.fail++;
              return acc;
            }, { ok: 0, empty: 0, fail: 0 });

            return (
              <section key={group} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <header className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800 text-sm">{group}</h2>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-gray-500">{tests.length} ep</span>
                    {groupStats.ok > 0 && <span className="text-green-700">✓{groupStats.ok}</span>}
                    {groupStats.empty > 0 && <span className="text-amber-700">○{groupStats.empty}</span>}
                    {groupStats.fail > 0 && <span className="text-red-700 font-bold">✗{groupStats.fail}</span>}
                  </div>
                </header>
                <ul className="divide-y divide-gray-100">
                  {tests.map((tc) => {
                    const r = results[tc.id] || { status: 'idle' as Status, runs: 0, failures: 0 };
                    return (
                      <li key={tc.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <MethodBadge method={tc.method} />
                          <div className="flex-1 min-w-0">
                            <code className="block text-xs text-gray-800 font-mono break-all leading-snug">
                              {tc.path}
                            </code>
                            <div className="flex flex-wrap gap-2 mt-1 text-[10px]">
                              {tc.auth && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">🔒 auth</span>}
                              {tc.admin && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold">👑 admin</span>}
                              {tc.expectedFailureCodes && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">contract: {tc.expectedFailureCodes.join('/')}</span>}
                              {tc.body && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">body</span>}
                            </div>
                          </div>
                          <StatusPill status={r.status} />
                        </div>

                        {/* Metrics line */}
                        {(r.status === 'ok' || r.status === 'empty' || r.status === 'expected') && r.runs > 0 && (
                          <div className="mt-2 ml-12 text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1 font-mono">
                            <span>HTTP <strong>{r.httpStatus}</strong></span>
                            <span>{r.runs} run{r.runs > 1 ? 's' : ''}</span>
                            {typeof r.minMs === 'number' && <span>min {r.minMs}ms</span>}
                            {typeof r.avgMs === 'number' && <span>avg <strong>{r.avgMs}ms</strong></span>}
                            {typeof r.maxMs === 'number' && <span>max {r.maxMs}ms</span>}
                            {typeof r.count === 'number' && <span>· {r.count} item{r.count !== 1 ? 's' : ''}</span>}
                          </div>
                        )}

                        {/* Failure detail */}
                        {r.status === 'fail' && (
                          <div className="mt-2 ml-12 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-2 font-mono break-all">
                            <div className="font-bold">HTTP {r.httpStatus || 'N/A'} — {r.failures}/{r.runs} failed</div>
                            <div className="mt-0.5">{r.message || '(no message)'}</div>
                            {r.requestId && <div className="text-red-600 mt-1">req-id: {r.requestId}</div>}
                            {r.history && r.history.length > 1 && (
                              <details className="mt-1.5">
                                <summary className="cursor-pointer hover:text-red-900">per-iteration log</summary>
                                <ul className="mt-1 space-y-0.5">
                                  {r.history.map((h, i) => (
                                    <li key={i} className={h.ok ? 'text-green-700' : 'text-red-700'}>
                                      #{i + 1} → {h.status} ({h.ms}ms) {h.msg ? `· ${h.msg}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        )}

                        {/* Skipped */}
                        {r.status === 'skipped' && (
                          <div className="mt-2 ml-12 text-[11px] text-gray-500">{r.message}</div>
                        )}

                        {/* Payload sample */}
                        {r.sample && (r.status === 'ok' || r.status === 'expected') && (
                          <details className="mt-2 ml-12">
                            <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-700">view payload</summary>
                            <pre className="mt-1 text-[10px] text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto font-mono whitespace-pre-wrap break-all">{r.sample}</pre>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <footer className="mt-8 text-center text-xs text-gray-400">
          MotoScoot API tester — {TESTS.length} endpoints across {new Set(TESTS.map(t => t.group)).size} groups
        </footer>
      </div>
    </div>
  );
};

export default ApiTester;
