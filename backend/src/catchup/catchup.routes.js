const { Router } = require('express');
const ctrl = require('./catchup.controller');

const router = Router();

router.get('/home', ctrl.home);
router.get('/detail', ctrl.detail);

module.exports = router;
