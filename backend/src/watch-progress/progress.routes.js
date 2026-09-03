/**
 * Watch Progress Routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./progress.controller');

router.put('/:mediaType/:mediaId', authenticateToken, ctrl.saveProgress);
router.get('/:mediaType/:mediaId', authenticateToken, ctrl.getProgress);

module.exports = router;
