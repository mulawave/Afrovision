const Channel = require('./channel.model');
const User = require('../users/user.model');
const Request = require('./exclusive_channel_request.model');
const NotificationService = require('../notifications/notification.service');
const AuditService = require('../admin/audit.service');
const { isAdultKycVerified } = require('./exclusive_policy.service');

// Correct public website URL for CTAs (see plan §Scope).
const WEBSITE_BASE = 'https://afrovision-website-zoeqld5lsa-uc.a.run.app';

function safeAudit(adminUid, action, targetId, meta = {}) {
  return AuditService.logAction(adminUid, action, targetId, meta)
    .catch((error) =>
      console.error('[ExclusiveRequest] audit log failed:', error.message)
    );
}

function ownerAdminIds(channel, adminUser) {
  const ids = new Set();
  if (channel && channel.owner_id) ids.add(channel.owner_id);
  if (adminUser && adminUser.role === 'admin' && adminUser.id) ids.add(adminUser.id);
  return Array.from(ids);
}

async function canManage(channel, userId) {
  if (!channel || !userId) return false;
  if (channel.owner_id === userId) return true;
  const user = await User.findById(userId);
  return !!(user && user.role === 'admin');
}

function requestLink(channelId, requestId) {
  return `${WEBSITE_BASE}/channel/${channelId}/exclusive/requests/${requestId}`;
}

// Enrich a raw request record with requester display fields so the admin
// UI can render a friendly label without a per-row client join. Best-effort
// — missing user records fall back to the uid short form.
async function enrichWithUser(record) {
  if (!record) return record;
  try {
    const u = await User.findById(record.user_uid);
    if (!u) return record;
    return {
      ...record,
      requester_name: u.name || null,
      requester_email: u.email || null,
    };
  } catch (_) {
    return record;
  }
}

async function enrichAll(records) {
  return Promise.all((records || []).map(enrichWithUser));
}

// ─── Requester actions ──────────────────────────────────────────────────

