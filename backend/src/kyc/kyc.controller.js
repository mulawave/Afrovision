/**
 * KYC controller.
 *
 * Public (auth): POST /kyc/submit           — submit KYC documents
 *                GET  /kyc/me               — get my KYC status
 * Admin:         GET  /kyc/admin/list       — list all KYC records
 *                GET  /kyc/admin/:id        — get single record
 *                PATCH /kyc/admin/:id       — approve/reject
 *                GET  /kyc/admin/expiring   — records expiring soon
 *                GET  /kyc/admin/expired    — already expired records
 *                DELETE /kyc/admin/:id      — delete record
 */
const KycModel = require('./kyc.model');
const UserModel = require('../users/user.model');
const ReputationService = require('../reputation/reputation.service');

/* ── User-facing ──────────────────────────────────────────────── */

async function uploadKycDoc(req, res) {
  try {
    if (!req.file || !req.file.gcsUrl) {
      return res.status(400).json({ error: 'File is required' });
    }
    res.json({ url: req.file.gcsUrl });
  } catch (err) {
    console.error('[KYC] upload error:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
}

async function submitKyc(req, res) {
  try {
    const userId = req.userId;
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if already has a pending/verified KYC
    const existing = await KycModel.findByUserId(userId);
    if (existing && ['pending', 'under_review'].includes(existing.status)) {
      return res.status(409).json({ error: 'KYC already submitted and pending review', kyc: existing });
    }
    if (existing && existing.status === 'verified') {
      // Check if expired
      if (existing.id_expiry_date && new Date(existing.id_expiry_date) > new Date()) {
        return res.status(409).json({ error: 'KYC already verified', kyc: existing });
      }
      // If expired, allow re-submission as renewal
    }

    const {
      full_name, gender, date_of_birth, nationality, phone, address,
      id_type, id_number, id_front_url, id_back_url, id_expiry_date,
      selfie_url, biometric_hash,
    } = req.body;

    // Validate required fields
    if (!full_name || !id_type || !id_number) {
      return res.status(400).json({ error: 'full_name, id_type, and id_number are required' });
    }
    if (!KycModel.ID_TYPES.includes(id_type)) {
      return res.status(400).json({ error: `Invalid id_type. Must be one of: ${KycModel.ID_TYPES.join(', ')}` });
    }
    if (!id_front_url) {
      return res.status(400).json({ error: 'ID front image is required' });
    }
    if (!selfie_url) {
      return res.status(400).json({ error: 'Selfie image is required for biometric verification' });
    }

    const record = await KycModel.submit({
      user_id: userId,
      full_name: full_name.trim(),
      gender: gender || null,
      date_of_birth,
      nationality: nationality || 'NG',
      phone,
      address,
      id_type,
      id_number: id_number.trim(),
      id_front_url,
      id_back_url,
      id_expiry_date,
      selfie_url,
      biometric_hash,
      previous_kyc_id: existing ? existing.id : null,
    });

    // Update user KYC status
    await UserModel.setKyc(userId, 'pending');

    res.status(201).json(record);
  } catch (err) {
    console.error('[KYC] submit error:', err);
    res.status(500).json({ error: 'Failed to submit KYC' });
  }
}

async function getMyKyc(req, res) {
  try {
    const record = await KycModel.findByUserId(req.userId);
    if (!record) return res.status(404).json({ error: 'No KYC record' });
    res.json(record);
  } catch (err) {
    console.error('[KYC] getMyKyc error:', err);
    res.status(500).json({ error: 'Failed to fetch KYC' });
  }
}

async function updateMyGender(req, res) {
  try {
    const { gender } = req.body;
    const validGenders = ['male', 'female', 'non_binary', 'prefer_not_to_say'];
    if (!gender || !validGenders.includes(gender)) {
      return res.status(400).json({ error: `gender must be one of: ${validGenders.join(', ')}` });
    }
    const updated = await KycModel.updateGender(req.userId, gender);
    if (!updated) return res.status(404).json({ error: 'No KYC record found to update' });
    res.json({ message: 'Gender updated', gender: updated.gender });
  } catch (err) {
    console.error('[KYC] updateMyGender error:', err);
    res.status(500).json({ error: 'Failed to update gender' });
  }
}

/* ── Admin ────────────────────────────────────────────────────── */

async function adminListKyc(req, res) {
  try {
    const { status, limit, offset } = req.query;
    const result = await KycModel.list({
      status,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    res.json(result);
  } catch (err) {
    console.error('[KYC] adminList error:', err);
    res.status(500).json({ error: 'Failed to list KYC records' });
  }
}

async function adminGetKyc(req, res) {
  try {
    const record = await KycModel.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'KYC record not found' });
    res.json(record);
  } catch (err) {
    console.error('[KYC] adminGet error:', err);
    res.status(500).json({ error: 'Failed to fetch KYC record' });
  }
}

async function adminReviewKyc(req, res) {
  try {
    const { decision, status: rawStatus, review_notes, rejection_reason } = req.body;
    const status = decision || rawStatus;
    if (!status || !['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "verified" or "rejected"' });
    }

    const record = await KycModel.update(req.params.id, {
      status,
      reviewer_id: req.userId,
      review_notes: review_notes || null,
      rejection_reason: status === 'rejected' ? (rejection_reason || null) : null,
      reviewed_at: new Date().toISOString(),
    });
    if (!record) return res.status(404).json({ error: 'KYC record not found' });

    // Sync user KYC status
    await UserModel.setKyc(record.user_id, status === 'verified' ? 'verified' : 'none');

    // Refresh stored community_pool_eligible so it reflects the new KYC status immediately
    ReputationService.refreshEligibility(record.user_id).catch((err) =>
      console.error('[KYC] refreshEligibility error:', err.message),
    );

    res.json(record);
  } catch (err) {
    console.error('[KYC] adminReview error:', err);
    res.status(500).json({ error: 'Failed to review KYC' });
  }
}

async function adminGetExpiring(req, res) {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    const items = await KycModel.getExpiringSoon(days);
    res.json({ items, total: items.length });
  } catch (err) {
    console.error('[KYC] adminGetExpiring error:', err);
    res.status(500).json({ error: 'Failed to get expiring records' });
  }
}

async function adminGetExpired(req, res) {
  try {
    const items = await KycModel.getExpired();
    res.json({ items, total: items.length });
  } catch (err) {
    console.error('[KYC] adminGetExpired error:', err);
    res.status(500).json({ error: 'Failed to get expired records' });
  }
}

async function adminDeleteKyc(req, res) {
  try {
    const removed = await KycModel.deleteRecord(req.params.id);
    if (!removed) return res.status(404).json({ error: 'KYC record not found' });
    res.json({ message: 'KYC record deleted' });
  } catch (err) {
    console.error('[KYC] adminDelete error:', err);
    res.status(500).json({ error: 'Failed to delete KYC record' });
  }
}

module.exports = {
  uploadKycDoc,
  submitKyc,
  getMyKyc,
  updateMyGender,
  adminListKyc,
  adminGetKyc,
  adminReviewKyc,
  adminGetExpiring,
  adminGetExpired,
  adminDeleteKyc,
};
