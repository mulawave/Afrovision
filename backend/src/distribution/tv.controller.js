/**
 * TV Device Controller
 * Endpoints the Android TV app calls: one-time activation, periodic heartbeat
 * (kill switch + config + update checks), and the two-way message center.
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const model = require('./distribution.model');
const auth = require('./distribution.auth');
const User = require('../users/user.model');
const { getFirestore } = require('../utils/firestore');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

async function getOwnerSafely(ownerId) {
  try {
    return await User.findById(ownerId);
  } catch (error) {
    console.error('[Distribution] Owner lookup failed:', error.message);
    return null;
  }
}

async function safeEnrichChannel(channel, owner) {
  const ChannelSub = require('../subscriptions/channel_subscription.model');
  const ownerDisplayMode = channel.owner_display_mode || 'show_owner';
  const ownerBrandName = typeof channel.owner_brand_name === 'string'
    ? channel.owner_brand_name.trim()
    : null;
  const trueOwnerName = owner?.name || owner?.email || 'Unknown';

  let publicOwnerName = trueOwnerName;
  if (ownerDisplayMode === 'hide_owner') {
    publicOwnerName = '';
  } else if (ownerDisplayMode === 'brand_only') {
    publicOwnerName = ownerBrandName || 'Brand';
  }

  let subscriberCount = 0;
  try {
    subscriberCount = await ChannelSub.countActiveByChannel(channel.id);
  } catch (_) {}

  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    category: channel.category,
    type: channel.type,
    channel_number: Number(channel.channel_number) || channel.channel_number,
    logo_url: channel.logo_url,
    banner_url: channel.banner_url,
    is_active: channel.is_active,
    created_at: channel.created_at,
    owner_id: channel.owner_id,
    owner_name: publicOwnerName,
    subscriber_count: subscriberCount,
    followers_count: subscriberCount,
    stream_source_mode: channel.stream_source_mode || 'native',
    external_provider: channel.external_provider || null,
    external_url: channel.external_url || null,
    resolved_playback_url: channel.resolved_playback_url || null,
    stream_status: channel.stream_status || 'unknown',
    is_exclusive: channel.type === 'exclusive'
      || Number(channel.exclusive_monthly_fee_ngn || 0) > 0,
    exclusive_monthly_fee_ngn: Number(channel.exclusive_monthly_fee_ngn || 0),
    exclusive_fee_currency: channel.exclusive_fee_currency || 'NGN',
  };
}

/**
 * Create (or reuse) the AfroVision user record for a TV owner.
 * TV users live in the same `users` collection with account_type: 'tv'
 * so they are explicitly distinguishable from app users.
 */
async function ensureTvOwnerUser({ email, fullName, phone, deviceId, activationCode }) {
  const db = getFirestore();
  let user = await User.findByEmail(email);

  if (!user) {
    const randomPassword = crypto.randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    user = await User.create({ email, passwordHash });
  }

  const existingDeviceIds = Array.isArray(user.tv_device_ids) ? user.tv_device_ids : [];
  const tvFields = {
    // Explicit TV-user flag. Existing app users keep their account_type
    // untouched but gain the tv_device linkage.
    account_type: user.account_type || 'tv',
    is_tv_user: true,
    tv_device_ids: existingDeviceIds.includes(deviceId)
      ? existingDeviceIds
      : [...existingDeviceIds, deviceId],
    tv_activation_code: activationCode,
    name: user.name || fullName,
    phoneNumber: user.phoneNumber || phone,
  };

  await db.collection('users').doc(user.id).set(tvFields, { merge: true });
  await User.reloadFromFirestore(user.id);
  return User.findById(user.id);
}

/**
 * POST /distribution/tv/activate
 * Body: { code, owner_email, owner_name, owner_phone, device_id, device_name, app_version }
 *
 * One code = one TV, forever. A code that was already used can only
 * re-activate the exact device it is bound to (e.g. after a factory reset).
 */
