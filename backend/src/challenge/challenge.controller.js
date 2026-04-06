/**
 * Challenge controller.
 *
 * Public:  GET  /challenge/active       — get current active challenge (public info)
 *          POST /challenge/register     — register for active challenge (auth required)
 *          GET  /challenge/my           — get my registration (auth required)
 *          GET  /challenge/contestants  — list approved contestants (public)
 *
 * Admin:   GET    /challenge/admin/list            — list all challenges
 *          POST   /challenge/admin/create          — create a challenge season
 *          PATCH  /challenge/admin/:id             — update challenge
 *          PATCH  /challenge/admin/:id/phase       — advance phase
 *          GET    /challenge/admin/:id/registrations — list registrations
 *          PATCH  /challenge/admin/registrations/:regId — update registration status
 *          DELETE /challenge/admin/registrations/:regId — delete registration
 */
const ChallengeModel = require('./challenge.model');
const UserModel = require('../users/user.model');

/* ── Public ───────────────────────────────────────────────────── */

async function getActiveChallenge(req, res) {
  try {
    const ch = ChallengeModel.getActiveChallenge();
    if (!ch) return res.status(404).json({ error: 'No active challenge' });

    // Public view — strip admin-only fields
    const { judges, sponsors, ...publicData } = ch;
    publicData.registration_count = ChallengeModel.countRegistrations(ch.id);
    res.json(publicData);
  } catch (err) {
    console.error('[Challenge] getActive error:', err);
    res.status(500).json({ error: 'Failed to fetch challenge' });
  }
}

