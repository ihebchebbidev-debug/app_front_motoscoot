const { query, getClient } = require('../config/database');
const { parsePagination } = require('../utils/queryHelpers');
const { sendNewMessageEmail } = require('../services/mailer');
const logger = require('../utils/logger');

/**
 * In-memory debounce: only send a "new message" email to a given
 * (recipient_id, conversation_id) pair at most once every NOTIFY_COOLDOWN_MS.
 * Otherwise every keystroke-sized message would spam the recipient's inbox.
 * The cooldown resets when the recipient marks the conversation as read.
 */
const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const lastNotified = new Map();

function shouldNotify(recipientId, conversationId) {
  const key = `${recipientId}:${conversationId}`;
  const now = Date.now();
  const last = lastNotified.get(key) || 0;
  if (now - last < NOTIFY_COOLDOWN_MS) return false;
  lastNotified.set(key, now);
  if (lastNotified.size > 10_000) {
    const entries = Array.from(lastNotified.entries()).sort((a, b) => a[1] - b[1]);
    entries.slice(0, 5_000).forEach(([k]) => lastNotified.delete(k));
  }
  return true;
}

function clearNotifyCooldown(recipientId, conversationId) {
  lastNotified.delete(`${recipientId}:${conversationId}`);
}

/**
 * Fire-and-forget: send a "you got a new message" email to the recipient.
 * Errors are logged, never thrown — chat must succeed even if SMTP is down.
 */
async function notifyRecipientByEmail({ conversationId, recipientId, senderId, messageType, messageContent }) {
  if (!shouldNotify(recipientId, conversationId)) return;
  try {
    const { rows } = await query(
      `SELECT u.email AS recipient_email, u.full_name AS recipient_name,
              s.full_name AS sender_name,
              l.title AS listing_title
         FROM users u
         CROSS JOIN users s
         LEFT JOIN conversations c ON c.id = $1
         LEFT JOIN listings l ON l.id = c.listing_id
        WHERE u.id = $2 AND s.id = $3
        LIMIT 1`,
      [conversationId, recipientId, senderId]
    );
    if (rows.length === 0 || !rows[0].recipient_email) return;
    const r = rows[0];
    const preview = messageType === 'image'
      ? '📷 Vous avez reçu une image.'
      : messageType === 'offer'
        ? '💰 Vous avez reçu une offre.'
        : (messageContent || '').toString().trim() || 'Nouveau message';
    const base = (process.env.FRONTEND_URL || 'https://www.moto-scoot.tn').replace(/\/+$/, '');
    const conversationUrl = `${base}/mon-compte?tab=messages&conversation=${encodeURIComponent(conversationId)}`;
    sendNewMessageEmail({
      to: r.recipient_email,
      recipientName: r.recipient_name,
      senderName: r.sender_name,
      messagePreview: preview,
      listingTitle: r.listing_title,
      conversationUrl,
    })
      .then(() => logger.info(`[messages] new-message email sent to ${r.recipient_email} (conv ${conversationId})`))
      .catch((err) => logger.error(`[messages] FAILED to send new-message email to ${r.recipient_email}:`, err && err.message));
  } catch (err) {
    logger.error('[messages] notifyRecipientByEmail lookup failed:', err && err.message);
  }
}

