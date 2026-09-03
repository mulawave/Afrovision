/**
 * Guardian controller.
 *
 * Auth:  POST   /guardian/submit        — submit guardian form
 *        GET    /guardian/me            — get my guardian record
 * Admin: GET    /guardian/admin/list    — list all guardian records
 *        GET    /guardian/admin/:id     — get single record
 *        PATCH  /guardian/admin/:id/review — approve/reject
 *        DELETE /guardian/admin/:id     — delete record
 */
const GuardianModel = require('./guardian.model');
const UserModel = require('../users/user.model');

async function submit(req, res) {
  try {
    const userId = req.userId;
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.is_minor) {
      return res.status(400).json({ error: 'Guardian form is only for minors' });
    }

    const {
      guardian_full_name, guardian_email, guardian_phone,
      guardian_relationship, guardian_address,
      guardian_id_type, guardian_id_number,
      guardian_id_front_url, guardian_id_back_url, guardian_selfie_url,
      guardian_account_uid,
      consent_declaration, consent_signature,
    } = req.body;

    // Validate required fields
    if (!guardian_full_name || !guardian_email || !guardian_phone) {
      return res.status(400).json({ error: 'guardian_full_name, guardian_email, and guardian_phone are required' });
    }
    if (!guardian_relationship || !GuardianModel.RELATIONSHIPS.includes(guardian_relationship)) {
      return res.status(400).json({ error: `guardian_relationship must be one of: ${GuardianModel.RELATIONSHIPS.join(', ')}` });
    }
    if (!consent_declaration || !consent_signature) {
      return res.status(400).json({ error: 'consent_declaration and consent_signature are required' });
    }

    // If linking existing account, verify it exists and is KYC verified
    if (guardian_account_uid) {
      const guardianUser = await UserModel.findById(guardian_account_uid);
      if (!guardianUser) {
        return res.status(400).json({ error: 'Guardian account not found' });
      }
      if (guardianUser.kyc_status !== 'verified') {
        return res.status(400).json({ error: 'Guardian account must be KYC verified' });
      }
    } else {
      // Document upload path — require at least ID front and selfie
      if (!guardian_id_type || !guardian_id_number) {
        return res.status(400).json({ error: 'guardian_id_type and guardian_id_number are required when not linking an existing account' });
      }
      if (!guardian_id_front_url) {
        return res.status(400).json({ error: 'Guardian ID front image is required' });
      }
      if (!guardian_selfie_url) {
        return res.status(400).json({ error: 'Guardian selfie image is required' });
      }
    }

    // Check for existing record
    const existing = await GuardianModel.findByUserId(userId);
    if (existing && existing.status === 'pending') {
      return res.status(409).json({ error: 'Guardian form already submitted and pending review', guardian: existing });
    }

    const record = await GuardianModel.submit({
      minor_user_id: userId,
      guardian_full_name: guardian_full_name.trim(),
      guardian_email: guardian_email.trim().toLowerCase(),
      guardian_phone: guardian_phone.trim(),
      guardian_relationship,
      guardian_address: guardian_address || null,
      guardian_id_type: guardian_id_type || null,
      guardian_id_number: guardian_id_number ? guardian_id_number.trim() : null,
      guardian_id_front_url: guardian_id_front_url || null,
      guardian_id_back_url: guardian_id_back_url || null,
      guardian_selfie_url: guardian_selfie_url || null,
      guardian_account_uid: guardian_account_uid || null,
      consent_declaration,
      consent_signature,
      consent_date: new Date().toISOString(),
    });

    // Update minor user's KYC status to pending (guardian review)
    await UserModel.setKyc(userId, 'pending');

    res.status(201).json(record);
  } catch (err) {
    console.error('[Guardian] submit error:', err);
    res.status(500).json({ error: 'Failed to submit guardian form' });
  }
}

async function getMine(req, res) {
  try {
    const record = await GuardianModel.findByUserId(req.userId);
    if (!record) return res.status(404).json({ error: 'No guardian record' });
    res.json(record);
  } catch (err) {
    console.error('[Guardian] getMine error:', err);
    res.status(500).json({ error: 'Failed to fetch guardian record' });
  }
}

async function adminList(req, res) {
  try {
    const { status, limit, offset } = req.query;
    const result = await GuardianModel.list({
      status,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    res.json(result);
  } catch (err) {
    console.error('[Guardian] adminList error:', err);
    res.status(500).json({ error: 'Failed to list guardian records' });
  }
}

async function adminGet(req, res) {
  try {
    const record = await GuardianModel.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Guardian record not found' });
    res.json(record);
  } catch (err) {
    console.error('[Guardian] adminGet error:', err);
    res.status(500).json({ error: 'Failed to fetch guardian record' });
  }
}

async function adminReview(req, res) {
  try {
    const { decision, review_notes, rejection_reason } = req.body;
    const status = decision;
    if (!status || !['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'decision must be "verified" or "rejected"' });
    }

    const record = await GuardianModel.update(req.params.id, {
      status,
      reviewer_id: req.userId,
      review_notes: review_notes || null,
      rejection_reason: status === 'rejected' ? (rejection_reason || null) : null,
      reviewed_at: new Date().toISOString(),
    });
    if (!record) return res.status(404).json({ error: 'Guardian record not found' });

    if (status === 'verified') {
      // Set minor user's KYC status to verified, link guardian
      await UserModel.setKyc(record.minor_user_id, 'verified');
      await UserModel.setGuardian(record.minor_user_id, record.id);
    } else {
      // Rejected — reset KYC status to none
      await UserModel.setKyc(record.minor_user_id, 'none');
    }

    res.json(record);
  } catch (err) {
    console.error('[Guardian] adminReview error:', err);
    res.status(500).json({ error: 'Failed to review guardian record' });
  }
}

async function adminDelete(req, res) {
  try {
    const removed = await GuardianModel.deleteRecord(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Guardian record not found' });
    res.json({ message: 'Guardian record deleted' });
  } catch (err) {
    console.error('[Guardian] adminDelete error:', err);
    res.status(500).json({ error: 'Failed to delete guardian record' });
  }
}

module.exports = {
  submit,
  getMine,
  adminList,
  adminGet,
  adminReview,
  adminDelete,
};