async function registerForChallenge(req, res) {
  try {
    const userId = req.userId;
    const user = UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Must have verified email (active account)
    if (user.deleted_at) return res.status(403).json({ error: 'Account is deactivated' });

    const ch = ChallengeModel.getActiveChallenge();
    if (!ch) return res.status(404).json({ error: 'No active challenge' });
    if (ch.phase !== 'registration') {
      return res.status(400).json({ error: 'Registration phase is not open' });
    }

    // Check if already registered
    const existing = ChallengeModel.getRegistrationByUserId(ch.id, userId);
    if (existing) return res.status(409).json({ error: 'Already registered', registration: existing });

    // Check max contestants
    const count = ChallengeModel.countRegistrations(ch.id);
    if (ch.max_contestants && count >= ch.max_contestants) {
      return res.status(400).json({ error: 'Maximum contestants reached' });
    }

    // Validate video duration
    const { pitch_description, gender, video_url, video_thumbnail, video_duration_seconds } = req.body;
    if (!pitch_description || !pitch_description.trim()) {
      return res.status(400).json({ error: 'Pitch description is required' });
    }
    if (video_duration_seconds) {
      const dur = Number(video_duration_seconds);
      if (dur < ch.video_min_seconds || dur > ch.video_max_seconds) {
        return res.status(400).json({
          error: `Video must be between ${ch.video_min_seconds} and ${ch.video_max_seconds} seconds`,
        });
      }
    }

    const reg = await ChallengeModel.registerContestant({
      challenge_id: ch.id,
      user_id: userId,
      name: user.name || user.email.split('@')[0],
      email: user.email,
      gender: gender || null,
      video_url: video_url || null,
      video_thumbnail: video_thumbnail || null,
      video_duration_seconds: video_duration_seconds ? Number(video_duration_seconds) : 0,
      pitch_description: pitch_description.trim(),
    });

    res.status(201).json(reg);
  } catch (err) {
    console.error('[Challenge] register error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
}

async function getMyRegistration(req, res) {
  try {
    const ch = ChallengeModel.getActiveChallenge();
    if (!ch) return res.status(404).json({ error: 'No active challenge' });

    const reg = ChallengeModel.getRegistrationByUserId(ch.id, req.userId);
    if (!reg) return res.status(404).json({ error: 'Not registered' });
    res.json(reg);
  } catch (err) {
    console.error('[Challenge] getMyRegistration error:', err);
    res.status(500).json({ error: 'Failed to fetch registration' });
  }
}

async function listContestants(req, res) {
  try {
    const ch = ChallengeModel.getActiveChallenge();
    if (!ch) return res.status(404).json({ error: 'No active challenge', items: [] });

    const approved = ChallengeModel.getApprovedRegistrations(ch.id);
    // Return only public-safe fields
    const publicList = approved.map((r) => ({
      id: r.id,
      name: r.name,
      gender: r.gender,
      video_thumbnail: r.video_thumbnail,
      pitch_description: r.pitch_description,
      status: r.status,
      engagement_score: r.engagement_score,
      total_score: r.total_score,
      created_at: r.created_at,
    }));
    res.json({ items: publicList, total: publicList.length });
  } catch (err) {
    console.error('[Challenge] listContestants error:', err);
    res.status(500).json({ error: 'Failed to list contestants' });
  }
}

/* ── Admin ────────────────────────────────────────────────────── */

async function adminListChallenges(req, res) {
  try {
    const list = ChallengeModel.listChallenges();
    res.json({ items: list, total: list.length });
  } catch (err) {
    console.error('[Challenge] adminList error:', err);
    res.status(500).json({ error: 'Failed to list challenges' });
  }
}

async function adminCreateChallenge(req, res) {
  try {
    const ch = await ChallengeModel.createChallenge(req.body);
    res.status(201).json(ch);
  } catch (err) {
    console.error('[Challenge] adminCreate error:', err);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
}

async function adminUpdateChallenge(req, res) {
  try {
    const ch = await ChallengeModel.updateChallenge(req.params.id, req.body);
    if (!ch) return res.status(404).json({ error: 'Challenge not found' });
    res.json(ch);
  } catch (err) {
    console.error('[Challenge] adminUpdate error:', err);
    res.status(500).json({ error: 'Failed to update challenge' });
  }
}

async function adminAdvancePhase(req, res) {
  try {
    const ch = ChallengeModel.getChallengeById(req.params.id);
    if (!ch) return res.status(404).json({ error: 'Challenge not found' });

    const currentIdx = ChallengeModel.PHASES.indexOf(ch.phase);
    if (currentIdx >= ChallengeModel.PHASES.length - 1) {
      return res.status(400).json({ error: 'Already at final phase' });
    }

    const nextPhase = ChallengeModel.PHASES[currentIdx + 1];
    const updated = await ChallengeModel.updateChallenge(ch.id, { phase: nextPhase });
    res.json({ message: `Phase advanced to ${nextPhase}`, challenge: updated });
  } catch (err) {
    console.error('[Challenge] adminAdvancePhase error:', err);
    res.status(500).json({ error: 'Failed to advance phase' });
  }
}

async function adminListRegistrations(req, res) {
  try {
    const { status, limit, offset } = req.query;
    const result = ChallengeModel.listRegistrations({
      challenge_id: req.params.id,
      status,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    res.json(result);
  } catch (err) {
    console.error('[Challenge] adminListRegistrations error:', err);
    res.status(500).json({ error: 'Failed to list registrations' });
  }
}

async function adminUpdateRegistration(req, res) {
  try {
    const reg = await ChallengeModel.updateRegistration(req.params.regId, req.body);
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    res.json(reg);
  } catch (err) {
    console.error('[Challenge] adminUpdateRegistration error:', err);
    res.status(500).json({ error: 'Failed to update registration' });
  }
}

async function adminDeleteRegistration(req, res) {
  try {
    const removed = await ChallengeModel.deleteRegistration(req.params.regId);
    if (!removed) return res.status(404).json({ error: 'Registration not found' });
    res.json({ message: 'Registration deleted' });
  } catch (err) {
    console.error('[Challenge] adminDeleteRegistration error:', err);
    res.status(500).json({ error: 'Failed to delete registration' });
  }
}

module.exports = {
  getActiveChallenge,
  registerForChallenge,
  getMyRegistration,
  listContestants,
  adminListChallenges,
  adminCreateChallenge,
  adminUpdateChallenge,
  adminAdvancePhase,
  adminListRegistrations,
  adminUpdateRegistration,
  adminDeleteRegistration,
};
