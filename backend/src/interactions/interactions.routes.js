const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./interactions.controller');
const chatCtrl = require('./chat.controller');
const { upload, uploadSingleToGCS } = require('../utils/upload');

const router = Router();

// ─── Gifts catalog ───────────────────────────────────────
router.get('/gifts', authenticateToken, ctrl.getGifts);
router.get('/gifts/all', authenticateToken, ctrl.getAllGifts);
router.post('/gifts', authenticateToken, ctrl.createGift);
router.patch('/gifts/:giftId', authenticateToken, ctrl.updateGift);
router.delete('/gifts/:giftId', authenticateToken, ctrl.deleteGift);

// ─── Gift image upload (admin only) ─────────────────────
router.post('/gifts/upload-image', authenticateToken, upload.single('image'), uploadSingleToGCS, ctrl.uploadGiftImage);

// ─── Gift wallet ─────────────────────────────────────────
router.get('/wallet', authenticateToken, ctrl.getMyGiftWallet);

// ─── Send ────────────────────────────────────────────────
router.post('/reactions', authenticateToken, ctrl.sendReaction);
router.post('/gifts/send', authenticateToken, ctrl.sendGift);

// ─── Read ────────────────────────────────────────────────
router.get('/combo', authenticateToken, ctrl.getCombo);
router.get('/leaderboard/:channelId', authenticateToken, ctrl.getLeaderboard);
router.get('/events/:channelId', authenticateToken, ctrl.getChannelEvents);
router.get('/chat/:channelId/messages', authenticateToken, chatCtrl.getMessages);

module.exports = router;
