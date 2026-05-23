const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');
const Channel = require('../channels/channel.model');
const ChannelAccess = require('../channels/channel_access.model');
const CreatorSubscription = require('../subscriptions/creator_subscription.model');
const User = require('../users/user.model');
const { getSenderBadge, getSenderDisplayName } = require('./live_identity');

const MAX_MESSAGE_LENGTH = 200;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function getRoomName(channelId) {
  return `channel:${channelId}`;
}

function getMessagesCollection(channelId) {
  const db = getFirestore();
  return db.collection('channel_chats').doc(channelId).collection('messages');
}

function sanitizeMessage(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').replace(/[<>]/g, '').trim();
}

async function ensureChatAccess(uid, channelId) {
  const user = await User.findById(uid);
  if (!user) {
    return { ok: false, status: 401, error: 'User not found', code: 'USER_NOT_FOUND' };
  }

  const channel = await Channel.findById(channelId);
  if (!channel) {
    return { ok: false, status: 404, error: 'Channel not found', code: 'CHANNEL_NOT_FOUND' };
  }

  if (!channel.is_active) {
    return { ok: false, status: 403, error: 'Channel is not active', code: 'CHANNEL_DISABLED' };
  }

  const isPrivileged = user.role === 'admin' || channel.owner_id === uid;

  if (channel.requires_payment && !isPrivileged) {
    const access = await ChannelAccess.findActiveAccess(uid, channel.id);
    if (!access) {
      return {
        ok: false,
        status: 402,
        error: 'Premium access is required to join this live chat',
        code: 'PREMIUM_ACCESS_REQUIRED',
      };
    }
  }

  if (channel.is_subscriber_only && !isPrivileged) {
    const sub = await CreatorSubscription.findActive(uid, channel.owner_id);
    if (!sub) {
      return {
        ok: false,
        status: 403,
        error: 'Subscriber access is required to join this live chat',
        code: 'SUBSCRIBER_ONLY',
      };
    }
  }

  return {
    ok: true,
    channel,
    user,
  };
}

function buildMessagePayload(record, requesterUid, channel) {
  const isPrivate = channel?.type === 'private';
  return {
    id: record.id,
    channel_id: record.channel_id,
    sender_name: isPrivate
      ? record.sender_alias || getSenderDisplayName(record.sender_uid, channel)
      : record.sender_name,
    badge: isPrivate ? null : record.badge || null,
    text: record.text,
    created_at: record.created_at,
    is_own: requesterUid ? requesterUid === record.sender_uid : false,
  };
}

async function listMessages({ uid, channelId, limit = DEFAULT_LIMIT }) {
  const access = await ensureChatAccess(uid, channelId);
  if (!access.ok) return access;

  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const snapshot = await getMessagesCollection(channelId)
    .orderBy('created_at', 'desc')
    .limit(safeLimit)
    .get();

  const messages = snapshot.docs
    .map((doc) => doc.data())
    .reverse()
    .map((record) => buildMessagePayload(record, uid, access.channel));

  return {
    ok: true,
    channel: access.channel,
    messages,
  };
}

async function createMessage({ uid, channelId, text }) {
  const access = await ensureChatAccess(uid, channelId);
  if (!access.ok) return access;

  const sanitizedText = sanitizeMessage(text);
  if (!sanitizedText) {
    return {
      ok: false,
      status: 400,
      error: 'Message text is required',
      code: 'MESSAGE_REQUIRED',
    };
  }

  if (sanitizedText.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
      code: 'MESSAGE_TOO_LONG',
    };
  }

  const record = {
    id: crypto.randomUUID(),
    channel_id: channelId,
    sender_uid: uid,
    sender_name: getSenderDisplayName(uid, access.channel),
    sender_alias:
      access.channel.type === 'private'
        ? getSenderDisplayName(uid, access.channel)
        : null,
    badge: await getSenderBadge(uid, access.channel),
    text: sanitizedText,
    created_at: Date.now(),
  };

  await getMessagesCollection(channelId).doc(record.id).set(record);

  return {
    ok: true,
    channel: access.channel,
    message: buildMessagePayload(record, uid, access.channel),
  };
}

module.exports = {
  getRoomName,
  ensureChatAccess,
  listMessages,
  createMessage,
};