async function getAll(req, res, next) {
  try {
    // Hide threads where the OTHER party has been deactivated/banned. The
    // current user can still see their own archive, but a banned peer would
    // appear with full PII (name + avatar) which we don't want.
    const { rows } = await query(
      `SELECT c.*,
        l.title as listing_title, l.images as listing_images, l.price as listing_price,
        buyer.full_name as buyer_name, buyer.avatar_url as buyer_avatar,
        seller.full_name as seller_name, seller.avatar_url as seller_avatar,
        m.content as last_message_content, m.type as last_message_type, m.sender_id as last_message_sender
       FROM conversations c
       LEFT JOIN listings l ON c.listing_id = l.id
       JOIN users buyer ON c.buyer_id = buyer.id
       JOIN users seller ON c.seller_id = seller.id
       LEFT JOIN LATERAL (
         SELECT content, type, sender_id FROM messages
         WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
       ) m ON true
       WHERE (c.buyer_id = $1 OR c.seller_id = $1) AND c.is_archived = false
         AND COALESCE(buyer.is_active, TRUE) = TRUE
         AND COALESCE(seller.is_active, TRUE) = TRUE
       ORDER BY c.last_message_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// Server-side allow-list of message types. Mirrors the DB CHECK constraint
// added in migration 015 so we return a friendly 400 instead of a generic
// "constraint violation" 500 when a client sends garbage.
const ALLOWED_MESSAGE_TYPES = new Set(['text', 'image', 'offer', 'system']);

async function create(req, res, next) {
  // We open a single transaction so the "find-or-create conversation" + the
  // optional initial message + the unread/last_message_at bump either ALL
  // commit or ALL roll back. Two parallel "Contact seller" clicks used to
  // race past the SELECT and both INSERT, splitting the inbox into two
  // duplicate threads (migration 020 also adds a unique index — this code
  // path catches the resulting 23505 and reuses the existing row).
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { listing_id, message } = req.body;
    if (!listing_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'listing_id is required' });
    }

    // SECURITY: derive the seller from the LISTING, never from the request body.
    // Trusting `req.body.seller_id` would let any user open a thread against an
    // arbitrary user (inbox spam, PII reveal — see listingsController.getById
    // which unblanks seller phone/whatsapp once a conversation exists between
    // the two parties).
    const listing = await client.query('SELECT id, user_id FROM listings WHERE id = $1', [listing_id]);
    if (listing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Listing not found' });
    }
    const seller_id = listing.rows[0].user_id;

    if (String(seller_id) === String(req.user.id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    // Look up an EXISTING conversation symmetrically (either party may have
    // initiated it). Without this, the seller messaging the buyer about their
    // own listing would create a duplicate thread, splitting the message
    // history into two unrelated UIs.
    let { rows } = await client.query(
      `SELECT id, buyer_id FROM conversations
        WHERE listing_id = $1
          AND ((buyer_id = $2 AND seller_id = $3) OR (buyer_id = $3 AND seller_id = $2))
        LIMIT 1`,
      [listing_id, req.user.id, seller_id]
    );

    let conversationId;
    let isNew = false;
    let buyerId;
    if (rows.length > 0) {
      conversationId = rows[0].id;
      buyerId = rows[0].buyer_id;
    } else {
      try {
        const ins = await client.query(
          'INSERT INTO conversations (listing_id, buyer_id, seller_id) VALUES ($1, $2, $3) RETURNING id, buyer_id',
          [listing_id, req.user.id, seller_id]
        );
        conversationId = ins.rows[0].id;
        buyerId = ins.rows[0].buyer_id;
        isNew = true;
      } catch (insertErr) {
        // Migration 020 unique index tripped: a parallel request just won the
        // race and created the same thread. Re-read it and proceed as if we
        // had found it on the first lookup. Idempotent UX — both clicks
        // resolve to the same conversation_id.
        if (insertErr && insertErr.code === '23505') {
          const again = await client.query(
            `SELECT id, buyer_id FROM conversations
              WHERE listing_id = $1
                AND ((buyer_id = $2 AND seller_id = $3) OR (buyer_id = $3 AND seller_id = $2))
              LIMIT 1`,
            [listing_id, req.user.id, seller_id]
          );
          if (again.rows.length === 0) throw insertErr;
          conversationId = again.rows[0].id;
          buyerId = again.rows[0].buyer_id;
        } else {
          throw insertErr;
        }
      }
    }

    if (message) {
      if (typeof message !== 'string' || message.length > 5000) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Message trop long (max 5000 caractères).' });
      }
      // Initial message from create() is always plain text — no client-supplied
      // type/image_url path here, so we don't need the allow-list check.
      await client.query('INSERT INTO messages (conversation_id, sender_id, type, content) VALUES ($1, $2, $3, $4)', [conversationId, req.user.id, 'text', message]);
      // Bump the OTHER side's unread counter against the actual stored buyer_id
      // (which may belong to either the caller or the recipient on a re-open).
      const field = String(req.user.id) === String(buyerId) ? 'seller_unread' : 'buyer_unread';
      await client.query(
        `UPDATE conversations SET last_message_at = NOW(), ${field} = ${field} + 1 WHERE id = $1`,
        [conversationId]
      );
    } else if (!isNew) {
      // Re-opening a thread (no new message) — bump last_message_at so the
      // conversation surfaces back to the top of the inbox instead of staying
      // buried at its old timestamp.
      await client.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [conversationId]);
    }

    await client.query('COMMIT');

    // Notify the seller in real-time when a brand new conversation is opened.
    if (isNew) {
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${seller_id}`).emit('conversation:new', {
          conversation_id: conversationId,
          listing_id,
          buyer_id: req.user.id,
        });
      }
    }

    // Email notification when an initial message was included with the
    // conversation creation. Fire-and-forget, debounced per recipient/conv.
    if (message) {
      const recipientId = String(req.user.id) === String(buyerId) ? seller_id : buyerId;
      notifyRecipientByEmail({
        conversationId,
        recipientId,
        senderId: req.user.id,
        messageType: 'text',
        messageContent: message,
      });
    }

    res.status(201).json({ conversation_id: conversationId });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* already rolled back */ }
    next(err);
  } finally {
    client.release();
  }
}

