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
const chatCtrl = require('../chat/chat.controller');

const router = Router();

// ── TV Device (public activation, device-token for the rest) ─────

router.post('/tv/activate', tvCtrl.activate);
// Public and deliberately unauthenticated: a crash can happen before the
// device has any valid token, or with a corrupted one - this must never be
// gated behind auth or it defeats the entire point (there is no other way
// to see what happened on a real TV, since it can't be debugged directly).
router.post('/tv/crash-report', tvCtrl.reportCrash);
router.post('/tv/heartbeat', auth.authenticateTvDevice, tvCtrl.heartbeat);
router.get('/tv/channels', auth.authenticateTvDevice, tvCtrl.getChannels);
router.get('/tv/exclusive/access', auth.authenticateTvDevice, tvCtrl.getExclusiveAccessSummary);
router.get('/tv/channel/:channelNumber', auth.authenticateTvDevice, tvCtrl.getChannelByNumber);
router.get('/tv/messages', auth.authenticateTvDevice, tvCtrl.listMessages);
router.post('/tv/messages/mark-read', auth.authenticateTvDevice, tvCtrl.markMessagesRead);
router.post('/tv/messages/:id/reply', auth.authenticateTvDevice, tvCtrl.replyToMessage);

// ── TV-to-TV Chat (device-token; acts as the device's owner user) ──

function attachDeviceChatUser(req, res, next) {
  req.chatUserId = req.device?.owner_user_id || null;
  next();
}

router.get('/tv/chat/pin', auth.authenticateTvDevice, attachDeviceChatUser, chatCtrl.getMyPin);
router.post('/tv/chat/pin/regenerate', auth.authenticateTvDevice, attachDeviceChatUser, chatCtrl.regeneratePin);
router.post('/tv/chat/connections', auth.authenticateTvDevice, attachDeviceChatUser, chatCtrl.requestConnection);
router.get('/tv/chat/connections', auth.authenticateTvDevice, attachDeviceChatUser, chatCtrl.listConnections);
router.post('/tv/chat/connections/:id/respond', auth.authenticateTvDevice, attachDeviceChatUser, chatCtrl.respondToConnection);
router.get('/tv/chat/connections/:connectionId/messages', auth.authenticateTvDevice, attachDeviceChatUser, chatCtrl.listMessages);
router.post('/tv/chat/connections/:connectionId/messages', auth.authenticateTvDevice, attachDeviceChatUser, chatCtrl.sendMessage);
router.post('/tv/chat/connections/:connectionId/read', auth.authenticateTvDevice, attachDeviceChatUser, chatCtrl.markConnectionRead);
router.get('/tv/chat/unread-summary', auth.authenticateTvDevice, attachDeviceChatUser, chatCtrl.getUnreadSummary);

// ── Library reader (device-token; acts as the device's owner user) ──
// Reuses the same viewer controller the website reader calls
// (channels/:channelId/library/*), just behind device auth instead of a
// user JWT, so the TV reader is byte-for-byte the same flow/data.

const libraryViewerCtrl = require('../library/library-viewer.controller');

function attachDeviceLibraryUser(req, res, next) {
  req.userId = req.device?.owner_user_id || null;
  next();
}

router.get(
  '/tv/library/continue-reading',
  auth.authenticateTvDevice,
  attachDeviceLibraryUser,
  libraryViewerCtrl.getContinueReading
);
router.get(
  '/tv/library/:channelId/:itemId',
  auth.authenticateTvDevice,
  attachDeviceLibraryUser,
  libraryViewerCtrl.getItemDetail
);
router.get(
  '/tv/library/:channelId/:itemId/reader-manifest',
  auth.authenticateTvDevice,
  attachDeviceLibraryUser,
  libraryViewerCtrl.getReaderManifest
);
router.get(
  '/tv/library/:channelId/:itemId/progress',
  auth.authenticateTvDevice,
  attachDeviceLibraryUser,
  libraryViewerCtrl.getProgress
);
router.put(
  '/tv/library/:channelId/:itemId/progress',
  auth.authenticateTvDevice,
  attachDeviceLibraryUser,
  libraryViewerCtrl.updateProgress
);

// ── Exclusive content (device-token; acts as the device's owner user) ──
// Same channel-scoped viewer controllers the website uses for movies,
// series, and library items - just reused behind device auth so a TV can
// browse a single exclusive channel's catalog across all three content
// types without a user JWT.

const movieViewerCtrl = require('../movies/movie-viewer.controller');
const seriesViewerCtrl = require('../series/series-viewer.controller');

router.get(
  '/tv/exclusive/:channelId/movies',
  auth.authenticateTvDevice,
  attachDeviceLibraryUser,
  movieViewerCtrl.listChannelMovies
);
router.get(
  '/tv/exclusive/:channelId/series',
  auth.authenticateTvDevice,
  attachDeviceLibraryUser,
  seriesViewerCtrl.listChannelSeries
);
router.get(
  '/tv/exclusive/:channelId/library',
  auth.authenticateTvDevice,
  attachDeviceLibraryUser,
  libraryViewerCtrl.listItems
);

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

// ── Admin: TV-to-TV chat moderation ─────────────────────────────

router.get('/admin/chat/connections', authenticateToken, chatCtrl.adminListConnections);
router.get('/admin/chat/connections/:connectionId/messages', authenticateToken, chatCtrl.adminListMessages);
router.patch('/admin/chat/connections/:connectionId', authenticateToken, chatCtrl.adminSetConnectionStatus);

module.exports = router;
