/**
 * TV-to-TV Chat Controller
 * Two auth surfaces share this one set of handlers, both simply needing to
 * resolve "which user is calling":
 *   - Standard user JWT (authenticateToken) -> req.user.id
 *   - TV device JWT (authenticateTvDevice)  -> req.device.owner_user_id
 * Route files call these with the resolved id already attached to
 * req.chatUserId (see chat.routes.js and distribution/tv chat routes).
 */

const model = require('./chat.model');

// Lazy require: realtime/socket.service requires chat.model, so pulling it
// in lazily here avoids any module-init ordering surprises between the two.
function socketService() {
  return require('../realtime/socket.service');
}

function requireChatUser(req, res) {
  const userId = req.chatUserId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return userId;
}

exports.getMyPin = async (req, res) => {
  const userId = requireChatUser(req, res);
  if (!userId) return;
  try {
    const pin = await model.ensurePin(userId);
    res.status(200).json({ pin });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.regeneratePin = async (req, res) => {
  const userId = requireChatUser(req, res);
  if (!userId) return;
  try {
    const pin = await model.regeneratePin(userId);
    res.status(200).json({ pin });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.requestConnection = async (req, res) => {
  const userId = requireChatUser(req, res);
  if (!userId) return;
  const pin = String(req.body?.pin || '').trim();
  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: 'INVALID_PIN', message: 'Enter the 6-digit AfroVision PIN.' });
  }
  try {
    const result = await model.requestConnectionByPin(userId, pin);
    if (result.error === 'PIN_NOT_FOUND') {
      return res.status(404).json({ error: 'PIN_NOT_FOUND', message: 'No AfroVision user has that PIN.' });
    }
    if (result.error === 'CANNOT_CONNECT_SELF') {
      return res.status(400).json({ error: 'CANNOT_CONNECT_SELF', message: "That's your own PIN." });
    }
    if (result.targetUserId) {
      socketService().emitAdtvChatBadge(result.targetUserId, { reason: 'connection_request' });
    }
    res.status(200).json({ connection: result.connection });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.respondToConnection = async (req, res) => {
  const userId = requireChatUser(req, res);
  if (!userId) return;
  const accept = req.body?.accept === true;
  try {
    const result = await model.respondToConnection(userId, req.params.id, accept);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Connection not found' });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ error: 'Not your connection' });
    if (result.error === 'CANNOT_RESPOND_TO_OWN_REQUEST') {
      return res.status(400).json({ error: 'You cannot accept your own request' });
    }
    if (result.otherUserId) {
      socketService().emitAdtvChatBadge(result.otherUserId, { reason: 'connection_response' });
    }
    res.status(200).json({ connection: result.connection });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.listConnections = async (req, res) => {
  const userId = requireChatUser(req, res);
  if (!userId) return;
  try {
    const connections = await model.listConnections(userId);
    res.status(200).json({
      connections: connections.map((c) => ({
        id: c.id,
        status: c.status,
        requested_by_me: c.requested_by === userId,
        created_at: c.created_at,
        accepted_at: c.accepted_at,
        other_user: c.other_user,
        unread_count: c.unread_count || 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

async function assertParticipant(req, res, connectionId, userId) {
  const connection = await model.getConnection(connectionId);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return null;
  }
  if (connection.user_a !== userId && connection.user_b !== userId) {
    res.status(403).json({ error: 'Not your connection' });
    return null;
  }
  if (connection.status !== 'accepted') {
    res.status(403).json({ error: 'CONNECTION_NOT_ACCEPTED', message: 'This connection has not been accepted yet.' });
    return null;
  }
  return connection;
}

exports.listMessages = async (req, res) => {
  const userId = requireChatUser(req, res);
  if (!userId) return;
  try {
    const connection = await assertParticipant(req, res, req.params.connectionId, userId);
    if (!connection) return;
    const messages = await model.listMessages(connection.id);
    res.status(200).json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  const userId = requireChatUser(req, res);
  if (!userId) return;
  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Message body is required' });
  try {
    const connection = await assertParticipant(req, res, req.params.connectionId, userId);
    if (!connection) return;
    const { message, recipientId } = await model.sendMessage(connection.id, userId, body);
    socketService().emitAdtvChatMessage(connection.id, message);
    if (recipientId) {
      socketService().emitAdtvChatBadge(recipientId, { reason: 'message', connection_id: connection.id });
    }
    res.status(200).json({ message });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.markConnectionRead = async (req, res) => {
  const userId = requireChatUser(req, res);
  if (!userId) return;
  try {
    const connection = await model.getConnection(req.params.connectionId);
    if (!connection || (connection.user_a !== userId && connection.user_b !== userId)) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    await model.markConnectionRead(connection.id, userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.getUnreadSummary = async (req, res) => {
  const userId = requireChatUser(req, res);
  if (!userId) return;
  try {
    const summary = await model.getUnreadSummary(userId);
    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Admin moderation (standard user JWT + admin role) ──────────────

async function requireAdmin(req, res) {
  const caller = req.user;
  if (!caller || caller.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return caller;
}

exports.adminListConnections = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const connections = await model.adminListConnections();
    res.status(200).json({ connections });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.adminListMessages = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const messages = await model.adminListMessages(req.params.connectionId);
    res.status(200).json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.adminSetConnectionStatus = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const status = req.body?.status;
  if (!['accepted', 'declined', 'blocked', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const connection = await model.adminSetConnectionStatus(req.params.connectionId, status);
    res.status(200).json({ connection });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
