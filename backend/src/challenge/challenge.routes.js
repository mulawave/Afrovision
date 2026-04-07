/**
 * Challenge routes.
 *
 * Public:  GET  /challenge/active             — current active challenge
 *          GET  /challenge/contestants         — approved contestants (public)
 * Auth:    POST /challenge/register            — register for challenge
 *          GET  /challenge/my                  — get my registration
 * Admin:   GET    /challenge/admin/list                        — all challenges
 *          POST   /challenge/admin/create                      — create challenge
 *          PATCH  /challenge/admin/:id                         — update challenge
 *          PATCH  /challenge/admin/:id/phase                   — advance phase
 *          GET    /challenge/admin/:id/registrations           — list registrations
 *          PATCH  /challenge/admin/registrations/:regId        — update registration
 *          DELETE /challenge/admin/registrations/:regId        — delete registration
 */
const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./challenge.controller');

const router = Router();

// Public
router.get('/active', ctrl.getActiveChallenge);
router.get('/contestants', ctrl.listContestants);

// Authenticated user
router.post('/register', authenticateToken, ctrl.registerForChallenge);
router.get('/my', authenticateToken, ctrl.getMyRegistration);

// Admin
router.get('/admin/list', authenticateToken, ctrl.adminListChallenges);
router.post('/admin/create', authenticateToken, ctrl.adminCreateChallenge);
router.get('/admin/registrations', authenticateToken, ctrl.adminListAllRegistrations);
router.patch('/admin/registrations/:regId', authenticateToken, ctrl.adminUpdateRegistration);
router.delete('/admin/registrations/:regId', authenticateToken, ctrl.adminDeleteRegistration);
router.patch('/admin/:id/phase', authenticateToken, ctrl.adminAdvancePhase);
router.get('/admin/:id/registrations', authenticateToken, ctrl.adminListRegistrations);
router.patch('/admin/:id', authenticateToken, ctrl.adminUpdateChallenge);
router.delete('/admin/:id', authenticateToken, ctrl.adminDeleteChallenge);

module.exports = router;