/** Verify user is member of conversation, returns conv or sends 403/404 */
async function verifyMembership(req, res) {
  const { rows } = await query('SELECT buyer_id, seller_id, is_archived FROM conversations WHERE id = $1', [req.params.id]);
  if (rows.length === 0) { res.status(404).json({ error: 'Conversation not found' }); return null; }
  const c = rows[0];
  // Coerce to string for comparison: UUIDs from DB are strings; req.user.id from JWT
  // may be a number on some JWT payloads depending on how users.id is typed.
  const uid = String(req.user.id);
  if (String(c.buyer_id) !== uid && String(c.seller_id) !== uid) { res.status(403).json({ error: 'Not a member' }); return null; }
  return c;
}

async function getMessages(req, res, next) {
  try {
    const conv = await verifyMembership(req, res);
    if (!conv) return;

    // Cursor-based pagination ("load older"): pass `?before=<ISO|messageId>` to
    // fetch the page of messages strictly older than that anchor. Default page
    // is the most recent N. Always returned in chronological ASC order so the
    // chat UI can simply prepend older pages to the existing list without any
    // extra reordering.
    //
    // Response shape: { messages: [...ASC], next_before: <ISO|null>, has_more }
    // - next_before: created_at of the OLDEST message in the page; pass it
    //   back as `?before=` to fetch the next page. NULL when there are no
    //   older messages so the client can stop paginating.
    // - has_more: explicit boolean — `messages.length === limit` means there
    //   *might* be more; we confirm by checking if any older row exists.
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before; // ISO timestamp or message id

    // We fetch one extra row (limit + 1) so we can tell whether there are more
    // older messages WITHOUT a separate probe query — saves a DB round trip
    // on every chat scroll page (was: 2 queries per page; now: 1).
    const fetchLimit = limit + 1;

    let rows;
    if (before) {
      // Resolve the anchor's created_at; accept either an id or a raw timestamp.
      // Privacy: when an id is supplied, scope the lookup to THIS conversation
      // so a user can't probe timestamps of unrelated conversations by passing
      // a guessed UUID (a.k.a. "message fishing").
      const isTimestamp = /^\d{4}-\d{2}-\d{2}T/.test(String(before));
      let anchorTs = null;
      if (isTimestamp) {
        anchorTs = before;
      } else {
        const a = await query(
          'SELECT created_at FROM messages WHERE id = $1 AND conversation_id = $2',
          [before, req.params.id]
        );
        if (a.rows.length) anchorTs = a.rows[0].created_at;
      }
      if (!anchorTs) {
        // Stale or unknown anchor — fall back to the latest page so the UI
        // still shows messages (better UX than an empty "no history" state).
        ({ rows } = await query(
          `SELECT m.*, u.full_name as sender_name, u.avatar_url as sender_avatar
           FROM messages m JOIN users u ON m.sender_id = u.id
           WHERE m.conversation_id = $1
           ORDER BY m.created_at DESC
           LIMIT $2`,
          [req.params.id, fetchLimit]
        ));
      } else {
        ({ rows } = await query(
          `SELECT m.*, u.full_name as sender_name, u.avatar_url as sender_avatar
           FROM messages m JOIN users u ON m.sender_id = u.id
           WHERE m.conversation_id = $1 AND m.created_at < $2
           ORDER BY m.created_at DESC
           LIMIT $3`,
          [req.params.id, anchorTs, fetchLimit]
        ));
      }
    } else {
      ({ rows } = await query(
        `SELECT m.*, u.full_name as sender_name, u.avatar_url as sender_avatar
         FROM messages m JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = $1
         ORDER BY m.created_at DESC
         LIMIT $2`,
        [req.params.id, fetchLimit]
      ));
    }

    // The DB ordered DESC. If we got the extra row, drop it and flag has_more.
    let hasMore = false;
    if (rows.length > limit) {
      rows = rows.slice(0, limit);
      hasMore = true;
    }
    // Reverse to chronological ASC for the UI.
    const ordered = rows.reverse();
    const nextBefore = hasMore && ordered.length ? ordered[0].created_at : null;

    res.json({ messages: ordered, next_before: nextBefore, has_more: hasMore });
  } catch (err) { next(err); }
}

