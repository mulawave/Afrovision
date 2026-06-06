const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const ctrl = require('./ai_video.controller');

const router = Router();

router.get('/config', optionalAuth, ctrl.getConfig);
router.get('/my-jobs', authenticateToken, ctrl.listMyJobs);
router.get('/jobs/:id', authenticateToken, ctrl.getJob);
router.post('/jobs', authenticateToken, ctrl.createJob);
router.post('/jobs/:id/cancel', authenticateToken, ctrl.cancelJob);
router.post('/jobs/:id/retry', authenticateToken, ctrl.retryJob);
router.post('/source-image/upload-url', authenticateToken, ctrl.getSourceImageUploadUrl);

module.exports = router;
