-- Views counter for actualités (articles) and conseils (tips).
-- `fingerprint` now holds a one-way, daily-salted visitor hash (see
-- src/utils/contentViews.js): one view per visitor, per content, per day.
-- These indexes keep the "already counted today?" check and the admin
-- "last 30 days" count fast. Idempotent.
CREATE INDEX IF NOT EXISTS idx_article_views_article_fp
  ON article_views (article_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_article_views_article_time
  ON article_views (article_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tip_views_tip_fp
  ON tip_views (tip_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_tip_views_tip_time
  ON tip_views (tip_id, viewed_at DESC);

