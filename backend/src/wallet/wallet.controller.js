const WalletService = require('./wallet.service');
const WalletModel = require('./wallet.model');
const User = require('../users/user.model');

async function getMyWallet(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const walletRecord = WalletModel.findByUserId(req.userId);

    if (!walletRecord) {
      // Auto-create wallet for creators
      if (user.role !== 'creator' && user.role !== 'admin') {
        return res.status(403).json({ error: 'Only creators can have wallets' });
      }
      const created = await WalletService.createWallet(req.userId);
      return res.json({ wallet: WalletModel.toSafe(created) });
    }

    res.json({ wallet: WalletModel.toSafe(walletRecord) });
  } catch (err) {
    console.error('[WalletController] getMyWallet error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve wallet' });
  }
}

async function createMyWallet(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can create wallets' });
    }

    const existing = WalletModel.findByUserId(req.userId);
    if (existing) {
      return res.status(409).json({
        error: 'Wallet already exists',
        wallet: WalletModel.toSafe(existing),
      });
    }

    const walletRecord = await WalletService.createWallet(req.userId);
    res.status(201).json({ wallet: WalletModel.toSafe(walletRecord) });
  } catch (err) {
    console.error('[WalletController] createMyWallet error:', err.message);
    res.status(500).json({ error: 'Failed to create wallet' });
  }
}

module.exports = { getMyWallet, createMyWallet };
