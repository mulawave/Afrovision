/**
 * Challenge routes.
 *
 * Public:  GET  /challenge/active                                — current active challenge
 *          GET  /challenge/contestants                           — approved contestants (public)
 *          GET  /challenge/audition/payment/pricing              — live fee + vPT allocation preview
 * Auth:    POST /challenge/register                              — register for challenge
 *          GET  /challenge/my                                    — get my registration
 *          GET  /challenge/audition/status                       — current user's audition signup status
 *          POST /challenge/audition/payment/initialize           — initiate audition payment (AV-CHL-003)
 *          POST /challenge/audition/payment/:paymentId/verify    — verify + enrol  (AV-CHL-003)
 * Admin:   GET    /challenge/admin/list                        — all challenges
 *          POST   /challenge/admin/create                      — create challenge
 *          PATCH  /challenge/admin/:id                         — update challenge
 *          PATCH  /challenge/admin/:id/phase                   — advance phase
 *          GET    /challenge/admin/:id/registrations           — list registrations
 *          PATCH  /challenge/admin/registrations/:regId        — update registration
 *          DELETE /challenge/admin/registrations/:regId        — delete registration
 *          GET    /challenge/admin/audition-signups            — list paid audition signups
 *          GET    /challenge/admin/audition-signups/:id        — get single audition signup
 *          PATCH  /challenge/admin/audition-signups/:id        — update audition signup
 *          POST   /challenge/admin/audition-signups/:id/resend-email — resend confirmation email
 *          DELETE /challenge/admin/audition-signups/:id        — delete audition signup
 */
const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./challenge.controller');
const auditionCtrl = require('./audition_signup.controller');
const auditionPaymentCtrl = require('./audition_payment.controller');

const router = Router();

// Public
router.get('/active', ctrl.getActiveChallenge);
router.get('/contestants', ctrl.listContestants);
router.get('/audition/payment/pricing', auditionPaymentCtrl.getAuditionPricing);

// Authenticated user
router.post('/register', authenticateToken, ctrl.registerForChallenge);
router.get('/my', authenticateToken, ctrl.getMyRegistration);
router.get('/audition/status', authenticateToken, auditionCtrl.getMyAuditionStatus);

// Audition payment (AV-CHL-003) — declared before /:id wildcards
router.post('/audition/payment/initialize', authenticateToken, auditionPaymentCtrl.initializeAuditionPayment);
router.post('/audition/payment/:paymentId/verify', authenticateToken, auditionPaymentCtrl.verifyAuditionPayment);

// Admin — audition signups (must come before /:id routes to avoid shadowing)
router.get('/admin/audition-signups', authenticateToken, auditionCtrl.adminListSignups);
router.get('/admin/audition-signups/:id', authenticateToken, auditionCtrl.adminGetSignup);
router.patch('/admin/audition-signups/:id', authenticateToken, auditionCtrl.adminUpdateSignup);
router.post('/admin/audition-signups/:id/resend-email', authenticateToken, auditionCtrl.adminResendSignupEmail);
router.delete('/admin/audition-signups/:id', authenticateToken, auditionCtrl.adminDeleteSignup);

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
