const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const { upload, uploadSingleToGCS } = require('../utils/upload');
const ctrl = require('./user.controller');

const router = Router();

router.get('/me', authenticateToken, ctrl.getProfile);
router.get('/bank-details', authenticateToken, ctrl.getBankDetails);
router.get('/bank-details/banks', authenticateToken, ctrl.listSupportedBanks);
router.post('/bank-details/resolve', authenticateToken, ctrl.resolveBankAccount);
router.post('/bank-details', authenticateToken, ctrl.createBankDetails);
router.put('/update-profile', authenticateToken, ctrl.updateProfile);
router.post('/avatar', authenticateToken, upload.single('avatar'), uploadSingleToGCS, ctrl.uploadAvatar);
router.patch('/currency', authenticateToken, ctrl.updateCurrency);
router.post('/request-creator', authenticateToken, ctrl.requestCreator);
router.get('/device-token', authenticateToken, ctrl.getDeviceToken);
router.post('/fcm-token', authenticateToken, ctrl.registerFcmToken);
router.post('/fcm-token/remove', authenticateToken, ctrl.unregisterFcmToken);
router.get('/following', authenticateToken, ctrl.getFollowingCreators);
router.get('/follows/:creatorId', authenticateToken, ctrl.getFollowStatus);
router.post('/follows/:creatorId', authenticateToken, ctrl.followCreator);
router.delete('/follows/:creatorId', authenticateToken, ctrl.unfollowCreator);

// ── Account Deletion ──
router.post('/delete-account', authenticateToken, ctrl.requestAccountDeletion);
router.get('/delete-account', authenticateToken, ctrl.getDeletionStatus);
router.delete('/delete-account', authenticateToken, ctrl.cancelAccountDeletion);
router.post('/delete-account/confirm', authenticateToken, ctrl.confirmImmediateDeletion);

module.exports = router;
