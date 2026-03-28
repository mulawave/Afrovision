const bcrypt = require('bcrypt');
const User = require('../users/user.model');
const { generateToken } = require('../utils/jwt');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

async function register(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (User.findByEmail(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = User.create({ email, passwordHash });
  const token = generateToken(user.id);

  res.status(201).json({ token, user: User.toSafeUser(user) });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = User.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user.id);
  res.json({ token, user: User.toSafeUser(user) });
}

function me(req, res) {
  const user = User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: User.toSafeUser(user) });
}

function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = User.findByEmail(email);
  if (!user) {
    // Don't reveal whether email exists — but for dev, we return error
    return res.status(404).json({ error: 'No account with that email' });
  }

  const resetToken = User.storeResetToken(user.id);
  // DEV MODE: returning token in response (in production, send via email)
  res.json({ message: 'Reset token generated', resetToken });
}

async function resetPassword(req, res) {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const entry = User.validateResetToken(token);
  if (!entry) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  User.updatePassword(entry.userId, passwordHash);
  User.deleteResetToken(token);

  res.json({ message: 'Password reset successful' });
}

function logout(req, res) {
  // Frontend handles token deletion — backend is a no-op
  res.json({ message: 'Logged out' });
}

module.exports = { register, login, me, forgotPassword, resetPassword, logout };
