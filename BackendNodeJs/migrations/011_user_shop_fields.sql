-- 011_user_shop_fields.sql
-- Adds the missing Pro-account columns so professional sellers can persist
-- their shop name, address and logo at signup and from the dashboard.
--
-- Idempotent: safe to run multiple times.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS shop_name    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shop_address VARCHAR(500),
  ADD COLUMN IF NOT EXISTS shop_logo    TEXT;

-- Optional: speed up "find shop by name" lookups for the public garages page.
CREATE INDEX IF NOT EXISTS users_shop_name_idx ON users (LOWER(shop_name))
  WHERE shop_name IS NOT NULL;
