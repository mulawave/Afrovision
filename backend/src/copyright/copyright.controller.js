/**
 * Copyright Report controller.
 */
const CopyrightReport = require('./copyright.model');

/**
 * POST /copyright/report — Public (no auth required)
 * Submit a new copyright infringement report.
 */
async function submitReport(req, res) {
  try {
    const { fullName, email, copyrightWorkDescription, infringingContentUrls, signature } = req.body;

    // Validate required fields
    if (!fullName || !email || !copyrightWorkDescription || !infringingContentUrls || !signature) {
      return res.status(400).json({ error: 'Missing required fields: fullName, email, copyrightWorkDescription, infringingContentUrls, signature' });
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const report = await CopyrightReport.create(req.body);
    res.status(201).json({ trackingId: report.trackingId, status: report.status, createdAt: report.createdAt });
  } catch (err) {
    console.error('[Copyright] submitReport error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
}

/**
 * GET /copyright/reports — Admin only
 * List copyright reports with optional status filter.
 */
async function listReports(req, res) {
  try {
    const { status, limit, startAfter } = req.query;
    const reports = await CopyrightReport.list({
      status: status || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      startAfter: startAfter || undefined,
    });
    res.json({ reports, count: reports.length });
  } catch (err) {
    console.error('[Copyright] listReports error:', err);
    res.status(500).json({ error: 'Failed to list reports' });
  }
}

/**
 * GET /copyright/reports/:id — Admin only
 * Get a single copyright report by tracking ID.
 */
async function getReport(req, res) {
  try {
    const report = await CopyrightReport.getById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (err) {
    console.error('[Copyright] getReport error:', err);
    res.status(500).json({ error: 'Failed to get report' });
  }
}

/**
 * PATCH /copyright/reports/:id — Admin only
 * Update report status and/or admin notes.
 */
async function updateReport(req, res) {
  try {
    const { status, adminNotes } = req.body;
    const validStatuses = Object.values(CopyrightReport.STATUS);

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const existing = await CopyrightReport.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Report not found' });

    const updated = await CopyrightReport.updateStatus(
      req.params.id,
      status || existing.status,
      adminNotes,
    );
    res.json(updated);
  } catch (err) {
    console.error('[Copyright] updateReport error:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
}

module.exports = { submitReport, listReports, getReport, updateReport };
