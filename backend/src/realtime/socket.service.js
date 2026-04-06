const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const ChatService = require('../interactions/chat.service');

let io = null;
const roomSockets = new Map();

function getAllowedOrigins() {
  if (!process.env.ALLOWED_ORIGINS) {
    return '*';
  }
  return process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function trackJoin(socketId, room) {
  const members = roomSockets.get(room) || new Set();
  members.add(socketId);
  roomSockets.set(room, members);
  return members.size;
}

function trackLeave(socketId, room) {
  const members = roomSockets.get(room);
  if (!members) return 0;
  members.delete(socketId);
  if (members.size === 0) {
    roomSockets.delete(room);
    return 0;
  }
  roomSockets.set(room, members);
  return members.size;
}

function emitViewerCount(room) {
  if (!io) return;
  const viewerCount = roomSockets.get(room)?.size || 0;
  io.to(room).emit('channel:viewer_count', { viewer_count: viewerCount });
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
    socket.data.userId = payload.userId;
    socket.data.rooms = new Set();
    return next();
  } catch (error) {
    return next(new Error('Invalid or expired token'));
  }
}

function registerJoinHandler(socket) {
  socket.on('channel:join', (payload = {}, ack = () => {}) => {
    const channelId = payload.channelId;
    if (!channelId) {
      ack({ ok: false, error: 'channelId is required', code: 'CHANNEL_ID_REQUIRED' });
      return;
    }

    const access = ChatService.ensureChatAccess(socket.data.userId, channelId);
    if (!access.ok) {
      ack({ ok: false, error: access.error, code: access.code, status: access.status });
      return;
    }

    const room = ChatService.getRoomName(channelId);
    socket.join(room);
    socket.data.rooms.add(room);
    const viewerCount = trackJoin(socket.id, room);
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
    const viewerCount = trackLeave(socket.id, room);
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

function registerDisconnectHandler(socket) {
  socket.on('disconnect', () => {
    for (const room of socket.data.rooms || []) {
      trackLeave(socket.id, room);
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
    registerDisconnectHandler(socket);
  });

  return io;
}

function emitChannelEvent(channelId, event) {
  if (!io || !channelId || !event) return;
  io.to(ChatService.getRoomName(channelId)).emit('channel:event', event);
}

module.exports = {
  initializeSocketServer,
  emitChannelEvent,
};