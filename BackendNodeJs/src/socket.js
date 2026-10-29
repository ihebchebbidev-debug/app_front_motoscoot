const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('./config/database');
const logger = require('./utils/logger');
const { JWT_SECRET } = require('./config/jwt');

/**
 * Initialize Socket.IO for real-time messaging
 */
function initializeSocket(io) {
  // Authentication middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info(`🔌 User connected: ${userId}`);

    // Periodic re-verification of the JWT — covers the edge case where the user
    // logs out / token is revoked but the socket stays open until ping timeout.
    // We re-verify every 60s using the original handshake token; if it now fails
    // (expired, revoked, signature changed), we forcibly disconnect.
    const reverifyInterval = setInterval(async () => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        socket.emit('auth:invalid', { reason: 'no token' });
        return socket.disconnect(true);
      }
      try {
        jwt.verify(token, JWT_SECRET);
        // Best-effort blacklist check
        try {
          const hash = crypto.createHash('sha256').update(token).digest('hex');
          const { rows } = await query('SELECT 1 FROM token_blacklist WHERE token_hash = $1', [hash]);
          if (rows.length) {
            socket.emit('auth:invalid', { reason: 'revoked' });
            return socket.disconnect(true);
          }
        } catch { /* table might not exist yet */ }
      } catch {
        socket.emit('auth:invalid', { reason: 'expired' });
        return socket.disconnect(true);
      }
    }, 60_000);

    // Join personal room for receiving messages
    socket.join(`user:${userId}`);

    // Join a conversation room
    socket.on('conversation:join', async (conversationId) => {
      try {
        // Verify user is member of conversation
        const { rows } = await query(
          'SELECT buyer_id, seller_id FROM conversations WHERE id = $1',
          [conversationId]
        );
        if (rows.length > 0 && (String(rows[0].buyer_id) === String(userId) || String(rows[0].seller_id) === String(userId))) {
          socket.join(`conversation:${conversationId}`);
          logger.info(`User ${userId} joined conversation ${conversationId}`);
        }
      } catch (err) {
        logger.error('Error joining conversation:', err.message);
      }
    });

    // Leave conversation room
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicator
    socket.on('typing:start', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        userId,
        conversationId
      });
    });

    socket.on('typing:stop', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        userId,
        conversationId
      });
    });

    // Presence: emit online/offline ONLY to the rooms (conversation peers)
    // this user actually shares a thread with, not to every connected client.
    // Broadcasting to all sockets doesn't scale and leaks online-status to
    // strangers who have no business knowing it.
    //
    // Fan-out cap: a power-seller may have thousands of conversations. Without
    // a cap, every reconnect would emit one socket event per peer (N writes
    // through the io adapter). We cap at PRESENCE_FANOUT_MAX distinct peers
    // and DEDUPE in SQL — the previous version emitted the same peer multiple
    // times if they shared several conversations with this user. At scale,
    // swap this for Redis pub/sub where presence is a single SET membership.
    const PRESENCE_FANOUT_MAX = 200;
    const notifyPresence = async (status) => {
      try {
        const { rows } = await query(
          `SELECT DISTINCT
                  CASE WHEN buyer_id = $1 THEN seller_id ELSE buyer_id END AS peer
             FROM conversations
            WHERE (buyer_id = $1 OR seller_id = $1)
              AND is_archived = false
            LIMIT $2`,
          [userId, PRESENCE_FANOUT_MAX]
        );
        const event = status === 'online' ? 'user:online' : 'user:offline';
        rows.forEach((c) => {
          io.to(`user:${c.peer}`).emit(event, { userId });
        });
      } catch { /* best-effort */ }
    };

    socket.on('disconnect', () => {
      clearInterval(reverifyInterval);
      logger.info(`🔌 User disconnected: ${userId}`);
      notifyPresence('offline');
    });

    notifyPresence('online');
  });

  logger.info('✅ WebSocket initialized');
  return io;
}

module.exports = { initializeSocket };
