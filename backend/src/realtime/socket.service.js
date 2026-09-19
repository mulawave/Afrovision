const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../utils/jwt');
const SettingsService = require('../admin/settings.service');
const ChatService = require('../interactions/chat.service');
const distributionModel = require('../distribution/distribution.model');
const adtvChatModel = require('../chat/chat.model');
const ChannelLive = require('../channels/channel_live.model');
const { emptyPlatformBreakdown } = require('../utils/platform');

let io = null;
const roomSockets = new Map();
const roomPlatformCounts = new Map();

function getAllowedOrigins() {
  if (!process.env.ALLOWED_ORIGINS) {
    return '*';
  }
  return process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function trackJoin(socketId, room, platform) {
  const members = roomSockets.get(room) || new Set();
  members.add(socketId);
  roomSockets.set(room, members);

  const counts = roomPlatformCounts.get(room) || emptyPlatformBreakdown();
  counts[platform] = (counts[platform] || 0) + 1;
  roomPlatformCounts.set(room, counts);

  return members.size;
}

function trackLeave(socketId, room, platform) {
  const members = roomSockets.get(room);
  if (!members) return 0;
  members.delete(socketId);

  const counts = roomPlatformCounts.get(room);
  if (counts && platform) {
    counts[platform] = Math.max(0, (counts[platform] || 0) - 1);
    roomPlatformCounts.set(room, counts);
  }

  if (members.size === 0) {
    roomSockets.delete(room);
    roomPlatformCounts.delete(room);
    return 0;
  }
  roomSockets.set(room, members);
  return members.size;
}

/**
 * Resolve which platform a socket represents for live-viewer analytics.
 * TV devices are trusted server-side (proven by their device JWT, set at
 * auth time) rather than a client-supplied field, so a spoofed payload
 * can't misattribute viewers to/from the TV bucket. Everything else falls
 * back to whatever the client claims, restricted to web/android.
 */
function resolvePlatform(socket, payload) {
  if (socket.data.isTvDevice) return 'tv';
  const claimed = String(payload?.platform || '').toLowerCase();
  return claimed === 'android' ? 'android' : 'web';
}

const CHANNEL_ROOM_PREFIX = 'channel:';

function channelIdFromRoom(room) {
  if (typeof room !== 'string' || !room.startsWith(CHANNEL_ROOM_PREFIX)) return null;
  return room.slice(CHANNEL_ROOM_PREFIX.length);
}

function emitViewerCount(room) {
  if (!io) return;
  const viewerCount = roomSockets.get(room)?.size || 0;
  io.to(room).emit('channel:viewer_count', { viewer_count: viewerCount });

  // Persist so the admin live-viewers dashboard can read it without needing
  // a socket connection of its own. Fire-and-forget — never block the
  // realtime emit on a Firestore write.
  const channelId = channelIdFromRoom(room);
  if (channelId) {
    const breakdown = { ...emptyPlatformBreakdown(), ...(roomPlatformCounts.get(room) || {}) };
    ChannelLive.setViewerCount(channelId, viewerCount, breakdown).catch(() => {});
  }
}

function normalizeToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  return null;
}

async function authenticateSocket(socket, next) {
  const token = normalizeToken(socket);
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = await verifyToken(token);

    if (payload.kind === 'tv_device') {
      // AfroVision TV devices authenticate with a distinct device JWT (see
      // distribution/distribution.auth.js), signed with the same secret but
      // carrying a deviceId instead of a userId. Resolve it to the device's
      // linked owner account so TV clients can join their personal room the
      // same way a phone/web user does.
      const device = await distributionModel.findDeviceById(payload.deviceId);
      if (!device?.owner_user_id) {
        return next(new Error('Device not linked to a user'));
      }
      socket.data.userId = device.owner_user_id;
      socket.data.isTvDevice = true;
    } else {
      socket.data.userId = payload.userId;
    }

    socket.data.rooms = new Set();
    return next();
  } catch (error) {
    return next(new Error('Invalid or expired token'));
  }
}

function registerJoinHandler(socket) {
  socket.on('channel:join', async (payload = {}, ack = () => {}) => {
    const channelId = payload.channelId;
    if (!channelId) {
      ack({ ok: false, error: 'channelId is required', code: 'CHANNEL_ID_REQUIRED' });
      return;
    }

    const access = await ChatService.ensureChatAccess(socket.data.userId, channelId);
    if (!access.ok) {
      ack({ ok: false, error: access.error, code: access.code, status: access.status });
      return;
    }

    const platform = resolvePlatform(socket, payload);
    socket.data.platform = platform;

    const room = ChatService.getRoomName(channelId);
    socket.join(room);
    socket.data.rooms.add(room);
    const viewerCount = trackJoin(socket.id, room, platform);
    emitViewerCount(room);
    ack({ ok: true, viewer_count: viewerCount });
  });
}

