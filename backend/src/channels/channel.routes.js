const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./channel.controller');
const { upload } = require('../utils/upload');

const router = Router();

router.post('/', authenticateToken, ctrl.createChannel);
router.post('/create-with-media', authenticateToken, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), ctrl.createChannelWithMedia);
router.get('/', ctrl.getPublicChannels);
router.get('/me', authenticateToken, ctrl.getMyChannels);
router.get('/number/:channelNumber', authenticateToken, ctrl.getChannelByNumber);
router.get('/:id', authenticateToken, ctrl.getChannelById);
router.patch('/:id/enable', authenticateToken, ctrl.enableChannel);
router.post('/:id/upload/:mediaType', authenticateToken, upload.single('file'), ctrl.uploadMedia);
router.patch('/:id', authenticateToken, ctrl.updateChannel);
router.delete('/:id', authenticateToken, ctrl.deleteChannel);

module.exports = router;
