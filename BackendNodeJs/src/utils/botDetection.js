/**
 * Bot / crawler / preview-fetcher detection.
 *
 * Used by analytics ingestion endpoints to drop traffic from search engines,
 * AI crawlers, link previewers, monitoring services and headless tooling so
 * the admin "Audience" dashboard reflects real human visitors only.
 *
 * Conservative approach: we only flag user-agents that explicitly self-identify
 * as bots. We never block requests — we just tell the caller to skip writing
 * to analytics tables. Functional endpoints continue to work normally.
 */

// Known good/bad bots. Matched as a case-insensitive substring on the UA.
const BOT_UA_PATTERNS = [
  // Search engines
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'sogou', 'exabot', 'ia_archiver', 'archive.org_bot',
  // AI / LLM crawlers
  'gptbot', 'chatgpt-user', 'oai-searchbot', 'claudebot', 'claude-web',
  'anthropic-ai', 'perplexitybot', 'perplexity-user', 'google-extended',
  'applebot', 'applebot-extended', 'ccbot', 'cohere-ai', 'bytespider',
  'duckassistbot', 'amazonbot', 'diffbot', 'imagesiftbot', 'youbot',
  'meta-externalagent', 'meta-externalfetcher',
  // Social / link previewers
  'facebookexternalhit', 'facebookcatalog', 'twitterbot', 'linkedinbot',
  'whatsapp', 'telegrambot', 'discordbot', 'slackbot', 'pinterest',
  'redditbot', 'embedly', 'skypeuripreview',
  // Monitoring / SEO tools
  'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'rogerbot', 'screaming frog',
  'serpstatbot', 'sitebulb', 'awariobot', 'petalbot', 'datanyze', 'siteauditbot',
  'pingdom', 'uptimerobot', 'statuscake', 'newrelicpinger', 'site24x7',
  // Headless / scrapers / generic
  'headlesschrome', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
  'lighthouse', 'pagespeed', 'gtmetrix', 'curl/', 'wget/', 'python-requests',
  'node-fetch', 'axios/', 'go-http-client', 'java/', 'okhttp/', 'http_request2',
  'libwww-perl', 'httpclient', 'scrapy', 'apache-httpclient', 'postmanruntime',
  'insomnia',
  // Generic bot tokens (catch-all, case-insensitive substring)
  'bot/', ' bot ', 'crawler', 'spider',
];

/**
 * Returns true if the request looks like an automated/bot user-agent.
 * Empty / missing UA is also treated as a bot to keep server scripts and
 * curl probes out of the dashboard.
 */
function isBotRequest(req) {
  const ua = String(req.get?.('user-agent') || req.headers?.['user-agent'] || '').toLowerCase();
  if (!ua) return true;
  // Some Chromium-based browsers expose Sec-CH-UA values like "Not.A/Brand".
  // We rely on UA only; the tokens below are explicit bot identifiers.
  for (const token of BOT_UA_PATTERNS) {
    if (ua.includes(token)) return true;
  }
  return false;
}

module.exports = { isBotRequest };
