/**
 * KYC routes.
 *
 * Auth:   POST /kyc/submit         — submit KYC documents
 *         GET  /kyc/me             — get my KYC status
 * Admin:  GET    /kyc/admin/list     — list all
 *         GET    /kyc/admin/expiring — expiring soon
 *         GET    /kyc/admin/expired  — already expired
 *         GET    /kyc/admin/:id      — single record
 *         PATCH  /kyc/admin/:id/review — approve/reject
 *         DELETE /kyc/admin/:id          — delete
 */
const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const { upload, uploadSingleToGCS } = require('../utils/upload');
const ctrl = require('./kyc.controller');

const router = Router();

// Authenticated user
router.post('/upload-doc', authenticateToken, upload.single('file'), uploadSingleToGCS, ctrl.uploadKycDoc);
router.post('/submit', authenticateToken, ctrl.submitKyc);
router.get('/me', authenticateToken, ctrl.getMyKyc);
router.patch('/gender', authenticateToken, ctrl.updateMyGender);

// Admin
router.get('/admin/list', authenticateToken, ctrl.adminListKyc);
router.get('/admin/expiring', authenticateToken, ctrl.adminGetExpiring);
router.get('/admin/expired', authenticateToken, ctrl.adminGetExpired);
router.get('/admin/:id', authenticateToken, ctrl.adminGetKyc);
router.patch('/admin/:id/review', authenticateToken, ctrl.adminReviewKyc);
router.delete('/admin/:id', authenticateToken, ctrl.adminDeleteKyc);

module.exports = router;
