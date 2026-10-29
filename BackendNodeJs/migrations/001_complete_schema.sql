-- =====================================================
-- MotoScoot — COMPLETE database schema (single file)
-- Target: PostgreSQL 14+ (Neon, Supabase, RDS, local)
-- Idempotent: safe to run multiple times.
-- Run: npm run migrate
-- =====================================================

-- ============ EXTENSIONS ============
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('user', 'pro', 'admin', 'moderator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE listing_status AS ENUM ('draft', 'pending', 'active', 'sold', 'expired', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE listing_condition AS ENUM ('Neuf', 'État neuf', 'Excellent', 'Très bon', 'Bon', 'Correct', 'À réparer', 'Pour pièces');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE vehicle_type AS ENUM ('Moto', 'Scooter', 'Quad', 'Accessoires', 'Pièces');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE seller_type AS ENUM ('Particulier', 'Pro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE message_type AS ENUM ('text', 'image', 'offer', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE report_reason AS ENUM ('spam', 'fraud', 'inappropriate', 'duplicate', 'wrong_category', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE referral_source AS ENUM ('direct', 'google', 'facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'whatsapp', 'email', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE ad_zone AS ENUM ('news_top', 'search_feed', 'garage_sidebar', 'listing_sidebar', 'search_sidebar', 'home_banner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notification_type AS ENUM (
  'message','listing_status','listing_view','favorite','review','article','tip','system','ad','offer'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE contact_channel AS ENUM ('call','sms','whatsapp','message','email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ USERS ============
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  seller_type seller_type DEFAULT 'Particulier',
  city VARCHAR(100),
  governorate VARCHAR(100),
  bio TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  clerk_id VARCHAR(255) UNIQUE,
  provider VARCHAR(30) DEFAULT 'email',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- ============ LISTINGS ============
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  type vehicle_type NOT NULL,
  price INTEGER NOT NULL,
  condition listing_condition NOT NULL,
  year INTEGER,
  mileage INTEGER,
  cc INTEGER,
  color VARCHAR(50),
  city VARCHAR(100),
  governorate VARCHAR(100),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  images TEXT[] DEFAULT '{}',
  equipment TEXT[] DEFAULT '{}',
  status listing_status DEFAULT 'pending',
  is_featured BOOLEAN DEFAULT FALSE,
  deal_rating SMALLINT CHECK (deal_rating BETWEEN 1 AND 3),
  views_count INTEGER DEFAULT 0,
  favorites_count INTEGER DEFAULT 0,
  contacts_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_brand  ON listings(brand);
CREATE INDEX IF NOT EXISTS idx_listings_type   ON listings(type);
CREATE INDEX IF NOT EXISTS idx_listings_price  ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_user   ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_search ON listings USING gin(to_tsvector('french', title || ' ' || COALESCE(description, '')));

-- ============ FAVORITES ============
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- ============ LISTING TRACKING (contacts / shares / boosts) ============
CREATE TABLE IF NOT EXISTS listing_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  channel contact_channel NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listing_contacts_listing ON listing_contacts(listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS listing_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  platform VARCHAR(30),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_boosts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pack VARCHAR(50) NOT NULL,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  amount NUMERIC(10,2),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listing_boosts_active ON listing_boosts(listing_id, ends_at);

-- ============ CONVERSATIONS & MESSAGES ============
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  buyer_unread INTEGER DEFAULT 0,
  seller_unread INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, buyer_id, seller_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type message_type DEFAULT 'text',
  content TEXT,
  image_url TEXT,
  offer_amount INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);

-- ============ GARAGES ============
CREATE TABLE IF NOT EXISTS garages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  address TEXT,
  city VARCHAR(100),
  governorate VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  website TEXT,
  image TEXT,
  images TEXT[] DEFAULT '{}',
  specialties TEXT[] DEFAULT '{}',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  rating NUMERIC(2,1) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  hours TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS garage_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  garage_id UUID REFERENCES garages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS garage_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  garage_id UUID REFERENCES garages(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(200) NOT NULL,
  price VARCHAR(50)
);

-- ============ ARTICLES ============
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  slug VARCHAR(300) UNIQUE NOT NULL,
  summary TEXT,
  content TEXT,
  category VARCHAR(50) NOT NULL,
  image TEXT,
  tags TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  read_time VARCHAR(20),
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);

CREATE TABLE IF NOT EXISTS article_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, user_id)
);

CREATE TABLE IF NOT EXISTS article_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES article_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_article_comments_article ON article_comments(article_id, created_at DESC);

CREATE TABLE IF NOT EXISTS article_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  fingerprint VARCHAR(64),
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ TIPS ============
CREATE TABLE IF NOT EXISTS tips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  slug VARCHAR(300) UNIQUE NOT NULL,
  summary TEXT,
  content TEXT,
  category VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20) DEFAULT 'Débutant',
  tools TEXT[] DEFAULT '{}',
  image TEXT,
  read_time VARCHAR(20),
  is_published BOOLEAN DEFAULT FALSE,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  bookmarks_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tip_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tip_id UUID REFERENCES tips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tip_id, user_id)
);

CREATE TABLE IF NOT EXISTS tip_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tip_id UUID REFERENCES tips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tip_id, user_id)
);