async function sendMessage(req, res, next) {
  try {
    const conv = await verifyMembership(req, res);
    if (!conv) return;
    if (conv.is_archived) {
      return res.status(403).json({ error: 'Conversation archivée — impossible d\'envoyer un message.' });
    }

    const { content, type = 'text', image_url, offer_amount } = req.body;
    if (!content && !image_url && !offer_amount) return res.status(400).json({ error: 'Message content required' });
    if (typeof content === 'string' && content.length > 5000) {
      return res.status(400).json({ error: 'Message trop long (max 5000 caractères).' });
    }

    // Server allow-list mirrors the DB CHECK from migration 015 so a bad
    // payload returns a clean 400 instead of a 500 from constraint violation.
    const safeType = ALLOWED_MESSAGE_TYPES.has(type) ? type : 'text';

    // Sanity-check image_url shape if provided. Only allow http(s) and our own
    // /uploads/ paths — anything else (data:, javascript:, file:) would be a
    // stored-XSS / SSRF foothold the chat UI would happily render.
    let safeImageUrl = null;
    if (image_url) {
      const s = String(image_url).trim();
      if (s.length > 1024) {
        return res.status(400).json({ error: 'image_url trop longue.' });
      }
      if (/^https?:\/\//i.test(s) || s.startsWith('/uploads/')) {
        safeImageUrl = s;
      } else {
        return res.status(400).json({ error: 'image_url invalide.' });
      }
    }

    // offer_amount: must be a non-negative finite number if provided.
    let safeOffer = null;
    if (offer_amount != null && offer_amount !== '') {
      const n = Number(offer_amount);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ error: 'offer_amount invalide.' });
      }
      safeOffer = n;
    }

    const { rows } = await query(
      `INSERT INTO messages (conversation_id, sender_id, type, content, image_url, offer_amount)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, req.user.id, safeType, content, safeImageUrl, safeOffer]
    );

    // Whitelist guard — only two values are ever valid here. Defensive against
    // future refactors where conv shape might change.
    // String coercion needed: UUIDs from DB vs JWT id may differ in type.
    const computed = String(req.user.id) === String(conv.buyer_id) ? 'seller_unread' : 'buyer_unread';
    const unreadField = ['buyer_unread', 'seller_unread'].includes(computed) ? computed : 'buyer_unread';
    await query(`UPDATE conversations SET last_message_at = NOW(), ${unreadField} = ${unreadField} + 1 WHERE id = $1`, [req.params.id]);

    // Emit via socket
    const io = req.app.get('io');
    let recipientId;
    if (io) {
      recipientId = String(req.user.id) === String(conv.buyer_id)
        ? conv.seller_id
        : conv.buyer_id;
      io.to(`user:${recipientId}`).emit('message:new', { conversation_id: req.params.id, message: rows[0] });
      io.to(`conversation:${req.params.id}`).emit('message:new', { conversation_id: req.params.id, message: rows[0] });
    } else {
      recipientId = String(req.user.id) === String(conv.buyer_id) ? conv.seller_id : conv.buyer_id;
    }

    // Email notification — debounced, fire-and-forget, never blocks the send.
    notifyRecipientByEmail({
      conversationId: req.params.id,
      recipientId,
      senderId: req.user.id,
      messageType: safeType,
      messageContent: content,
    });

    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function markAsRead(req, res, next) {
  try {
    const conv = await verifyMembership(req, res);
    if (!conv) return;

    // Race-safe: a brand new message arriving DURING this handler used to be
    // missed because we wrote `unread = 0` after the COUNT was captured. We
    // now zero only the messages we explicitly mark as read in this call by
    // recomputing the unread count from `messages.is_read` afterwards.
    //
    // The two writes MUST run sequentially: the recount has to see the rows
    // we just flipped, otherwise we re-read the pre-update state and the
    // counter stays positive even though the inbox is empty. (The previous
    // comment claimed they ran in parallel, but the code already awaited
    // them in order — we just make the intent explicit here.)
    const field = String(req.user.id) === String(conv.buyer_id) ? 'buyer_unread' : 'seller_unread';
    await query(
      'UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false',
      [req.params.id, req.user.id]
    );
    // Recompute the counter from ground truth so any message that arrived
    // mid-flight is correctly reflected (it will simply remain unread = 1).
    await query(
      `UPDATE conversations
          SET ${field} = (
            SELECT COUNT(*) FROM messages
             WHERE conversation_id = $1
               AND sender_id != $2
               AND is_read = false
          )
        WHERE id = $1`,
      [req.params.id, req.user.id]
    );
    // Notify the peer that we've read their messages so their UI can clear
    // the "1 unread" badge live (instead of waiting for the next list refetch).
    const io = req.app.get('io');
    if (io) {
      const peerId = String(req.user.id) === String(conv.buyer_id) ? conv.seller_id : conv.buyer_id;
      io.to(`user:${peerId}`).emit('conversation:read', {
        conversation_id: req.params.id,
        reader_id: req.user.id,
      });
    }
    // Reset the email-notification cooldown so the next incoming message
    // (after the user has caught up) triggers a fresh email instead of being
    // silently swallowed by the 10-minute debounce.
    clearNotifyCooldown(req.user.id, req.params.id);
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
}

async function archiveConversation(req, res, next) {
  try {
    const conv = await verifyMembership(req, res);
    if (!conv) return;

    await query('UPDATE conversations SET is_archived = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Conversation archived' });
  } catch (err) { next(err); }
}

async function getUnreadCount(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT COALESCE(SUM(
        CASE WHEN buyer_id = $1 THEN buyer_unread
             WHEN seller_id = $1 THEN seller_unread ELSE 0 END
       ), 0) as unread_count
       FROM conversations WHERE (buyer_id = $1 OR seller_id = $1) AND is_archived = false`,
      [req.user.id]
    );
    res.json({ unread_count: parseInt(rows[0].unread_count) });
  } catch (err) { next(err); }
}

module.exports = { getAll, create, getMessages, sendMessage, markAsRead, archiveConversation, getUnreadCount };
