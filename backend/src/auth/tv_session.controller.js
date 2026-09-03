const TvSession = require('./tv_session.model');
const User = require('../users/user.model');
const { generateToken } = require('../utils/jwt');
const distModel = require('../distribution/distribution.model');

const DEFAULT_WEBSITE_URL = 'https://afrovision.online';

function getWebsiteUrl() {
  return process.env.WEBSITE_URL || DEFAULT_WEBSITE_URL;
}

/**
 * POST /auth/tv/session
 * Called by the TV app on boot / when the pairing screen is shown.
 * Public endpoint — no auth required, since the TV isn't logged in yet.
 */
async function createSession(req, res) {
  try {
    const { device_name } = req.body || {};
    const session = await TvSession.create({ deviceName: device_name });
    const qrUrl = `${getWebsiteUrl()}/tv-link?session=${session.id}`;

    res.status(201).json({
      session_id: session.id,
      pairing_code: session.pairing_code,
      qr_url: qrUrl,
      expires_in: Math.max(
        0,
        Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000),
      ),
    });
  } catch (err) {
    console.error('[TvSession] createSession error:', err);
    res.status(500).json({ error: 'Failed to create TV pairing session' });
  }
}

/**
 * GET /auth/tv/session/:id/status
 * Polled by the TV app every few seconds while on the pairing screen.
 * Public endpoint. Returns the JWT + user once linked so the TV can start
 * using the standard Authorization: Bearer <token> flow like the mobile app.
 */
async function getSessionStatus(req, res) {
  try {
    const session = await TvSession.getEffectiveStatus(req.params.id);
    if (!session) return res.status(404).json({ error: 'TV session not found' });

    if (session.status === 'expired') {
      return res.json({ status: 'expired' });
    }

    if (session.status === 'pending') {
      return res.json({ status: 'pending' });
    }

    // linked
    const user = await User.findById(session.user_id);
    if (!user) {
      return res.status(404).json({ error: 'Linked user no longer exists' });
    }

    return res.json({
      status: 'linked',
      token: session.token,
      user: User.toSafeUser(user),
    });
  } catch (err) {
    console.error('[TvSession] getSessionStatus error:', err);
    res.status(500).json({ error: 'Failed to check TV session status' });
  }
}

/**
 * POST /auth/tv/session/:id/confirm
 * Called by the mobile app after the user scans the TV's QR code (or types
 * the fallback pairing code). Requires the mobile app's own bearer token —
 * that authenticated user becomes the account linked to the TV.
 */
async function confirmSession(req, res) {
  try {
    // ── QR Whitelist Gate ──────────────────────────────────────
    // QR pairing is restricted to admin users or those explicitly on
    // the distribution settings qr_whitelist_user_ids list. All other
    // TVs must activate via distributor-issued activation codes.
    const caller = req.user;
    if (!caller) return res.status(403).json({ error: 'QR pairing is restricted.' });

    const isAdmin = caller.role === 'admin';
    if (!isAdmin) {
      const settings = await distModel.getSettings();
      const whitelist = settings.qr_whitelist_user_ids || [];
      console.log('[TvSession] QR whitelist check — req.userId:', req.userId, '| whitelist:', JSON.stringify(whitelist));
      if (!whitelist.includes(req.userId)) {
        return res.status(403).json({
          error: 'QR_PAIRING_RESTRICTED',
          message: 'QR pairing is no longer available. Please use an activation code from an authorized AfroVision distributor.',
        });
      }
    }

    const session = await TvSession.getEffectiveStatus(req.params.id);
    if (!session) return res.status(404).json({ error: 'TV session not found' });

    if (session.status === 'expired') {
      return res.status(410).json({ error: 'This pairing code has expired. Please try again on the TV.' });
    }
    if (session.status === 'linked') {
      return res.status(409).json({ error: 'This TV has already been linked' });
    }

    const token = await generateToken(req.userId);
    const linked = await TvSession.linkToUser(req.params.id, {
      userId: req.userId,
      token,
    });

    if (!linked) {
      return res.status(409).json({ error: 'Unable to link this TV session. It may have expired.' });
    }

    res.json({
      message: 'TV linked successfully',
      device_name: linked.device_name,
    });
  } catch (err) {
    console.error('[TvSession] confirmSession error:', err);
    res.status(500).json({ error: 'Failed to link TV device' });
  }
}

module.exports = {
  createSession,
  getSessionStatus,
  confirmSession,
};