exports.activate = async (req, res) => {
  try {
    const {
      code,
      owner_email,
      owner_name,
      owner_phone,
      device_id,
      device_name,
      app_version,
    } = req.body || {};

    const email = String(owner_email || '').trim().toLowerCase();
    const fullName = String(owner_name || '').trim();
    const phone = String(owner_phone || '').trim();
    const deviceId = String(device_id || '').trim();

    if (!code) return res.status(400).json({ error: 'Activation code is required' });
    if (!deviceId) return res.status(400).json({ error: 'Device ID is required' });
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'A valid owner email is required' });
    if (fullName.length < 2) return res.status(400).json({ error: 'Owner full name is required' });
    if (phone.length < 6) return res.status(400).json({ error: 'Owner phone number is required' });

    const entry = await model.findActivationCode(code);
    if (!entry) {
      return res.status(404).json({ error: 'INVALID_CODE', message: 'This activation code does not exist.' });
    }
    if (entry.status === 'revoked') {
      return res.status(410).json({ error: 'CODE_REVOKED', message: 'This activation code has been revoked. Contact your distributor.' });
    }

    // ── Re-activation path: code already bound to this exact device ──
    if (entry.status === 'activated') {
      if (entry.device_id !== deviceId) {
        return res.status(409).json({
          error: 'CODE_ALREADY_USED',
          message: 'This code has already been used on another TV. One code activates exactly one TV.',
        });
      }
      const device = await model.findDeviceById(deviceId);
      if (device?.status === 'disabled') {
        return res.status(403).json({
          error: 'DEVICE_DISABLED',
          message: device.disabled_reason || 'This TV has been disabled. Contact your distributor.',
        });
      }
      const deviceToken = await auth.generateDeviceToken(deviceId);
      await model.updateDevice(deviceId, {
        last_seen_at: new Date().toISOString(),
        app_version: app_version || device?.app_version || null,
      });
      const settings = await model.getSettings();
      return res.status(200).json({
        success: true,
        reactivated: true,
        device_token: deviceToken,
        device_id: deviceId,
        owner: { email, name: fullName },
        config_version: settings.config_version,
      });
    }

    // ── Fresh activation ──
    const distributor = await model.findDistributorById(entry.distributor_id);
    if (!distributor || distributor.status === 'banned') {
      return res.status(403).json({ error: 'DISTRIBUTOR_INVALID', message: 'The issuing distributor is no longer active.' });
    }

    const settings = await model.getSettings();
    const owner = await ensureTvOwnerUser({
      email,
      fullName,
      phone,
      deviceId,
      activationCode: entry.code,
    });

    await model.updateActivationCode(entry.code, {
      status: 'activated',
      activated_at: new Date().toISOString(),
      device_id: deviceId,
      owner_user_id: owner.id,
    });

    await model.upsertDevice(deviceId, {
      activation_code: entry.code,
      owner_user_id: owner.id,
      owner_email: email,
      owner_name: fullName,
      owner_phone: phone,
      distributor_id: entry.distributor_id,
      marketer_id: entry.marketer_id,
      device_name: device_name || 'AfroVision TV',
      app_version: app_version || null,
      location: { ip: clientIp(req) },
      status: 'active',
      disabled_reason: null,
      disabled_by: null,
      activated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      last_read_message_at: new Date().toISOString(),
    });

    // Record revenue + split in the remittance ledger.
    const price = Number(settings.activation_price_ngn) || 0;
    const splitPercent = model.distributorSplitPercent(distributor, settings);
    const afrovisionShare = Math.round((price * splitPercent) / 100);
    await model.addLedgerEntry({
      type: 'activation_revenue',
      distributor_id: entry.distributor_id,
      marketer_id: entry.marketer_id,
      code: entry.code,
      device_id: deviceId,
      amount_ngn: price,
      split_percent_afrovision: splitPercent,
      afrovision_share_ngn: afrovisionShare,
      distributor_share_ngn: price - afrovisionShare,
    });

    // Attribution counters.
    const marketer = await model.findMarketerById(entry.marketer_id);
    if (marketer) {
      await model.updateMarketer(marketer.id, {
        activation_count: (Number(marketer.activation_count) || 0) + 1,
      });
    }

    const deviceToken = await auth.generateDeviceToken(deviceId);
    return res.status(200).json({
      success: true,
      reactivated: false,
      device_token: deviceToken,
      device_id: deviceId,
      owner: { email, name: fullName },
      config_version: settings.config_version,
    });
  } catch (error) {
    console.error('[Distribution] TV activation error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * POST /distribution/tv/heartbeat  (device token)
 * The TV calls this on launch and periodically. This is the enforcement
 * point for the kill switch, config refresh, and self-update.
 */
exports.heartbeat = async (req, res) => {
  try {
    const device = req.device;
    const { app_version } = req.body || {};

    const settings = await model.getSettings();

    await model.updateDevice(device.id, {
      last_seen_at: new Date().toISOString(),
      app_version: app_version || device.app_version || null,
      location: { ...(device.location || {}), ip: clientIp(req) },
    });

    if (device.status === 'disabled') {
      return res.status(200).json({
        enabled: false,
        disabled_reason: device.disabled_reason || 'This TV has been disabled. Contact your distributor.',
        config_version: settings.config_version,
      });
    }

    const messages = await model.listMessagesForDevice(device, 50);
    const lastRead = device.last_read_message_at || device.activated_at || '';
    const unreadCount = messages.filter((m) => (m.created_at || '') > lastRead).length;

    return res.status(200).json({
      enabled: true,
      config_version: settings.config_version,
      unread_messages: unreadCount,
      app_update: {
        latest_version_code: settings.tv_app?.latest_version_code || 1,
        latest_version_name: settings.tv_app?.latest_version_name || '1.0.0',
        apk_url: settings.tv_app?.apk_url || null,
      },
      server_time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Distribution] TV heartbeat error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/tv/channel/:channelNumber  (device token)
 * Looks up a channel by its channel number, regardless of type (public/private/exclusive).
 * The TV app uses this as a fallback when a typed channel number is not in the loaded list.
 */
exports.getChannelByNumber = async (req, res) => {
  try {
    const Channel = require('../channels/channel.model');
    const channel = await Channel.findByNumber(req.params.channelNumber);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    if (channel.is_banned) {
      return res.status(403).json({ error: 'CHANNEL_BANNED', message: 'This channel has been banned.' });
    }

    const owner = await getOwnerSafely(channel.owner_id);
    const enriched = await safeEnrichChannel(channel, owner);
    return res.status(200).json({ channel: enriched });
  } catch (error) {
    console.error('[Distribution] TV getChannelByNumber error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/tv/channels  (device token)
 * Returns all channels the TV device owner can access: public channels,
 * private channels they've subscribed to, and exclusive channels they have
 * active access to. This replaces the standard /channels endpoint for TV devices.
 */
exports.getChannels = async (req, res) => {
  try {
    const Channel = require('../channels/channel.model');
    const ChannelSub = require('../subscriptions/channel_subscription.model');
    const channels = await Channel.getAll();
    const device = req.device;
    const ownerUid = device.owner_user_id;

    // Fetch exclusive channel accesses for the owner
    let exclusiveChannelIds = new Set();
    // Fetch private channel subscriptions for the owner
    let subscribedChannelIds = new Set();

    if (ownerUid) {
      try {
        const db = getFirestore();
        const exclSnapshot = await db.collection('exclusive_channel_access')
          .where('user_uid', '==', ownerUid)
          .where('status', '==', 'active')
          .get();
        exclSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.channel_id) exclusiveChannelIds.add(data.channel_id);
        });
      } catch (err) {
        console.error('[Distribution] TV getChannels: exclusive access lookup failed:', err.message);
      }

      try {
        subscribedChannelIds = new Set(await ChannelSub.getActiveSubscribedChannelIds(ownerUid));
      } catch (err) {
        console.error('[Distribution] TV getChannels: subscription lookup failed:', err.message);
      }
    }

    const visibleChannels = channels.filter((channel) => {
      if (channel.is_banned) return false;
      // Public channels: always visible (exclusive-fee public channels need active access)
      if (channel.type === 'public') {
        if (Number(channel.exclusive_monthly_fee_ngn || 0) > 0) {
          return exclusiveChannelIds.has(channel.id);
        }
        return true;
      }
      // Private channels: visible if owner has an active subscription
      if (channel.type === 'private') {
        if (Number(channel.exclusive_monthly_fee_ngn || 0) > 0) {
          return exclusiveChannelIds.has(channel.id);
        }
        return subscribedChannelIds.has(channel.id);
      }
      // Exclusive type channels: visible if owner has active exclusive access
      if (channel.type === 'exclusive') {
        return exclusiveChannelIds.has(channel.id);
      }
      return false;
    });

    const enriched = await Promise.all(visibleChannels.map(async (ch) => {
      const owner = await getOwnerSafely(ch.owner_id);
      return safeEnrichChannel(ch, owner);
    }));

    return res.status(200).json({ channels: enriched });
  } catch (error) {
    console.error('[Distribution] TV getChannels error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/tv/messages  (device token)
 */
exports.listMessages = async (req, res) => {
  try {
    const device = req.device;
    const messages = await model.listMessagesForDevice(device, 50);
    const lastRead = device.last_read_message_at || device.activated_at || '';
    return res.status(200).json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        type: m.type,
        title: m.title,
        body: m.body,
        allow_reply: m.allow_reply !== false,
        created_at: m.created_at,
        unread: (m.created_at || '') > lastRead,
      })),
    });
  } catch (error) {
    console.error('[Distribution] TV messages error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * POST /distribution/tv/messages/mark-read  (device token)
 * Marks everything up to now as read for this device.
 */
exports.markMessagesRead = async (req, res) => {
  try {
    await model.updateDevice(req.device.id, {
      last_read_message_at: new Date().toISOString(),
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Distribution] TV mark-read error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * POST /distribution/tv/messages/:id/reply  (device token)
 * Body: { body }
 */
exports.replyToMessage = async (req, res) => {
  try {
    const message = await model.findMessageById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.allow_reply === false) {
      return res.status(403).json({ error: 'This message does not accept replies' });
    }
    if (!model.messageTargetsDevice(message, req.device)) {
      return res.status(403).json({ error: 'This message was not sent to this TV' });
    }
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Reply body is required' });
    if (body.length > 500) return res.status(400).json({ error: 'Reply is too long (max 500 characters)' });

    const reply = await model.addMessageReply({
      messageId: message.id,
      deviceId: req.device.id,
      body,
    });
    return res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error('[Distribution] TV reply error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
