/**
 * site_settings — generic key/value store used (initially) for the
 * landing-page hero images. Two endpoints are exposed:
 *
 *   GET  /api/site-settings/hero            (public — used by the Hero component)
 *   PUT  /api/admin/site-settings/hero      (admin — set/clear desktop & mobile URLs)
 *
 * The `value` column is JSONB so we can grow this table without a migration
 * every time we add a new setting key.
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

const HERO_KEY = 'hero_images';

/* ---------- Public ---------- */
async function getHero(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT value, updated_at FROM site_settings WHERE key = $1 LIMIT 1`,
      [HERO_KEY]
    );
    if (rows.length === 0) {
      return res.json({ desktop_url: null, mobile_url: null, background_color: null, updated_at: null });
    }
    const v = rows[0].value || {};
    res.json({
      desktop_url: typeof v.desktop_url === 'string' ? v.desktop_url : null,
      mobile_url:  typeof v.mobile_url  === 'string' ? v.mobile_url  : null,
      background_color: typeof v.background_color === 'string' ? v.background_color : null,
      updated_at: rows[0].updated_at,
    });
  } catch (err) {
    logger.error('site_settings.getHero failed:', err.message);
    next(err);
  }
}

/* ---------- Admin ---------- */
function sanitizeUrl(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Accept both relative `/uploads/...` paths and absolute http(s) URLs.
  if (trimmed.startsWith('/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function sanitizeColor(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : null;
}

async function updateHero(req, res, next) {
  try {
    const desktop = sanitizeUrl(req.body?.desktop_url);
    const mobile  = sanitizeUrl(req.body?.mobile_url);
    const backgroundColor = sanitizeColor(req.body?.background_color);
    const userId  = req.user?.id || null;

    const value = { desktop_url: desktop, mobile_url: mobile, background_color: backgroundColor };

    await query(
      `INSERT INTO site_settings (key, value, updated_by)
            VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_by = EXCLUDED.updated_by`,
      [HERO_KEY, JSON.stringify(value), userId]
    );

    res.json({ ...value, updated_at: new Date().toISOString() });
  } catch (err) {
    logger.error('site_settings.updateHero failed:', err.message);
    next(err);
  }
}

/* ---------- Hero TEXTS (title / subtitle / badge suffix) ---------- */
const HERO_TEXTS_KEY = 'hero_texts';

function sanitizeText(input, max) {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'string') return null;
  const trimmed = input.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

async function getHeroTexts(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT value, updated_at FROM site_settings WHERE key = $1 LIMIT 1`,
      [HERO_TEXTS_KEY]
    );
    if (rows.length === 0) {
      return res.json({ title: null, subtitle: null, badge_suffix: null, updated_at: null });
    }
    const v = rows[0].value || {};
    res.json({
      title:        typeof v.title === 'string' ? v.title : null,
      subtitle:     typeof v.subtitle === 'string' ? v.subtitle : null,
      badge_suffix: typeof v.badge_suffix === 'string' ? v.badge_suffix : null,
      updated_at:   rows[0].updated_at,
    });
  } catch (err) {
    logger.error('site_settings.getHeroTexts failed:', err.message);
    next(err);
  }
}

async function updateHeroTexts(req, res, next) {
  try {
    const value = {
      title:        sanitizeText(req.body?.title, 200),
      subtitle:     sanitizeText(req.body?.subtitle, 400),
      badge_suffix: sanitizeText(req.body?.badge_suffix, 80),
    };
    const userId = req.user?.id || null;

    await query(
      `INSERT INTO site_settings (key, value, updated_by)
            VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_by = EXCLUDED.updated_by`,
      [HERO_TEXTS_KEY, JSON.stringify(value), userId]
    );

    res.json({ ...value, updated_at: new Date().toISOString() });
  } catch (err) {
    logger.error('site_settings.updateHeroTexts failed:', err.message);
    next(err);
  }
}

/* ---------- App background colour (the global "gray" shell) ---------- */
const APP_BG_KEY = 'app_background';

async function getAppBackground(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT value, updated_at FROM site_settings WHERE key = $1 LIMIT 1`,
      [APP_BG_KEY]
    );
    if (rows.length === 0) {
      return res.json({ color: null, updated_at: null });
    }
    const v = rows[0].value || {};
    res.json({
      color: typeof v.color === 'string' ? v.color : null,
      updated_at: rows[0].updated_at,
    });
  } catch (err) {
    logger.error('site_settings.getAppBackground failed:', err.message);
    next(err);
  }
}

async function updateAppBackground(req, res, next) {
  try {
    const color  = sanitizeColor(req.body?.color);
    const userId = req.user?.id || null;
    const value  = { color };

    await query(
      `INSERT INTO site_settings (key, value, updated_by)
            VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_by = EXCLUDED.updated_by`,
      [APP_BG_KEY, JSON.stringify(value), userId]
    );

    res.json({ color, updated_at: new Date().toISOString() });
  } catch (err) {
    logger.error('site_settings.updateAppBackground failed:', err.message);
    next(err);
  }
}

/* ---------- Footer social links ---------- */
const SOCIAL_KEY = 'social_links';
const SOCIAL_NETWORKS = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x'];

async function getSocialLinks(_req, res, next) {
  try {
    const { rows } = await query(`SELECT value FROM site_settings WHERE key = $1 LIMIT 1`, [SOCIAL_KEY]);
    const v = (rows[0] && rows[0].value) || {};
    const out = {};
    for (const k of SOCIAL_NETWORKS) out[k] = typeof v[k] === 'string' && v[k] ? v[k] : null;
    res.set('Cache-Control', 'public, max-age=300');
    res.json(out);
  } catch (err) { next(err); }
}

async function updateSocialLinks(req, res, next) {
  try {
    const value = {};
    for (const k of SOCIAL_NETWORKS) {
      const raw = req.body?.[k];
      if (raw === null || raw === undefined || String(raw).trim() === '') { value[k] = null; continue; }
      const t = String(raw).trim();
      if (!/^https:\/\/[^\s]+$/i.test(t)) return res.status(400).json({ error: `Lien ${k} invalide (doit commencer par https://)` });
      value[k] = t.slice(0, 500);
    }
    await query(
      `INSERT INTO site_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
      [SOCIAL_KEY, JSON.stringify(value), req.user?.id || null]
    );
    res.json(value);
  } catch (err) { next(err); }
}

module.exports = {
  getSocialLinks, updateSocialLinks,
  getHero, updateHero,
  getHeroTexts, updateHeroTexts,
  getAppBackground, updateAppBackground,
};
