const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./admin.controller');

const router = Router();

router.post('/set-role', authenticateToken, ctrl.setRole);
router.post('/set-premium', authenticateToken, ctrl.setPremium);
router.post('/set-kyc', authenticateToken, ctrl.setKyc);

// Plan management
router.post('/plans', authenticateToken, ctrl.createPlan);
router.patch('/plans/:id', authenticateToken, ctrl.updatePlan);
router.delete('/plans/:id', authenticateToken, ctrl.deletePlan);
router.post('/plans/:id/features', authenticateToken, ctrl.addFeatureToPlan);
router.delete('/plans/:id/features/:feature', authenticateToken, ctrl.removeFeatureFromPlan);

// Category management
router.get('/categories', authenticateToken, ctrl.getCategories);
router.post('/categories', authenticateToken, ctrl.createCategory);
router.patch('/categories/:id', authenticateToken, ctrl.updateCategory);
router.delete('/categories/:id', authenticateToken, ctrl.deleteCategory);

// Settings management
router.get('/settings', authenticateToken, ctrl.getSettings);
router.patch('/settings/bulk', authenticateToken, ctrl.bulkUpdateSettings);
router.get('/settings/:key', authenticateToken, ctrl.getSetting);
router.patch('/settings/:key', authenticateToken, ctrl.updateSetting);
router.post('/settings/:key/reset', authenticateToken, ctrl.resetSetting);

module.exports = router;