CREATE TABLE IF NOT EXISTS tip_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tip_id UUID REFERENCES tips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  fingerprint VARCHAR(64),
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ TECH SPECS ============
CREATE TABLE IF NOT EXISTS tech_specs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL,
  price_new VARCHAR(50),
  image TEXT,
  gallery TEXT[] DEFAULT '{}',
  engine JSONB DEFAULT '{}',
  chassis JSONB DEFAULT '{}',
  electronics JSONB DEFAULT '{}',
  dimensions JSONB DEFAULT '{}',
  consumption VARCHAR(50),
  top_speed VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tech_specs_brand ON tech_specs(brand);

-- ============ AD CAMPAIGNS + GRANULAR TRACKING ============
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  client VARCHAR(200) NOT NULL,
  zone ad_zone NOT NULL,
  description TEXT,
  media_type VARCHAR(20) DEFAULT 'Image',
  media_url TEXT,
  link_url TEXT,
  cta_text VARCHAR(50),
  target_location VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_impressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE NOT NULL,
  session_id UUID,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign ON ad_impressions(campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ad_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE NOT NULL,
  session_id UUID,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign ON ad_clicks(campaign_id, created_at DESC);

-- ============ REPORTS / ADMIN LOGS ============
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  reason report_reason NOT NULL,
  details TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ ANALYTICS ============
CREATE TABLE IF NOT EXISTS visitor_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint VARCHAR(64),
  ip_address INET,
  country VARCHAR(100),
  city VARCHAR(100),
  device VARCHAR(50),
  browser VARCHAR(50),
  os VARCHAR(50),
  referral_source referral_source DEFAULT 'direct',
  referral_url TEXT,
  landing_page TEXT,
  duration_seconds INTEGER DEFAULT 0,
  pages_viewed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON visitor_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_fingerprint ON visitor_sessions(fingerprint);

CREATE TABLE IF NOT EXISTS visitor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint VARCHAR(64) UNIQUE,
  ip_address INET,
  country VARCHAR(100),
  city VARCHAR(100),
  total_visits INTEGER DEFAULT 1,
  total_duration INTEGER DEFAULT 0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type notification_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  link TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- ============ SAVED SEARCHES (alerts) ============
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100),
  filters JSONB NOT NULL DEFAULT '{}',
  alert_enabled BOOLEAN DEFAULT TRUE,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);

-- ============ SITE REVIEWS (testimonials) ============
CREATE TABLE IF NOT EXISTS site_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(100),
  avatar_url TEXT,
  content TEXT NOT NULL,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5) DEFAULT 5,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ CONTACT FORM ============
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ FAQ ============
CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question VARCHAR(300) NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  position INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_faqs_category_pos ON faqs(category, position);

-- ============ NEWSLETTER ============
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);

-- ============ REFERENCE DATA ============
CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT
);

INSERT INTO brands (name) VALUES
  ('Honda'),('Yamaha'),('Kawasaki'),('Suzuki'),('BMW'),('Ducati'),
  ('KTM'),('Harley-Davidson'),('Triumph'),('Aprilia'),('MV Agusta'),
  ('Piaggio'),('Vespa'),('Kymco'),('SYM'),('Peugeot'),('MBK'),
  ('Benelli'),('Royal Enfield'),('Husqvarna'),('Gas Gas'),('CFMOTO'),('Zero')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS models (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  UNIQUE(brand_id, name)
);
CREATE INDEX IF NOT EXISTS idx_models_brand ON models(brand_id);

CREATE TABLE IF NOT EXISTS equipment (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50)
);
INSERT INTO equipment (name, category) VALUES
  ('ABS','sécurité'),('Contrôle de traction','sécurité'),('Top case','rangement'),
  ('Pare-brise','confort'),('Selle chauffante','confort'),('Poignées chauffantes','confort'),
  ('GPS','électronique'),('Bluetooth','électronique'),('Phares LED','éclairage'),
  ('Antivol','sécurité'),('Alarme','sécurité'),('Coffre','rangement')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS colors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  hex VARCHAR(7)
);
INSERT INTO colors (name, hex) VALUES
  ('Noir','#000000'),('Blanc','#FFFFFF'),('Rouge','#E53935'),('Bleu','#1E88E5'),
  ('Vert','#43A047'),('Jaune','#FDD835'),('Orange','#FB8C00'),('Gris','#757575'),
  ('Argent','#BDBDBD'),('Or','#D4AF37'),('Marron','#6D4C41'),('Violet','#8E24AA')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS cities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  governorate VARCHAR(100) NOT NULL,
  UNIQUE(name, governorate)
);

INSERT INTO cities (name, governorate) VALUES
  ('Tunis','Tunis'),('Ariana','Ariana'),('Ben Arous','Ben Arous'),('Manouba','Manouba'),
  ('Sousse','Sousse'),('Sfax','Sfax'),('Nabeul','Nabeul'),('Bizerte','Bizerte'),
  ('Gabès','Gabès'),('Kairouan','Kairouan'),('Monastir','Monastir'),('Médenine','Médenine'),
  ('Béja','Béja'),('Jendouba','Jendouba'),('Le Kef','Le Kef'),('Siliana','Siliana'),
  ('Mahdia','Mahdia'),('Kasserine','Kasserine'),('Sidi Bouzid','Sidi Bouzid'),
  ('Gafsa','Gafsa'),('Tozeur','Tozeur'),('Kébili','Kébili'),('Tataouine','Tataouine'),('Zaghouan','Zaghouan')
ON CONFLICT (name, governorate) DO NOTHING;

-- =====================================================
-- END OF SCHEMA
-- =====================================================
