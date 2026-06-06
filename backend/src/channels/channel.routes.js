const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const ctrl = require('./channel.controller');
const premiumCtrl = require('./premium_stream.controller');
const exclusiveCtrl = require('./exclusive_channel.controller');
const { upload, uploadSingleToGCS, uploadFieldsToGCS } = require('../utils/upload');

const router = Router();

router.post('/', authenticateToken, ctrl.createChannel);
router.post('/create-with-media', authenticateToken, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), uploadFieldsToGCS, ctrl.createChannelWithMedia);
router.get('/', optionalAuth, ctrl.getPublicChannels);
router.get('/featured', optionalAuth, ctrl.getFeaturedChannels);
router.get('/me', authenticateToken, ctrl.getMyChannels);
// Must come before /:id routes
router.get('/my-accesses', authenticateToken, premiumCtrl.getMyAccesses);
router.get('/subscriber-feed', authenticateToken, ctrl.getSubscriberFeed);
router.post('/resolve-source', authenticateToken, ctrl.resolveStreamSource);
router.patch('/admin/:id/featured', authenticateToken, ctrl.adminSetFeatured);
router.get('/:id/exclusive/access-status', authenticateToken, exclusiveCtrl.checkExclusiveAccessStatus);
router.post('/:id/exclusive/purchase', authenticateToken, exclusiveCtrl.purchaseExclusiveAccess);
router.post('/:id/exclusive/verify-pic', authenticateToken, exclusiveCtrl.verifyExclusivePic);
router.post('/:id/exclusive/renew', authenticateToken, exclusiveCtrl.renewExclusiveAccess);
router.patch('/:id/exclusive-settings', authenticateToken, exclusiveCtrl.updateExclusiveSettings);
router.get('/number/:channelNumber', authenticateToken, ctrl.getChannelByNumber);
router.get('/:id', optionalAuth, ctrl.getChannelById);
router.get('/:id/access', authenticateToken, premiumCtrl.checkAccess);
router.post('/:id/pay', authenticateToken, premiumCtrl.payForAccess);
router.post('/:id/request-premium', authenticateToken, premiumCtrl.requestPremiumElevation);
router.post('/:id/view', authenticateToken, ctrl.recordView);
router.post('/:id/recheck-source', authenticateToken, ctrl.recheckStreamHealth);
router.patch('/:id/enable', authenticateToken, ctrl.enableChannel);
router.patch('/:id/external-source', authenticateToken, ctrl.updateExternalSource);
router.post('/:id/upload/:mediaType', authenticateToken, upload.single('file'), uploadSingleToGCS, ctrl.uploadMedia);
router.patch('/:id', authenticateToken, ctrl.updateChannel);
router.delete('/:id', authenticateToken, ctrl.deleteChannel);

module.exports = router;
