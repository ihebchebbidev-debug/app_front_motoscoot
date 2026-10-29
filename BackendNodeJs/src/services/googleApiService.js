/**
 * googleApiService — minimal Google API client backed by a Service Account
 * JSON credentials object (the file you download from Google Cloud Console).
 *
 * No external dependency: we mint the OAuth access token ourselves by
 * signing a JWT with Node's built-in `crypto`. Tokens are cached in-memory
 * for ~55 min (Google's max is 60 min).
 *
 * Supports two scopes used by this app:
 *   • analytics.readonly  → GA4 Data API (runReport)
 *   • webmasters.readonly → Search Console API (searchanalytics.query)
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// In-memory cache: scopeKey -> { token, expiresAt }
const tokenCache = new Map();

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseServiceAccount(input) {
  if (!input) throw new Error('Google service account credentials are not configured.');
  let creds = input;
  if (typeof input === 'string') {
    try { creds = JSON.parse(input); }
    catch { throw new Error('Service account JSON is malformed.'); }
  }
  if (!creds || !creds.client_email || !creds.private_key) {
    throw new Error('Service account JSON missing client_email or private_key.');
  }
  return creds;
}

async function getAccessToken(serviceAccount, scopes) {
  const creds = parseServiceAccount(serviceAccount);
  const scope = Array.isArray(scopes) ? scopes.join(' ') : String(scopes);
  const cacheKey = `${creds.client_email}::${scope}`;
  const now = Math.floor(Date.now() / 1000);

  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - 30 > now) return cached.token;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: creds.client_email,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Google service-account private keys are PEM with literal "\n" sequences
  // when stored as JSON — already real newlines after JSON.parse. Crypto
  // accepts either form natively.
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(creds.private_key.replace(/\\n/g, '\n'));

  const jwt = `${signingInput}.${b64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token exchange failed (${res.status}): ${data.error_description || data.error || res.statusText}`);
  }

  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 3600),
  });
  return data.access_token;
}

/**
 * GA4 Data API — runReport.
 * Docs: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
 */
async function ga4RunReport({ serviceAccount, propertyId, body }) {
  if (!propertyId) throw new Error('GA4 property ID is required.');
  const token = await getAccessToken(serviceAccount, ['https://www.googleapis.com/auth/analytics.readonly']);
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    throw new Error(`GA4 API error (${res.status}): ${msg}`);
  }
  return data;
}

/**
 * Search Console — searchanalytics.query.
 * Docs: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 */
async function gscQuery({ serviceAccount, siteUrl, body }) {
  if (!siteUrl) throw new Error('Search Console site URL is required.');
  const token = await getAccessToken(serviceAccount, ['https://www.googleapis.com/auth/webmasters.readonly']);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    throw new Error(`GSC API error (${res.status}): ${msg}`);
  }
  return data;
}

/**
 * GA4 Measurement Protocol — server-side event.
 * Docs: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
async function ga4SendEvent({ measurementId, apiSecret, clientId, events }) {
  if (!measurementId || !apiSecret) throw new Error('GA4 measurement ID and API secret are required.');
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId || crypto.randomUUID(),
      events: Array.isArray(events) ? events : [events],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    logger.warn(`GA4 MP send failed (${res.status}): ${txt}`);
    return false;
  }
  return true;
}

module.exports = { ga4RunReport, gscQuery, ga4SendEvent, parseServiceAccount };
