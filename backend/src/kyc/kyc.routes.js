/**
 * KYC routes.
 *
 * Auth:   POST /kyc/submit         — submit KYC documents
 *         GET  /kyc/me             — get my KYC status
 * Admin:  GET    /kyc/admin/list     — list all
 *         GET    /kyc/admin/expiring — expiring soon
 *         GET    /kyc/admin/expired  — already expired
 *         GET    /kyc/admin/:id      — single record
 *         PATCH  /kyc/admin/:id      — approve/reject
 *         DELETE /kyc/admin/:id      — delete
 */
const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./kyc.controller');

const router = Router();

// Authenticated user
router.post('/submit', authenticateToken, ctrl.submitKyc);
router.get('/me', authenticateToken, ctrl.getMyKyc);

// Admin
router.get('/admin/list', authenticateToken, ctrl.adminListKyc);
router.get('/admin/expiring', authenticateToken, ctrl.adminGetExpiring);
router.get('/admin/expired', authenticateToken, ctrl.adminGetExpired);
router.get('/admin/:id', authenticateToken, ctrl.adminGetKyc);
router.patch('/admin/:id', authenticateToken, ctrl.adminReviewKyc);
router.delete('/admin/:id', authenticateToken, ctrl.adminDeleteKyc);

module.exports = router;
