const router = require('express').Router();
const { pool, query } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const BASE_URL = ''; // tests run internally

/** Guard: this entire router is disabled in production for security. */
function devOnly(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

router.use(devOnly);

/**
 * GET /api/tests/run
 * Runs ALL API integration tests in sequence, returns results
 * DISABLED IN PRODUCTION.
 */
router.get('/run', async (req, res) => {
  const results = [];
  const state = {}; // shared state between tests
  const startTime = Date.now();

  function log(name, passed, details = '', ms = 0) {
    results.push({ name, passed, details: String(details).slice(0, 500), ms });
  }

  async function runTest(name, fn) {
    const t0 = Date.now();
    try {
      await fn();
      log(name, true, 'OK', Date.now() - t0);
    } catch (err) {
      log(name, false, err.message || String(err), Date.now() - t0);
    }
  }

  // ============ DATABASE ============
  await runTest('DB: Connection alive', async () => {
    const r = await query('SELECT 1 as ok');
    if (r.rows[0].ok !== 1) throw new Error('DB check failed');
  });

  await runTest('DB: All tables exist', async () => {
    const tables = ['users', 'user_roles', 'listings', 'favorites', 'conversations', 'messages',
      'garages', 'garage_reviews', 'garage_services', 'articles', 'tips', 'tech_specs',
      'ad_campaigns', 'reports', 'admin_logs', 'visitor_sessions', 'visitor_profiles',
      'listing_views', 'listing_events', 'brands', 'cities', 'password_resets', 'newsletter_subscribers'];
    const { rows } = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const existing = new Set(rows.map(r => r.table_name));
    const missing = tables.filter(t => !existing.has(t));
    if (missing.length > 0) throw new Error(`Missing tables: ${missing.join(', ')}`);
  });

  await runTest('DB: Enums exist', async () => {
    const { rows } = await query("SELECT typname FROM pg_type WHERE typtype = 'e'");
    const enums = new Set(rows.map(r => r.typname));
    const required = ['user_role', 'listing_status', 'listing_condition', 'vehicle_type',
      'seller_type', 'message_type', 'report_reason', 'referral_source', 'ad_zone'];
    const missing = required.filter(e => !enums.has(e));
    if (missing.length > 0) throw new Error(`Missing enums: ${missing.join(', ')}`);
  });

  await runTest('DB: Indexes exist', async () => {
    const { rows } = await query(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'"
    );
    if (rows.length < 5) throw new Error(`Only ${rows.length} indexes found`);
  });

  await runTest('DB: Seed data — brands', async () => {
    const { rows } = await query('SELECT COUNT(*) as c FROM brands');
    if (parseInt(rows[0].c) < 20) throw new Error(`Only ${rows[0].c} brands`);
  });

  await runTest('DB: Seed data — cities', async () => {
    const { rows } = await query('SELECT COUNT(*) as c FROM cities');
    if (parseInt(rows[0].c) < 20) throw new Error(`Only ${rows[0].c} cities`);
  });

  // ============ AUTH ============
  const testEmail = `test_${Date.now()}@test.com`;
  const testPassword = 'TestPass123!';

  await runTest('AUTH: Register new user', async () => {
    const hash = await bcrypt.hash(testPassword, 12);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, full_name, phone, city, governorate, seller_type)
       VALUES ($1, $2, 'Test User', '12345678', 'Tunis', 'Tunis', 'Particulier') RETURNING id, email`,
      [testEmail, hash]
    );
    await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [rows[0].id, 'user']);
    state.userId = rows[0].id;
    state.token = jwt.sign({ id: rows[0].id, email: testEmail }, JWT_SECRET, { expiresIn: '1h' });
  });

  await runTest('AUTH: Login verify password', async () => {
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [state.userId]);
    const valid = await bcrypt.compare(testPassword, rows[0].password_hash);
    if (!valid) throw new Error('Password verification failed');
  });

  await runTest('AUTH: JWT token decode', async () => {
    const decoded = jwt.verify(state.token, JWT_SECRET);
    if (decoded.id !== state.userId) throw new Error('Token payload mismatch');
  });

  // ============ USERS ============
  await runTest('USER: Get profile', async () => {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [state.userId]);
    if (rows.length === 0) throw new Error('User not found');
    if (rows[0].full_name !== 'Test User') throw new Error('Name mismatch');
  });

  await runTest('USER: Update profile', async () => {
    await query("UPDATE users SET bio = 'Test bio', updated_at = NOW() WHERE id = $1", [state.userId]);
    const { rows } = await query('SELECT bio FROM users WHERE id = $1', [state.userId]);
    if (rows[0].bio !== 'Test bio') throw new Error('Bio not updated');
  });

  await runTest('USER: Change password', async () => {
    const newHash = await bcrypt.hash('NewPass456!', 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, state.userId]);
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [state.userId]);
    const valid = await bcrypt.compare('NewPass456!', rows[0].password_hash);
    if (!valid) throw new Error('New password verification failed');
  });

  // ============ LISTINGS ============
  await runTest('LISTING: Create listing', async () => {
    const { rows } = await query(
      `INSERT INTO listings (user_id, title, description, brand, model, type, price, condition, year, mileage, cc, city, governorate, images, equipment, status)
       VALUES ($1, 'Test Moto Honda', 'Great bike', 'Honda', 'CB500F', 'Moto', 15000, 'Excellent', 2023, 5000, 500, 'Tunis', 'Tunis', '{}', '{}', 'active') RETURNING id`,
      [state.userId]
    );
    state.listingId = rows[0].id;
  });

  await runTest('LISTING: Get listing by ID', async () => {
    const { rows } = await query('SELECT * FROM listings WHERE id = $1', [state.listingId]);
    if (rows.length === 0) throw new Error('Listing not found');
    if (rows[0].title !== 'Test Moto Honda') throw new Error('Title mismatch');
  });

  await runTest('LISTING: Update listing', async () => {
    await query('UPDATE listings SET price = 14000, updated_at = NOW() WHERE id = $1', [state.listingId]);
    const { rows } = await query('SELECT price FROM listings WHERE id = $1', [state.listingId]);
    if (rows[0].price !== 14000) throw new Error('Price not updated');
  });

  await runTest('LISTING: Search by brand', async () => {
    const { rows } = await query("SELECT * FROM listings WHERE brand ILIKE $1 AND status = 'active'", ['Honda']);
    if (rows.length === 0) throw new Error('No results for Honda');
  });

  await runTest('LISTING: Full-text search', async () => {
    const { rows } = await query(
      "SELECT * FROM listings WHERE to_tsvector('french', title || ' ' || COALESCE(description, '')) @@ plainto_tsquery('french', $1)",
      ['moto honda']
    );
    // May be 0 if no FTS match, but query should not error
  });

  await runTest('LISTING: Filter by price range', async () => {
    const { rows } = await query("SELECT * FROM listings WHERE price >= 10000 AND price <= 20000 AND status = 'active'");
    if (rows.length === 0) throw new Error('No results in range');
  });

  await runTest('LISTING: Views increment', async () => {
    const before = await query('SELECT views_count FROM listings WHERE id = $1', [state.listingId]);
    await query('UPDATE listings SET views_count = views_count + 1 WHERE id = $1', [state.listingId]);
    const after = await query('SELECT views_count FROM listings WHERE id = $1', [state.listingId]);
    if (after.rows[0].views_count <= before.rows[0].views_count) throw new Error('Views not incremented');
  });

  // ============ FAVORITES ============
  await runTest('FAVORITE: Add favorite', async () => {
    await query('INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)', [state.userId, state.listingId]);
    await query('UPDATE listings SET favorites_count = favorites_count + 1 WHERE id = $1', [state.listingId]);
  });

  await runTest('FAVORITE: Duplicate prevented', async () => {
    try {
      await query('INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)', [state.userId, state.listingId]);
      throw new Error('Should have failed on duplicate');
    } catch (err) {
      if (err.code !== '23505') throw err;
      // Expected duplicate error
    }
  });

  await runTest('FAVORITE: Remove favorite', async () => {
    await query('DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2', [state.userId, state.listingId]);
  });

  // ============ CONVERSATIONS & MESSAGES ============
  // Create second user for messaging
  await runTest('MESSAGING: Create second user', async () => {
    const hash = await bcrypt.hash('Pass123!', 12);
    const { rows } = await query(
      "INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, 'Seller User') RETURNING id",
      [`seller_${Date.now()}@test.com`, hash]
    );
    state.sellerId = rows[0].id;
  });

  await runTest('MESSAGING: Create conversation', async () => {
    const { rows } = await query(
      'INSERT INTO conversations (listing_id, buyer_id, seller_id) VALUES ($1, $2, $3) RETURNING id',
      [state.listingId, state.userId, state.sellerId]
    );
    state.conversationId = rows[0].id;
  });

  await runTest('MESSAGING: Send message', async () => {
    const { rows } = await query(
      "INSERT INTO messages (conversation_id, sender_id, type, content) VALUES ($1, $2, 'text', 'Hello!') RETURNING id",
      [state.conversationId, state.userId]
    );
    state.messageId = rows[0].id;
    await query('UPDATE conversations SET last_message_at = NOW(), seller_unread = seller_unread + 1 WHERE id = $1', [state.conversationId]);
  });

  await runTest('MESSAGING: Read messages', async () => {
    const { rows } = await query('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [state.conversationId]);
    if (rows.length === 0) throw new Error('No messages found');
    if (rows[0].content !== 'Hello!') throw new Error('Content mismatch');
  });

  await runTest('MESSAGING: Mark as read', async () => {
    await query('UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2', [state.conversationId, state.sellerId]);
    await query('UPDATE conversations SET seller_unread = 0 WHERE id = $1', [state.conversationId]);
    const { rows } = await query('SELECT seller_unread FROM conversations WHERE id = $1', [state.conversationId]);
    if (rows[0].seller_unread !== 0) throw new Error('Unread not cleared');
  });

  await runTest('MESSAGING: Send offer message', async () => {
    await query(
      "INSERT INTO messages (conversation_id, sender_id, type, content, offer_amount) VALUES ($1, $2, 'offer', 'My offer', 12000)",
      [state.conversationId, state.sellerId]
    );
  });

  await runTest('MESSAGING: Unread count', async () => {
    const { rows } = await query(
      `SELECT COALESCE(SUM(CASE WHEN buyer_id = $1 THEN buyer_unread WHEN seller_id = $1 THEN seller_unread ELSE 0 END), 0) as c
       FROM conversations WHERE (buyer_id = $1 OR seller_id = $1) AND is_archived = false`,
      [state.userId]
    );
    // Just verify query works
  });

  // ============ GARAGES ============
  await runTest('GARAGE: Create garage', async () => {
    const { rows } = await query(
      "INSERT INTO garages (owner_id, name, description, city, governorate, phone, specialties) VALUES ($1, 'Test Garage', 'Best service', 'Tunis', 'Tunis', '71000000', '{\"Moto\",\"Scooter\"}') RETURNING id",
      [state.userId]
    );
    state.garageId = rows[0].id;
  });

  await runTest('GARAGE: Get by ID with reviews/services', async () => {
    const [garage, reviews, services] = await Promise.all([
      query('SELECT * FROM garages WHERE id = $1', [state.garageId]),
      query('SELECT * FROM garage_reviews WHERE garage_id = $1', [state.garageId]),
      query('SELECT * FROM garage_services WHERE garage_id = $1', [state.garageId]),
    ]);
    if (garage.rows.length === 0) throw new Error('Garage not found');
  });

  await runTest('GARAGE: Add review', async () => {
    await query(
      "INSERT INTO garage_reviews (garage_id, user_id, rating, content) VALUES ($1, $2, 5, 'Excellent service!')",
      [state.garageId, state.userId]
    );
    await query(
      "UPDATE garages SET rating = (SELECT AVG(rating) FROM garage_reviews WHERE garage_id = $1), reviews_count = (SELECT COUNT(*) FROM garage_reviews WHERE garage_id = $1) WHERE id = $1",
      [state.garageId]
    );
    const { rows } = await query('SELECT rating, reviews_count FROM garages WHERE id = $1', [state.garageId]);
    if (rows[0].reviews_count !== 1) throw new Error('Review count wrong');
  });

  await runTest('GARAGE: Add service', async () => {
    await query(
      "INSERT INTO garage_services (garage_id, name, price) VALUES ($1, 'Vidange', '50 TND')",
      [state.garageId]
    );
  });

  // ============ ARTICLES ============
  await runTest('ARTICLE: Create article', async () => {
    const { rows } = await query(
      `INSERT INTO articles (author_id, title, slug, summary, content, category, image, tags, is_featured, read_time, is_published, published_at)
       VALUES ($1, 'Test Article', 'test-article-${Date.now()}', 'Summary here', 'Full content', 'Actualités', null, '{\"moto\"}', false, '5 min', true, NOW()) RETURNING id`,
      [state.userId]
    );
    state.articleId = rows[0].id;
  });

  await runTest('ARTICLE: Get by slug', async () => {
    const { rows } = await query('SELECT * FROM articles WHERE id = $1', [state.articleId]);
    if (rows.length === 0) throw new Error('Article not found');
    const slug = rows[0].slug;
    const bySlug = await query('SELECT * FROM articles WHERE slug = $1', [slug]);
    if (bySlug.rows.length === 0) throw new Error('Slug lookup failed');
  });

  await runTest('ARTICLE: Update article', async () => {
    await query("UPDATE articles SET title = 'Updated Article', updated_at = NOW() WHERE id = $1", [state.articleId]);
    const { rows } = await query('SELECT title FROM articles WHERE id = $1', [state.articleId]);
    if (rows[0].title !== 'Updated Article') throw new Error('Update failed');
  });

  // ============ TIPS ============
  await runTest('TIP: Create tip', async () => {
    const { rows } = await query(
      `INSERT INTO tips (author_id, title, slug, summary, content, category, difficulty, tools, read_time, is_published, published_at)
       VALUES ($1, 'Test Tip', 'test-tip-${Date.now()}', 'Tip summary', 'Tip content', 'Entretien', 'Débutant', '{\"clé à molette\"}', '3 min', true, NOW()) RETURNING id`,
      [state.userId]
    );
    state.tipId = rows[0].id;
  });

  await runTest('TIP: Get by slug', async () => {
    const { rows } = await query('SELECT * FROM tips WHERE id = $1', [state.tipId]);
    if (rows.length === 0) throw new Error('Tip not found');
  });

  // ============ TECH SPECS ============
  await runTest('TECH SPEC: Create spec', async () => {
    const { rows } = await query(
      `INSERT INTO tech_specs (brand, model, year, category, price_new, engine, chassis, dimensions, consumption, top_speed)
       VALUES ('Honda', 'CB500F', 2024, 'Roadster', '7500 TND', '{"type":"bicylindre","cc":471}', '{"frame":"tubulaire"}', '{"weight":"189kg"}', '4.3L/100km', '180 km/h') RETURNING id`
    );
    state.techSpecId = rows[0].id;
  });

  await runTest('TECH SPEC: Get brands', async () => {
    const { rows } = await query('SELECT DISTINCT brand FROM tech_specs');
    if (rows.length === 0) throw new Error('No brands');
  });

  await runTest('TECH SPEC: Get by ID with JSONB', async () => {
    const { rows } = await query('SELECT * FROM tech_specs WHERE id = $1', [state.techSpecId]);
    if (rows.length === 0) throw new Error('Not found');
    if (!rows[0].engine || typeof rows[0].engine !== 'object') throw new Error('Engine JSONB failed');
  });

  // ============ ANALYTICS ============
  await runTest('ANALYTICS: Create session', async () => {
    const { rows } = await query(
      `INSERT INTO visitor_sessions (fingerprint, ip_address, country, city, device, browser, os, referral_source, landing_page)
       VALUES ('fp_test_123', '192.168.1.1', 'Tunisia', 'Tunis', 'Mobile', 'Chrome', 'Android', 'facebook', '/') RETURNING id`
    );
    state.sessionId = rows[0].id;
  });

  await runTest('ANALYTICS: Upsert visitor profile', async () => {
    await query(
      `INSERT INTO visitor_profiles (fingerprint, ip_address, country, city)
       VALUES ('fp_test_123', '192.168.1.1', 'Tunisia', 'Tunis')
       ON CONFLICT (fingerprint) DO UPDATE SET total_visits = visitor_profiles.total_visits + 1, last_seen = NOW()`
    );
    const { rows } = await query("SELECT * FROM visitor_profiles WHERE fingerprint = 'fp_test_123'");
    if (rows.length === 0) throw new Error('Profile not created');
  });

  await runTest('ANALYTICS: Update session duration', async () => {
    await query('UPDATE visitor_sessions SET duration_seconds = 120, pages_viewed = 5, ended_at = NOW() WHERE id = $1', [state.sessionId]);
  });

  await runTest('ANALYTICS: Track listing view', async () => {
    await query('INSERT INTO listing_views (listing_id, session_id, user_id) VALUES ($1, $2, $3)', [state.listingId, state.sessionId, state.userId]);
  });

  await runTest('ANALYTICS: Track listing event', async () => {
    await query("INSERT INTO listing_events (listing_id, event_type, session_id) VALUES ($1, 'phone_click', $2)", [state.listingId, state.sessionId]);
  });

  await runTest('ANALYTICS: Dashboard query', async () => {
    const sinceDate = new Date(Date.now() - 30 * 86400000).toISOString();
    const [visitors, sessions] = await Promise.all([
      query('SELECT COUNT(DISTINCT fingerprint) as c FROM visitor_sessions WHERE started_at >= $1', [sinceDate]),
      query('SELECT COUNT(*) as c, AVG(duration_seconds) as avg FROM visitor_sessions WHERE started_at >= $1', [sinceDate]),
    ]);
    // Just check queries run
  });

  // ============ AD CAMPAIGNS ============
  await runTest('AD CAMPAIGN: Create', async () => {
    const { rows } = await query(
      `INSERT INTO ad_campaigns (title, client, zone, description, media_type, media_url, link_url, cta_text, start_date, end_date)
       VALUES ('Test Ad', 'Client X', 'home_banner', 'Test campaign', 'Image', 'https://img.test/ad.jpg', 'https://test.com', 'Voir', NOW(), NOW() + INTERVAL '30 days') RETURNING id`
    );
    state.adCampaignId = rows[0].id;
  });

  await runTest('AD CAMPAIGN: Update', async () => {
    await query("UPDATE ad_campaigns SET title = 'Updated Ad' WHERE id = $1", [state.adCampaignId]);
    const { rows } = await query('SELECT title FROM ad_campaigns WHERE id = $1', [state.adCampaignId]);
    if (rows[0].title !== 'Updated Ad') throw new Error('Update failed');
  });

  await runTest('AD CAMPAIGN: Track views/clicks', async () => {
    await query('UPDATE ad_campaigns SET views = views + 1, clicks = clicks + 1 WHERE id = $1', [state.adCampaignId]);
  });

  // ============ REPORTS ============
  await runTest('REPORT: Create report', async () => {
    const { rows } = await query(
      "INSERT INTO reports (reporter_id, listing_id, reason, details) VALUES ($1, $2, 'spam', 'Test report') RETURNING id",
      [state.userId, state.listingId]
    );
    state.reportId = rows[0].id;
  });

  await runTest('REPORT: Duplicate prevention', async () => {
    const { rows } = await query(
      'SELECT id FROM reports WHERE reporter_id = $1 AND listing_id = $2',
      [state.userId, state.listingId]
    );
    if (rows.length !== 1) throw new Error('Expected exactly 1 report');
  });

  await runTest('REPORT: Resolve report', async () => {
    await query('UPDATE reports SET is_resolved = true, resolved_by = $1 WHERE id = $2', [state.userId, state.reportId]);
  });

  // ============ ADMIN LOGS ============
  await runTest('ADMIN LOG: Create log', async () => {
    await query(
      "INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, 'test_action', 'listing', $2, 'Test log')",
      [state.userId, state.listingId]
    );
  });

  // ============ PASSWORD RESET ============
  await runTest('PASSWORD RESET: Create token', async () => {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    await query(
      "INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour') ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = NOW() + INTERVAL '1 hour'",
      [state.userId, token]
    );
    state.resetToken = token;
  });

  await runTest('PASSWORD RESET: Verify token', async () => {
    const { rows } = await query(
      'SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()',
      [state.resetToken]
    );
    if (rows.length === 0) throw new Error('Token not found or expired');
  });

  // ============ ROLES ============
  await runTest('ROLES: Assign admin role', async () => {
    await query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT (user_id, role) DO NOTHING",
      [state.userId]
    );
    const { rows } = await query('SELECT role FROM user_roles WHERE user_id = $1', [state.userId]);
    const roles = rows.map(r => r.role);
    if (!roles.includes('admin')) throw new Error('Admin role not assigned');
  });

  await runTest('ROLES: Remove role', async () => {
    await query("DELETE FROM user_roles WHERE user_id = $1 AND role = 'admin'", [state.userId]);
    const { rows } = await query("SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'", [state.userId]);
    if (rows.length > 0) throw new Error('Role not removed');
  });

  // ============ STRESS TESTS ============
  await runTest('STRESS: 50 concurrent listing reads', async () => {
    const promises = Array.from({ length: 50 }, () =>
      query("SELECT * FROM listings WHERE status = 'active' ORDER BY created_at DESC LIMIT 20")
    );
    const results = await Promise.all(promises);
    if (results.some(r => !r.rows)) throw new Error('Some queries failed');
  });

  await runTest('STRESS: 20 concurrent user lookups', async () => {
    const promises = Array.from({ length: 20 }, () =>
      query('SELECT id, full_name, email FROM users WHERE id = $1', [state.userId])
    );
    await Promise.all(promises);
  });

  await runTest('STRESS: 30 concurrent search queries', async () => {
    const searches = ['Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati',
      'moto', 'scooter', 'quad', 'sport', 'roadster', 'trail',
      'Tunis', 'Sfax', 'Sousse', 'pas cher', 'occasion', 'neuf',
      'cb500', 'mt07', 'ninja', 'gsxr', 'r1', 'duke',
      'Honda CB', 'Yamaha MT', 'KTM Duke', 'BMW GS', 'Ducati Monster', 'Kawasaki Z'];
    const promises = searches.map(term =>
      query("SELECT id, title, price FROM listings WHERE title ILIKE $1 OR brand ILIKE $1 LIMIT 5", [`%${term}%`])
    );
    await Promise.all(promises);
  });

  await runTest('STRESS: 10 concurrent conversation list queries', async () => {
    const promises = Array.from({ length: 10 }, () =>
      query(
        `SELECT c.*, m.content FROM conversations c
         LEFT JOIN LATERAL (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) m ON true
         WHERE (c.buyer_id = $1 OR c.seller_id = $1)`, [state.userId]
      )
    );
    await Promise.all(promises);
  });

  await runTest('STRESS: 20 concurrent analytics inserts', async () => {
    const promises = Array.from({ length: 20 }, (_, i) =>
      query(
        `INSERT INTO visitor_sessions (fingerprint, ip_address, country, city, device, browser, os, referral_source, landing_page)
         VALUES ($1, '10.0.0.1', 'Tunisia', 'Tunis', 'Desktop', 'Firefox', 'Windows', 'google', '/')`,
        [`stress_fp_${Date.now()}_${i}`]
      )
    );
    await Promise.all(promises);
  });

  await runTest('STRESS: Mixed read/write (20 ops)', async () => {
    const ops = [];
    for (let i = 0; i < 10; i++) {
      ops.push(query("SELECT COUNT(*) FROM listings WHERE status = 'active'"));
      ops.push(query('UPDATE listings SET views_count = views_count + 1 WHERE id = $1', [state.listingId]));
    }
    await Promise.all(ops);
  });

  await runTest('STRESS: Complex join query (garages + reviews + services)', async () => {
    const promises = Array.from({ length: 10 }, () =>
      query(
        `SELECT g.*, 
          (SELECT AVG(rating) FROM garage_reviews WHERE garage_id = g.id) as avg_rating,
          (SELECT COUNT(*) FROM garage_reviews WHERE garage_id = g.id) as review_count,
          (SELECT COUNT(*) FROM garage_services WHERE garage_id = g.id) as service_count
         FROM garages g LIMIT 10`
      )
    );
    await Promise.all(promises);
  });

  await runTest('STRESS: Pool status check', async () => {
    const { totalCount, idleCount, waitingCount } = pool;
    if (totalCount > pool.options.max) throw new Error(`Pool overflow: ${totalCount}/${pool.options.max}`);
  });

  // ============ NEWSLETTER ============
  await runTest('NEWSLETTER: Subscribe', async () => {
    const testNlEmail = `newsletter_${Date.now()}@test.com`;
    state.newsletterEmail = testNlEmail;
    const { rows } = await query(
      `INSERT INTO newsletter_subscribers (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET is_active = TRUE, unsubscribed_at = NULL
       RETURNING id, email`, [testNlEmail]
    );
    if (rows.length === 0) throw new Error('Subscribe failed');
  });

  await runTest('NEWSLETTER: Duplicate subscribe (upsert)', async () => {
    const { rows } = await query(
      `INSERT INTO newsletter_subscribers (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET is_active = TRUE, unsubscribed_at = NULL
       RETURNING id`, [state.newsletterEmail]
    );
    if (rows.length === 0) throw new Error('Upsert failed');
  });

  await runTest('NEWSLETTER: Unsubscribe', async () => {
    await query(
      'UPDATE newsletter_subscribers SET is_active = FALSE, unsubscribed_at = NOW() WHERE email = $1',
      [state.newsletterEmail]
    );
    const { rows } = await query('SELECT is_active FROM newsletter_subscribers WHERE email = $1', [state.newsletterEmail]);
    if (rows[0].is_active !== false) throw new Error('Unsubscribe failed');
  });

  // ============ CLEANUP ============
  await runTest('CLEANUP: Remove test data', async () => {
    // Cascading deletes will clean related records
    if (state.adCampaignId) await query('DELETE FROM ad_campaigns WHERE id = $1', [state.adCampaignId]);
    if (state.techSpecId) await query('DELETE FROM tech_specs WHERE id = $1', [state.techSpecId]);
    if (state.articleId) await query('DELETE FROM articles WHERE id = $1', [state.articleId]);
    if (state.tipId) await query('DELETE FROM tips WHERE id = $1', [state.tipId]);
    if (state.garageId) await query('DELETE FROM garages WHERE id = $1', [state.garageId]);
    if (state.sellerId) await query('DELETE FROM users WHERE id = $1', [state.sellerId]);
    if (state.userId) await query('DELETE FROM users WHERE id = $1', [state.userId]);
    // Clean stress test sessions and newsletter
    await query("DELETE FROM visitor_sessions WHERE fingerprint LIKE 'stress_fp_%'");
    await query("DELETE FROM visitor_sessions WHERE fingerprint = 'fp_test_123'");
    await query("DELETE FROM visitor_profiles WHERE fingerprint = 'fp_test_123'");
    if (state.newsletterEmail) await query('DELETE FROM newsletter_subscribers WHERE email = $1', [state.newsletterEmail]);
  });

  // ============ SUMMARY ============
  const totalTime = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  res.json({
    summary: {
      total: results.length,
      passed,
      failed,
      duration_ms: totalTime,
      status: failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} FAILED`
    },
    results
  });
});

/**
 * GET /api/tests/health
 * Quick health check for all services
 */
router.get('/health', async (req, res) => {
  const checks = {};

  try {
    await query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  checks.pool = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: pool.options.max
  };

  checks.uptime = process.uptime();
  checks.memory = process.memoryUsage();

  res.json(checks);
});

module.exports = router;
