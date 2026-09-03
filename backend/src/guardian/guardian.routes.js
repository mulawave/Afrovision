/**
 * Guardian routes.
 *
 * Auth:  POST   /guardian/submit
 *        GET    /guardian/me
 * Admin: GET    /guardian/admin/list
 *        GET    /guardian/admin/:id
 *        PATCH  /guardian/admin/:id/review
 *        DELETE /guardian/admin/:id
 */
const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./guardian.controller');

const router = Router();

router.post('/submit', authenticateToken, ctrl.submit);
router.get('/me', authenticateToken, ctrl.getMine);

// Admin
router.get('/admin/list', authenticateToken, ctrl.adminList);
router.get('/admin/:id', authenticateToken, ctrl.adminGet);
router.patch('/admin/:id/review', authenticateToken, ctrl.adminReview);
router.delete('/admin/:id', authenticateToken, ctrl.adminDelete);

module.exports = router;