function registerLeaveHandler(socket) {
  socket.on('channel:leave', (payload = {}, ack = () => {}) => {
    const channelId = payload.channelId;
    if (!channelId) {
      ack({ ok: false, error: 'channelId is required', code: 'CHANNEL_ID_REQUIRED' });
      return;
    }

    const room = ChatService.getRoomName(channelId);
    socket.leave(room);
    socket.data.rooms?.delete(room);
    const viewerCount = trackLeave(socket.id, room, socket.data.platform);
    emitViewerCount(room);
    ack({ ok: true, viewer_count: viewerCount });
  });
}

function registerSendHandler(socket) {
  socket.on('chat:send', async (payload = {}, ack = () => {}) => {
    const channelId = payload.channelId;
    const room = ChatService.getRoomName(channelId);

    if (!socket.data.rooms?.has(room)) {
      ack({ ok: false, error: 'Join the channel before sending messages', code: 'NOT_JOINED' });
      return;
    }

    const result = await ChatService.createMessage({
      uid: socket.data.userId,
      channelId,
      text: payload.text,
    });

    if (!result.ok) {
      ack({ ok: false, error: result.error, code: result.code, status: result.status });
      return;
    }

    io.to(room).emit('chat:message', result.message);
    ack({ ok: true, message: result.message });
  });
}

function personalRoom(userId) {
  return `adtv_user:${userId}`;
}

function connectionRoom(connectionId) {
  return `adtv_chat:${connectionId}`;
}

/**
 * TV-to-TV chat (see chat/chat.model.js). Namespaced adtv_chat:* so it can
 * never collide with the existing per-channel live chat above (chat:send /
 * chat:message / chat:*).
 */
function registerAdtvChatHandlers(socket) {
  socket.join(personalRoom(socket.data.userId));

  socket.on('adtv_chat:join', async (payload = {}, ack = () => {}) => {
    const connectionId = payload.connectionId;
    if (!connectionId) {
      ack({ ok: false, error: 'connectionId is required' });
      return;
    }
    const connection = await adtvChatModel.getConnection(connectionId);
    if (!connection || (connection.user_a !== socket.data.userId && connection.user_b !== socket.data.userId)) {
      ack({ ok: false, error: 'Not your connection' });
      return;
    }
    const room = connectionRoom(connectionId);
    socket.join(room);
    socket.data.rooms.add(room);
    ack({ ok: true });
  });

  socket.on('adtv_chat:leave', (payload = {}, ack = () => {}) => {
    const room = connectionRoom(payload.connectionId);
    socket.leave(room);
    socket.data.rooms?.delete(room);
    ack({ ok: true });
  });
}

function registerDisconnectHandler(socket) {
  socket.on('disconnect', () => {
    for (const room of socket.data.rooms || []) {
      trackLeave(socket.id, room, socket.data.platform);
      emitViewerCount(room);
    }
  });
}

function initializeSocketServer(server) {
  io = new Server(server, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    registerJoinHandler(socket);
    registerLeaveHandler(socket);
    registerSendHandler(socket);
    registerAdtvChatHandlers(socket);
    registerDisconnectHandler(socket);
  });

  return io;
}

function emitChannelEvent(channelId, event) {
  if (!io || !channelId || !event) return;
  io.to(ChatService.getRoomName(channelId)).emit('channel:event', event);
}

/** Called by chat.controller.js right after a message is persisted. */
function emitAdtvChatMessage(connectionId, message) {
  if (!io || !connectionId || !message) return;
  io.to(connectionRoom(connectionId)).emit('adtv_chat:message', message);
}

/**
 * Called after a message send or a connection request/response so both
 * participants' badge counts can update live without polling. `payload` is
 * whatever the client needs to refresh its badge (kept minimal - it should
 * still re-fetch the authoritative count, this is just a "something
 * changed" nudge).
 */
function emitAdtvChatBadge(userId, payload = {}) {
  if (!io || !userId) return;
  io.to(personalRoom(userId)).emit('adtv_chat:badge', payload);
}

module.exports = {
  initializeSocketServer,
  emitChannelEvent,
  emitAdtvChatMessage,
  emitAdtvChatBadge,
};