const User = require('../users/user.model');
const Plan = require('../subscriptions/plan.model');
const Category = require('../channels/category.model');
const Settings = require('./settings.model');

const VALID_ROLES = ['viewer', 'creator', 'admin'];
const VALID_KYC = ['none', 'pending', 'verified'];

function requireAdmin(req, res) {
  const caller = User.findById(req.userId);
  if (!caller || caller.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return caller;
}

function setRole(req, res) {
  if (!requireAdmin(req, res)) return;
  const { userId, role } = req.body;
  if (!userId || !role) return res.status(400).json({ error: 'userId and role are required' });
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const user = User.setRole(userId, role);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

function setPremium(req, res) {
  if (!requireAdmin(req, res)) return;
  const { userId, isPremium } = req.body;
  if (!userId || typeof isPremium !== 'boolean') return res.status(400).json({ error: 'userId and isPremium (bool) are required' });
  const user = User.setPremium(userId, isPremium);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

function setKyc(req, res) {
  if (!requireAdmin(req, res)) return;
  const { userId, kycStatus } = req.body;
  if (!userId || !kycStatus) return res.status(400).json({ error: 'userId and kycStatus are required' });
  if (!VALID_KYC.includes(kycStatus)) return res.status(400).json({ error: 'Invalid KYC status' });
  const user = User.setKyc(userId, kycStatus);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

// --- Plan Management ---

function createPlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const { name, price, currency, features, display_labels, badge } = req.body;
  if (!name) return res.status(400).json({ error: 'Plan name is required' });
  const plan = Plan.create({ name, price, currency, features, display_labels, badge });
  res.status(201).json({ plan });
}

function updatePlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const plan = Plan.update(req.params.id, req.body);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ plan });
}

function deletePlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const removed = Plan.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Plan not found' });
  res.json({ message: 'Plan deleted' });
}

function addFeatureToPlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const { feature, label } = req.body;
  if (!feature) return res.status(400).json({ error: 'feature is required' });
  const plan = Plan.addFeature(req.params.id, feature, label);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ plan });
}

function removeFeatureFromPlan(req, res) {
  if (!requireAdmin(req, res)) return;
  const plan = Plan.removeFeature(req.params.id, req.params.feature);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ plan });
}

// --- Category Management ---

function getCategories(req, res) {
  if (!requireAdmin(req, res)) return;
  const categories = Category.getAll(true);
  res.json({ categories });
}

function createCategory(req, res) {
  if (!requireAdmin(req, res)) return;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  const category = Category.create({ name });
  res.status(201).json({ category });
}

function updateCategory(req, res) {
  if (!requireAdmin(req, res)) return;
  const category = Category.update(req.params.id, req.body);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json({ category });
}

function deleteCategory(req, res) {
  if (!requireAdmin(req, res)) return;
  const removed = Category.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Category not found' });
  res.json({ message: 'Category deleted' });
}

// --- Settings Management ---

function getSettings(req, res) {
  if (!requireAdmin(req, res)) return;
  const settings = Settings.getAll();
  res.json({ settings });
}

function getSetting(req, res) {
  if (!requireAdmin(req, res)) return;
  const setting = Settings.getOne(req.params.key);
  if (!setting) return res.status(404).json({ error: 'Setting not found' });
  res.json({ setting });
}

function updateSetting(req, res) {
  if (!requireAdmin(req, res)) return;
  const { key } = req.params;
  const { value } = req.body;

  if (!Settings.isValidKey(key)) return res.status(404).json({ error: 'Setting not found' });
  if (value === undefined || value === null) return res.status(400).json({ error: 'value is required' });

  const result = Settings.set(key, String(value));
  res.json({ setting: result });
}

function bulkUpdateSettings(req, res) {
  if (!requireAdmin(req, res)) return;
  const { settings } = req.body;

  if (!Array.isArray(settings) || settings.length === 0) {
    return res.status(400).json({ error: 'settings array is required' });
  }

  for (const entry of settings) {
    if (!entry.key || entry.value === undefined) {
      return res.status(400).json({ error: 'Each entry must have key and value' });
    }
    if (!Settings.isValidKey(entry.key)) {
      return res.status(400).json({ error: `Invalid setting key: ${entry.key}` });
    }
  }

  const results = Settings.bulkSet(settings.map((s) => ({ key: s.key, value: String(s.value) })));
  res.json({ updated: results });
}

function resetSetting(req, res) {
  if (!requireAdmin(req, res)) return;
  const result = Settings.reset(req.params.key);
  if (!result) return res.status(404).json({ error: 'Setting not found' });
  res.json({ setting: result });
}

module.exports = {
  setRole,
  setPremium,
  setKyc,
  createPlan,
  updatePlan,
  deletePlan,
  addFeatureToPlan,
  removeFeatureFromPlan,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSettings,
  getSetting,
  updateSetting,
  bulkUpdateSettings,
  resetSetting,
};
