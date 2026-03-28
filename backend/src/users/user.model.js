const crypto = require('crypto');

const users = [];
const resetTokens = new Map();

function findByEmail(email) {
  return users.find((u) => u.email === email);
}

function findById(id) {
  return users.find((u) => u.id === id);
}

function create({ email, passwordHash }) {
  const user = {
    id: crypto.randomUUID(),
    email,
    password_hash: passwordHash,
    name: null,
    role: 'viewer',
    is_premium_creator: false,
    kyc_status: 'none',
    subscription_plan: null,
    subscription_status: 'inactive',
    subscription_expiry: null,
    preferred_currency: 'NGN',
    vpt_balance: 0,
    first_subscription_at: null,
    created_at: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

function updatePassword(userId, passwordHash) {
  const user = findById(userId);
  if (!user) return null;
  user.password_hash = passwordHash;
  return user;
}

function updateProfile(userId, fields) {
  const user = findById(userId);
  if (!user) return null;
  if (fields.name !== undefined) user.name = fields.name;
  if (fields.preferred_currency !== undefined) user.preferred_currency = fields.preferred_currency;
  return user;
}

function setRole(userId, role) {
  const user = findById(userId);
  if (!user) return null;
  user.role = role;
  return user;
}

function setPremium(userId, isPremium) {
  const user = findById(userId);
  if (!user) return null;
  user.is_premium_creator = isPremium;
  return user;
}

function setKyc(userId, kycStatus) {
  const user = findById(userId);
  if (!user) return null;
  user.kyc_status = kycStatus;
  return user;
}

function setSubscription(userId, { plan, status, expiry }) {
  const user = findById(userId);
  if (!user) return null;
  user.subscription_plan = plan;
  user.subscription_status = status;
  user.subscription_expiry = expiry;
  return user;
}

function storeResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 3600000;
  resetTokens.set(token, { userId, expires });
  return token;
}

function validateResetToken(token) {
  const entry = resetTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    resetTokens.delete(token);
    return null;
  }
  return entry;
}

function deleteResetToken(token) {
  resetTokens.delete(token);
}

function toSafeUser(user) {
  // Lazy-load wallet to include BSC address
  let bscAddress = null;
  try {
    const WalletModel = require('../wallet/wallet.model');
    const wallet = WalletModel.findByUserId(user.id);
    if (wallet) bscAddress = wallet.bsc_address;
  } catch { /* wallet module not loaded yet */ }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    is_premium_creator: user.is_premium_creator,
    kyc_status: user.kyc_status,
    subscription_plan: user.subscription_plan,
    subscription_status: user.subscription_status,
    subscription_expiry: user.subscription_expiry,
    preferred_currency: user.preferred_currency,
    vpt_balance: user.vpt_balance,
    bsc_address: bscAddress,
    first_subscription_at: user.first_subscription_at,
    created_at: user.created_at,
  };
}

function getAll() {
  return users;
}

module.exports = {
  findByEmail,
  findById,
  create,
  getAll,
  updatePassword,
  updateProfile,
  setRole,
  setPremium,
  setKyc,
  setSubscription,
  storeResetToken,
  validateResetToken,
  deleteResetToken,
  toSafeUser,
};
