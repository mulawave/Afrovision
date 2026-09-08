/**
 * Watch Progress Routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./progress.controller');

// Aggregate: caller's in-progress items across all media types. Must be
// registered BEFORE the /:mediaType/:mediaId route or Express treats "me"
// as a mediaType.
router.get('/me', authenticateToken, ctrl.listMine);

router.put('/:mediaType/:mediaId', authenticateToken, ctrl.saveProgress);
router.get('/:mediaType/:mediaId', authenticateToken, ctrl.getProgress);

module.exports = router;