async function submitRequest(req, res) {
  try {
    const channelId = req.params.id;
    const userId = req.userId;
    const note = (req.body && typeof req.body.note === 'string')
      ? req.body.note.trim()
      : '';
    const referralCode = (req.body && typeof req.body.referral_code === 'string')
      ? req.body.referral_code.trim()
      : null;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!(Number(channel.exclusive_monthly_fee_ngn) > 0)) {
      return res.status(400).json({ error: 'Channel is not exclusive.' });
    }

    // Owners can't request membership to their own channel.
    if (channel.owner_id === userId) {
      return res.status(400).json({ error: 'Owners already have access to their own channel.' });
    }

    // KYC strict.
    const kycOk = await isAdultKycVerified(userId);
    if (!kycOk) {
      return res.status(403).json({
        error: 'KYC verification required.',
        code: 'KYC_REQUIRED',
      });
    }

    // Idempotent — one open request per (user, channel).
    const existing = await Request.findPendingByUserAndChannel(userId, channelId);
    if (existing) {
      return res.json({
        success: true,
        message: 'A request is already in progress.',
        request_id: existing.id,
        status: existing.status,
        already_exists: true,
      });
    }

    const user = await User.findById(userId);
    const referralSource = (user && user.referralSource) || referralCode || null;
    const record = await Request.create({
      userUid: userId,
      channelId,
      channelName: channel.name,
      note,
      referralSource,
    });

    // Notify channel owner (+ any admin explicitly named on the channel).
    const notifyIds = ownerAdminIds(channel, null);
    if (notifyIds.length) {
      NotificationService.notifyUsers(notifyIds, {
        title: 'New exclusive membership request',
        body: `${(user && (user.name || user.email)) || 'A viewer'} asked to join ${channel.name}.`,
        type: 'exclusive_request',
        data: { request_id: record.id, channel_id: channelId },
        link: requestLink(channelId, record.id),
      }).catch((err) =>
        console.error('[ExclusiveRequest] notifyOwners failed:', err.message)
      );
    }

    safeAudit(userId, 'exclusive_request.create', record.id, {
      channelId,
      referralSource,
    });

    return res.json({
      success: true,
      message: 'Request submitted. The channel will review it.',
      request_id: record.id,
      status: record.status,
    });
  } catch (err) {
    console.error('[ExclusiveRequest] submitRequest:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function fetchRequest(req, res) {
  try {
    const { id: channelId, requestId } = req.params;
    const record = await Request.findById(requestId);
    if (!record || record.channel_id !== channelId) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    // Requester, channel owner, or admin.
    const channel = await Channel.findById(channelId);
    const requesterOk = record.user_uid === req.userId;
    const managerOk = await canManage(channel, req.userId);
    if (!requesterOk && !managerOk) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const enriched = await enrichWithUser(record);
    return res.json({ success: true, data: { request: enriched } });
  } catch (err) {
    console.error('[ExclusiveRequest] fetchRequest:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function replyRequest(req, res) {
  try {
    const { id: channelId, requestId } = req.params;
    const reply = (req.body && typeof req.body.reply === 'string')
      ? req.body.reply.trim()
      : '';
    if (!reply) return res.status(400).json({ error: 'Reply is required.' });

    const record = await Request.findById(requestId);
    if (!record || record.channel_id !== channelId) {
      return res.status(404).json({ error: 'Request not found.' });
    }
    if (record.user_uid !== req.userId) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (record.status !== 'more_info') {
      return res.status(400).json({
        error: 'This request is not waiting on you.',
        code: 'NOT_MORE_INFO',
      });
    }

    const channel = await Channel.findById(channelId);
    const updated = await Request.update(requestId, {
      user_reply: reply,
      status: 'pending',
      admin_message: '',
      resolved_at: null,
      resolved_by: null,
    });

    // Notify owner/admins that the requester replied.
    const notifyIds = ownerAdminIds(channel, null);
    if (notifyIds.length) {
      NotificationService.notifyUsers(notifyIds, {
        title: 'Requester replied',
        body: `A membership request for ${channel.name} has new information from the applicant.`,
        type: 'exclusive_request',
        data: { request_id: requestId, channel_id: channelId },
        link: requestLink(channelId, requestId),
      }).catch(() => {});
    }

    return res.json({ success: true, request: updated });
  } catch (err) {
    console.error('[ExclusiveRequest] replyRequest:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Owner / admin actions ──────────────────────────────────────────────

async function listRequests(req, res) {
  try {
    const channelId = req.params.id;
    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!(await canManage(channel, req.userId))) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    const statusFilter = typeof req.query.status === 'string'
      ? req.query.status.trim()
      : null;
    const rows = await Request.listByChannel(channelId, { statusFilter });
    const enriched = await enrichAll(rows);
    return res.json({ success: true, data: { requests: enriched } });
  } catch (err) {
    console.error('[ExclusiveRequest] listRequests:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function resolveRequest(req, res, {
  status,
  requireAdminMessage = false,
  action = 'resolve',
}) {
  try {
    const { id: channelId, requestId } = req.params;
    const adminMessage = (req.body && typeof req.body.admin_message === 'string')
      ? req.body.admin_message.trim()
      : '';
    if (requireAdminMessage && !adminMessage) {
      return res.status(400).json({
        error: 'A message is required so the applicant knows what to do next.',
      });
    }

    const record = await Request.findById(requestId);
    if (!record || record.channel_id !== channelId) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const channel = await Channel.findById(channelId);
    if (!(await canManage(channel, req.userId))) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const markResolved = status !== 'more_info';
    const updated = await Request.transitionStatus(requestId, {
      status,
      adminMessage,
      resolvedBy: req.userId,
      markResolved,
    });

    // Notify the requester.
    const title = status === 'approved_pending_payment'
      ? `Approved · ${channel.name}`
      : status === 'rejected'
        ? `Request declined · ${channel.name}`
        : status === 'more_info'
          ? `More info needed · ${channel.name}`
          : `Request updated · ${channel.name}`;

    const body = status === 'approved_pending_payment'
      ? 'Your request was approved. Pay the monthly fee to activate access.'
      : status === 'rejected'
        ? (adminMessage || 'The channel declined your request.')
        : status === 'more_info'
          ? (adminMessage || 'The channel needs more information from you.')
          : 'Your request has been updated.';

    NotificationService.notifyUser(record.user_uid, {
      title,
      body,
      type: 'exclusive_request',
      data: {
        request_id: requestId,
        channel_id: channelId,
        status,
      },
      link: requestLink(channelId, requestId),
    }).catch((err) =>
      console.error('[ExclusiveRequest] notify requester failed:', err.message)
    );

    safeAudit(req.userId, `exclusive_request.${action}`, requestId, {
      channelId,
      status,
    });

    return res.json({ success: true, request: updated });
  } catch (err) {
    console.error(`[ExclusiveRequest] resolveRequest(${status}):`, err.message);
    return res.status(500).json({ error: err.message });
  }
}

function approveRequest(req, res) {
  return resolveRequest(req, res, {
    status: 'approved_pending_payment',
    action: 'approve',
  });
}

function rejectRequest(req, res) {
  return resolveRequest(req, res, {
    status: 'rejected',
    action: 'reject',
  });
}

function moreInfoRequest(req, res) {
  return resolveRequest(req, res, {
    status: 'more_info',
    requireAdminMessage: true,
    action: 'more_info',
  });
}

// ─── Payment link (called from exclusive_channel.controller) ────────────

/**
 * Mark a previously-approved request as fully approved after a successful
 * payment. Called from `purchaseExclusiveAccess` when the client passed
 * `request_id` in the body.
 *
 * Never throws — payment success must not be voided by a bookkeeping miss.
 */
async function markRequestApprovedFromPayment({
  requestId,
  channelId,
  userUid,
  accessId,
  paymentReference,
}) {
  if (!requestId) return null;
  try {
    const record = await Request.findById(requestId);
    if (!record) return null;
    if (record.channel_id !== channelId) return null;
    if (record.user_uid !== userUid) return null;
    return await Request.update(requestId, {
      status: 'approved',
      access_id: accessId || null,
      payment_reference: paymentReference || null,
      resolved_at: Date.now(),
    });
  } catch (err) {
    console.error('[ExclusiveRequest] markRequestApprovedFromPayment:', err.message);
    return null;
  }
}

module.exports = {
  submitRequest,
  fetchRequest,
  replyRequest,
  listRequests,
  approveRequest,
  rejectRequest,
  moreInfoRequest,
  markRequestApprovedFromPayment,
};
