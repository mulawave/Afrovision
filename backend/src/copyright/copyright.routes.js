/**
 * Copyright Report routes.
 *
 * Public:  POST /copyright/report        — submit a report
 * Admin:   GET  /copyright/reports        — list reports
 *          GET  /copyright/reports/:id    — get single report
 *          PATCH /copyright/reports/:id   — update status
 */
const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./copyright.controller');

const router = Router();

// Public — anyone can submit a copyright report
router.post('/report', ctrl.submitReport);

// Admin-only — manage reports
router.get('/reports',      authenticateToken, ctrl.listReports);
router.get('/reports/:id',  authenticateToken, ctrl.getReport);
router.patch('/reports/:id', authenticateToken, ctrl.updateReport);

module.exports = router;
