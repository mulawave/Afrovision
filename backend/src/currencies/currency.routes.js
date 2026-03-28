const { Router } = require('express');
const ctrl = require('./currency.controller');

const router = Router();

router.get('/', ctrl.getCurrencies);
router.get('/plans', ctrl.getConvertedPlans);

module.exports = router;
