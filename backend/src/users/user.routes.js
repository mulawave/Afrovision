const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./user.controller');

const router = Router();

router.get('/me', authenticateToken, ctrl.getProfile);
router.put('/update-profile', authenticateToken, ctrl.updateProfile);
router.patch('/currency', authenticateToken, ctrl.updateCurrency);
router.post('/request-creator', authenticateToken, ctrl.requestCreator);
router.post('/fcm-token', authenticateToken, ctrl.registerFcmToken);
router.post('/fcm-token/remove', authenticateToken, ctrl.unregisterFcmToken);
router.get('/following', authenticateToken, ctrl.getFollowingCreators);
router.get('/follows/:creatorId', authenticateToken, ctrl.getFollowStatus);
router.post('/follows/:creatorId', authenticateToken, ctrl.followCreator);
router.delete('/follows/:creatorId', authenticateToken, ctrl.unfollowCreator);

module.exports = router;
