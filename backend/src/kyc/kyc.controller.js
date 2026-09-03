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
const { extractKycGCSPath, generateKycSignedReadUrl } = require('../utils/gcs');

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
    if (!date_of_birth) {
      return res.status(400).json({ error: 'date_of_birth is required' });
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

    // Set date_of_birth and compute is_minor on user record
    await UserModel.setDateOfBirth(userId, date_of_birth);

    // Check if user is a minor
    const isMinor = UserModel.computeIsMinor(date_of_birth);
    if (isMinor) {
      // Minor — set KYC status to minor_pending, require guardian form
      await UserModel.setKyc(userId, 'minor_pending');
      return res.status(201).json({
        ...record,
        minor: true,
        message: 'You are under 18. A guardian needs to complete a consent form.',
      });
    }

    // Adult — proceed as normal
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
    const user = await UserModel.findById(req.userId);

    const response = { ...(record || {}) };
    if (user) {
      response.is_minor = user.is_minor || false;
      response.kyc_status = user.kyc_status;
      if (user.guardian_id) {
        const GuardianModel = require('../guardian/guardian.model');
        const guardian = await GuardianModel.findById(user.guardian_id);
        if (guardian) {
          response.guardian = guardian;
        }
      }
    }

    if (!record) return res.status(404).json({ error: 'No KYC record', ...response });
    res.json(response);
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

/* ── Helpers ──────────────────────────────────────────────────── */

const KYC_IMAGE_FIELDS = ['id_front_url', 'id_back_url', 'selfie_url'];

/**
 * Replace raw KYC bucket URLs with signed read URLs for admin display.
 * Non-KYC URLs (e.g. older public-bucket uploads) are left as-is.
 */
async function signKycImageUrls(record) {
  if (!record || typeof record !== 'object') return record;
  for (const field of KYC_IMAGE_FIELDS) {
    const rawUrl = record[field];
    if (!rawUrl) continue;
    const path = extractKycGCSPath(rawUrl);
    if (!path) continue;
    try {
      record[field] = await generateKycSignedReadUrl(path, 60);
    } catch (err) {
      console.error(`[KYC] Failed to sign ${field}:`, err.message);
      // Keep the original URL as a fallback.
    }
  }
  return record;
}

async function adminListKyc(req, res) {
  try {
    const { status, limit, offset } = req.query;
    const result = await KycModel.list({
      status,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    if (result.items && result.items.length > 0) {
      result.items = await Promise.all(result.items.map(signKycImageUrls));
    }
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
    res.json(await signKycImageUrls(record));
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

    // Prevent direct verification of minors — they must go through guardian consent
    if (status === 'verified') {
      const existingRecord = await KycModel.findById(req.params.id);
      if (!existingRecord) return res.status(404).json({ error: 'KYC record not found' });
      const kycUser = await UserModel.findById(existingRecord.user_id);
      if (kycUser && kycUser.is_minor === true) {
        return res.status(400).json({ error: 'Cannot verify KYC for a minor. Approve the guardian consent form instead.' });
      }
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

    res.json(await signKycImageUrls(record));
  } catch (err) {
    console.error('[KYC] adminReview error:', err);
    res.status(500).json({ error: 'Failed to review KYC' });
  }
}

async function adminGetExpiring(req, res) {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    const items = await KycModel.getExpiringSoon(days);
    const signedItems = await Promise.all(items.map(signKycImageUrls));
    res.json({ items: signedItems, total: signedItems.length });
  } catch (err) {
    console.error('[KYC] adminGetExpiring error:', err);
    res.status(500).json({ error: 'Failed to get expiring records' });
  }
}

async function adminGetExpired(req, res) {
  try {
    const items = await KycModel.getExpired();
    const signedItems = await Promise.all(items.map(signKycImageUrls));
    res.json({ items: signedItems, total: signedItems.length });
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

async function adminKycStats(req, res) {
  try {
    const counts = await KycModel.countByStatus();
    const pending = (counts.pending || 0) + (counts.under_review || 0) + (counts.minor_pending || 0);
    res.json({ counts, pending });
  } catch (err) {
    console.error('[KYC] adminStats error:', err);
    res.status(500).json({ error: 'Failed to get KYC stats' });
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
  adminKycStats,
};
