/**
 * Audition Signup controller — AV-CHL-002
 *
 * Handles routes for the paid audition signup entity.
 *
 * Auth endpoints:
 *   GET  /challenge/audition/status     — current user's signup status for active challenge
 *
 * Admin endpoints:
 *   GET    /challenge/admin/audition-signups             — list with filters
 *   GET    /challenge/admin/audition-signups/:id         — get single signup
 *   PATCH  /challenge/admin/audition-signups/:id         — update fields
 *   DELETE /challenge/admin/audition-signups/:id         — delete signup record
 */
'use strict';
const AuditionSignupModel = require('./audition_signup.model');
const ChallengeModel = require('./challenge.model');
const UserModel = require('../users/user.model');
const SmtpService = require('../admin/smtp.service');

// ── Auth — current user status ────────────────────────────────────────────

/**
 * GET /challenge/audition/status
 * Returns the calling user's audition signup record for the active challenge,
 * or null if none exists. Used by the Flutter UI to show correct state.
 */
async function getMyAuditionStatus(req, res) {
  try {
    const ch = await ChallengeModel.getActiveChallenge();
    if (!ch) return res.json({ signup: null, challenge: null });

    const signup = await AuditionSignupModel.getSignupByUserId(ch.id, req.userId);
    res.json({
      challenge: { id: ch.id, title: ch.title, phase: ch.phase },
      signup: signup
        ? {
            id: signup.id,
            signup_status: signup.signup_status,
            payment_status: signup.payment_status,
            enrolled_at: signup.enrolled_at,
            vpt_allocated: signup.vpt_allocated,
            created_at: signup.created_at,
          }
        : null,
    });
  } catch (err) {
    console.error('[AuditionSignup] getMyStatus error:', err);
    res.status(500).json({ error: 'Failed to fetch audition status' });
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────

function _isAdmin(req) {
  return req.userRole === 'admin' || req.userRole === 'superadmin';
}

/**
 * GET /challenge/admin/audition-signups
 * Query params: challenge_id, payment_status, signup_status, email_sent, search, limit, offset
 */
async function adminListSignups(req, res) {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const {
      challenge_id,
      payment_status,
      signup_status,
      email_sent,
      search,
      limit,
      offset,
    } = req.query;

    const opts = {
      challenge_id: challenge_id || undefined,
      payment_status: payment_status || undefined,
      signup_status: signup_status || undefined,
      search: search || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    if (email_sent !== undefined) {
      opts.email_sent = email_sent === 'true';
    }

    // Validate enum values
    if (opts.payment_status && !AuditionSignupModel.PAYMENT_STATUSES.includes(opts.payment_status)) {
      return res.status(400).json({
        error: `Invalid payment_status. Allowed: ${AuditionSignupModel.PAYMENT_STATUSES.join(', ')}`,
      });
    }
    if (opts.signup_status && !AuditionSignupModel.SIGNUP_STATUSES.includes(opts.signup_status)) {
      return res.status(400).json({
        error: `Invalid signup_status. Allowed: ${AuditionSignupModel.SIGNUP_STATUSES.join(', ')}`,
      });
    }

    const result = await AuditionSignupModel.listSignups(opts);
    res.json(result);
  } catch (err) {
    console.error('[AuditionSignup] adminList error:', err);
    res.status(500).json({ error: 'Failed to list audition signups' });
  }
}

/**
 * GET /challenge/admin/audition-signups/:id
 */
async function adminGetSignup(req, res) {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const signup = await AuditionSignupModel.getSignupById(req.params.id);
    if (!signup) return res.status(404).json({ error: 'Signup not found' });
    res.json(signup);
  } catch (err) {
    console.error('[AuditionSignup] adminGet error:', err);
    res.status(500).json({ error: 'Failed to fetch signup' });
  }
}

/**
 * PATCH /challenge/admin/audition-signups/:id
 * Admin can update communication fields, campaign tags, and cancel signups.
 * Payment and allocation fields cannot be manually overwritten via this endpoint
 * (those are managed by the payment flow in AV-CHL-005).
 */
async function adminUpdateSignup(req, res) {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const allowed = [
      'email_sent',
      'email_sent_at',
      'email_error',
      'email_retry_count',
      'email_last_attempt_at',
      'campaign_tags',
      'cancel_reason',
    ];

    // Admin can also manually cancel a signup that's stuck in pending_payment
    if (req.body.signup_status === 'cancelled') {
      allowed.push('signup_status', 'cancelled_at');
    }

    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }

    const updated = await AuditionSignupModel.updateSignup(req.params.id, fields);
    if (!updated) return res.status(404).json({ error: 'Signup not found' });
    res.json(updated);
  } catch (err) {
    console.error('[AuditionSignup] adminUpdate error:', err);
    res.status(500).json({ error: 'Failed to update signup' });
  }
}

/**
 * DELETE /challenge/admin/audition-signups/:id
 * Hard deletes a signup record.
 */
async function adminDeleteSignup(req, res) {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const signup = await AuditionSignupModel.getSignupById(req.params.id);
    if (!signup) return res.status(404).json({ error: 'Signup not found' });

    const deleted = await AuditionSignupModel.deleteSignup(req.params.id);
    res.json({ deleted: true, id: deleted.id });
  } catch (err) {
    console.error('[AuditionSignup] adminDelete error:', err);
    res.status(500).json({ error: 'Failed to delete signup' });
  }
}

/**
 * POST /challenge/admin/audition-signups/:id/resend-email
 * Resends the paid audition acknowledgement email and updates communication fields.
 */
async function adminResendSignupEmail(req, res) {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const signup = await AuditionSignupModel.getSignupById(req.params.id);
    if (!signup) return res.status(404).json({ error: 'Signup not found' });

    const toEmail = String(signup.email || '').trim();
    if (!toEmail) {
      return res.status(400).json({ error: 'Signup has no email address' });
    }

    if (signup.payment_status !== 'paid') {
      return res.status(409).json({ error: 'Only paid audition signups can receive confirmation emails' });
    }

    const attemptedAt = new Date().toISOString();
    const attempts = Number(signup.email_retry_count || 0) + 1;

    try {
      await SmtpService.sendAuditionSignupAcknowledgementEmail({
        toEmail,
        displayName: signup.name || toEmail.split('@')[0],
      });

      const updated = await AuditionSignupModel.updateSignup(signup.id, {
        email_sent: true,
        email_sent_at: attemptedAt,
        email_error: null,
        email_retry_count: attempts,
        email_last_attempt_at: attemptedAt,
      });

      return res.json({
        success: true,
        message: 'Confirmation email resent successfully',
        signup: updated,
      });
    } catch (emailErr) {
      const updated = await AuditionSignupModel.updateSignup(signup.id, {
        email_sent: false,
        email_error: emailErr.message || 'Acknowledgement email failed',
        email_retry_count: attempts,
        email_last_attempt_at: attemptedAt,
      });

      return res.status(502).json({
        error: emailErr.message || 'Failed to resend confirmation email',
        signup: updated,
      });
    }
  } catch (err) {
    console.error('[AuditionSignup] adminResendSignupEmail error:', err);
    return res.status(500).json({ error: 'Failed to resend confirmation email' });
  }
}

module.exports = {
  getMyAuditionStatus,
  adminListSignups,
  adminGetSignup,
  adminUpdateSignup,
  adminDeleteSignup,
  adminResendSignupEmail,
};
