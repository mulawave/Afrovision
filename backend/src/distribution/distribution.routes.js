/**
 * Distribution Routes
 * Mounts all distribution platform endpoints under /distribution.
 *
 * Three auth layers:
 *   - authenticateToken (standard user JWT) for admin endpoints
 *   - authenticateDistributor for distributor portal endpoints
 *   - authenticateMarketer for marketer app endpoints
 *   - authenticateTvDevice for TV device endpoints
 *   - Public: TV activation, distributor login, marketer login
 */

const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const auth = require('./distribution.auth');

const tvCtrl = require('./tv.controller');
const marketerCtrl = require('./marketer.controller');
const distributorCtrl = require('./distributor.controller');
const adminCtrl = require('./admin.controller');

const router = Router();

// ── TV Device (public activation, device-token for the rest) ─────

router.post('/tv/activate', tvCtrl.activate);
router.post('/tv/heartbeat', auth.authenticateTvDevice, tvCtrl.heartbeat);
router.get('/tv/channels', auth.authenticateTvDevice, tvCtrl.getChannels);
router.get('/tv/channel/:channelNumber', auth.authenticateTvDevice, tvCtrl.getChannelByNumber);
router.get('/tv/messages', auth.authenticateTvDevice, tvCtrl.listMessages);
router.post('/tv/messages/mark-read', auth.authenticateTvDevice, tvCtrl.markMessagesRead);
router.post('/tv/messages/:id/reply', auth.authenticateTvDevice, tvCtrl.replyToMessage);

// ── Marketer (public login, marketer-token for the rest) ─────────

router.post('/marketer/login', marketerCtrl.login);
router.get('/marketer/me', auth.authenticateMarketer, marketerCtrl.me);
router.post('/marketer/codes/request', auth.authenticateMarketer, marketerCtrl.requestCode);
router.get('/marketer/codes', auth.authenticateMarketer, marketerCtrl.listCodes);

// ── Distributor (public login, distributor-token for the rest) ────

router.post('/distributor/login', distributorCtrl.login);
router.get('/distributor/me', auth.authenticateDistributor, distributorCtrl.me);
router.get('/distributor/marketers', auth.authenticateDistributor, distributorCtrl.listMarketers);
router.post('/distributor/marketers', auth.authenticateDistributor, distributorCtrl.createMarketer);
router.patch('/distributor/marketers/:id', auth.authenticateDistributor, distributorCtrl.updateMarketer);
router.get('/distributor/codes', auth.authenticateDistributor, distributorCtrl.listCodes);
router.get('/distributor/devices', auth.authenticateDistributor, distributorCtrl.listDevices);
router.get('/distributor/financials', auth.authenticateDistributor, distributorCtrl.getFinancials);
router.post('/distributor/devices/:deviceId/request-disable', auth.authenticateDistributor, distributorCtrl.requestDeviceDisable);

// ── Admin (standard user JWT + role check inside each controller) ─

router.get('/admin/overview', authenticateToken, adminCtrl.overview);
router.get('/admin/distributors', authenticateToken, adminCtrl.listDistributors);
router.get('/admin/distributors/:id', authenticateToken, adminCtrl.getDistributor);
router.post('/admin/distributors', authenticateToken, adminCtrl.createDistributor);
router.patch('/admin/distributors/:id', authenticateToken, adminCtrl.updateDistributor);
router.delete('/admin/distributors/:id', authenticateToken, adminCtrl.deleteDistributor);
router.get('/admin/marketers', authenticateToken, adminCtrl.listMarketers);
router.patch('/admin/marketers/:id', authenticateToken, adminCtrl.updateMarketer);
router.get('/admin/devices', authenticateToken, adminCtrl.listDevices);
router.patch('/admin/devices/:deviceId', authenticateToken, adminCtrl.updateDevice);
router.get('/admin/settings', authenticateToken, adminCtrl.getSettings);
router.patch('/admin/settings', authenticateToken, adminCtrl.updateSettings);
router.get('/admin/ledger', authenticateToken, adminCtrl.getLedger);
router.post('/admin/messages', authenticateToken, adminCtrl.createMessage);
router.get('/admin/messages', authenticateToken, adminCtrl.listMessages);
router.get('/admin/messages/:id/replies', authenticateToken, adminCtrl.listMessageReplies);

module.exports = router;
