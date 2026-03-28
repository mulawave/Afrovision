const User = require('./user.model');

function getProfile(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

function updateProfile(req, res) {
  const { name } = req.body;
  const user = User.updateProfile(req.userId, { name });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

function updateCurrency(req, res) {
  const { currency } = req.body;
  if (!currency) return res.status(400).json({ error: 'Currency code is required' });
  const Currency = require('../currencies/currency.model');
  if (!Currency.findByCode(currency.toUpperCase())) {
    return res.status(400).json({ error: 'Unsupported currency' });
  }
  const user = User.updateProfile(req.userId, { preferred_currency: currency.toUpperCase() });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

function requestCreator(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'creator' || user.role === 'admin') {
    return res.status(400).json({ error: 'Already a creator or admin' });
  }
  return res.status(400).json({ error: 'Subscribe to a plan to become a creator' });
}

module.exports = { getProfile, updateProfile, updateCurrency, requestCreator };
