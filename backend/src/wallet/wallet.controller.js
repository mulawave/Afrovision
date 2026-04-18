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

/**
 * GET /wallet/scan-balance/:address — Scan BSC chain for vPT + BNB balance at any address.
 */
async function scanBalance(req, res) {
  try {
    const { address } = req.params;
    if (!address || address.length < 40) {
      return res.status(400).json({ error: 'Invalid BSC address' });
    }

    const balances = await WalletService.scanAddressBalance(address);
    res.json({ balances });
  } catch (err) {
    console.error('[WalletController] scanBalance error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to scan address balance' });
  }
}

/**
 * POST /wallet/import-address — Import an external BSC address, scan chain, link to user.
 * Body: { address: string }
 */
async function importAddress(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { address } = req.body;
    if (!address || typeof address !== 'string' || address.trim().length < 40) {
      return res.status(400).json({ error: 'A valid BSC wallet address is required' });
    }

    const result = await WalletService.importExternalAddress(req.userId, address.trim());
    res.json(result);
  } catch (err) {
    console.error('[WalletController] importAddress error:', err.message);
    const status = err.message.includes('already linked') ? 409 : 500;
    res.status(status).json({ error: err.message || 'Failed to import wallet address' });
  }
}

/**
 * POST /wallet/connect-external — Connect an external wallet (MetaMask/Trust Wallet/etc).
 * Body: { address: string, type: 'metamask' | 'trust_wallet' | 'walletconnect' | 'manual' }
 */
async function connectExternal(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { address, type } = req.body;
    if (!address || typeof address !== 'string' || address.trim().length < 40) {
      return res.status(400).json({ error: 'A valid BSC wallet address is required' });
    }

    const validTypes = ['metamask', 'trust_wallet', 'walletconnect', 'manual'];
    const walletType = validTypes.includes(type) ? type : 'manual';

    const ethers = await WalletService.getEthers();
    if (!ethers || !ethers.isAddress(address.trim())) {
      return res.status(400).json({ error: 'Invalid BSC address format' });
    }

    // Check if address is already used
    const existing = WalletModel.findByAddress(address.trim());
    if (existing && existing.user_id !== req.userId) {
      return res.status(409).json({ error: 'This wallet address is already linked to another account' });
    }

    // Get or create base wallet record
    let walletRecord = WalletModel.findByUserId(req.userId);
    if (!walletRecord) {
      // Create a wallet record with the external address
      walletRecord = await WalletModel.create({
        userId: req.userId,
        bscAddress: address.trim(),
        encryptedPrivateKey: '__external__',
      });
    }

    // Set connected wallet
    await WalletModel.setConnectedWallet(req.userId, {
      address: address.trim(),
      type: walletType,
    });

    // Scan balance
    let balances = null;
    try {
      balances = await WalletService.scanAddressBalance(address.trim());
    } catch { /* non-fatal */ }

    // Sync user's blockchain_tokens with on-chain vPT balance
    if (balances && balances.vpt_balance_raw && balances.vpt_balance_raw !== '0') {
      await User.setBlockchainTokens(req.userId, balances.vpt_balance_raw);
    }

    walletRecord = WalletModel.findByUserId(req.userId);
    res.json({
      wallet: WalletModel.toSafe(walletRecord),
      connected: {
        address: address.trim(),
        type: walletType,
        balances,
      },
    });
  } catch (err) {
    console.error('[WalletController] connectExternal error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to connect external wallet' });
  }
}

/**
 * DELETE /wallet/disconnect-external — Disconnect the connected external wallet.
 */
async function disconnectExternal(req, res) {
  try {
    const walletRecord = WalletModel.findByUserId(req.userId);
    if (!walletRecord) {
      return res.status(404).json({ error: 'No wallet found' });
    }

    await WalletModel.clearConnectedWallet(req.userId);
    const updated = WalletModel.findByUserId(req.userId);
    res.json({ wallet: WalletModel.toSafe(updated) });
  } catch (err) {
    console.error('[WalletController] disconnectExternal error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect external wallet' });
  }
}

/**
 * GET /wallet/connected — Get connected external wallet info + live balances.
 */
async function getConnected(req, res) {
  try {
    const walletRecord = WalletModel.findByUserId(req.userId);
    if (!walletRecord || !walletRecord.connected_wallet_address) {
      return res.json({ connected: null });
    }

    let balances = null;
    try {
      balances = await WalletService.scanAddressBalance(walletRecord.connected_wallet_address);
    } catch { /* non-fatal — RPC may be down */ }

    res.json({
      connected: {
        address: walletRecord.connected_wallet_address,
        type: walletRecord.connected_wallet_type,
        connected_at: walletRecord.connected_wallet_at,
        balances,
      },
    });
  } catch (err) {
    console.error('[WalletController] getConnected error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve connected wallet' });
  }
}

/**
 * POST /wallet/transfer — Transfer BNB or vPT to an external address.
 * Body: { asset: 'vpt' | 'bnb', amount: number, to_address: string }
 */
async function transfer(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { asset, amount, to_address } = req.body;
    if (!asset || !['vpt', 'bnb'].includes(asset)) {
      return res.status(400).json({ error: 'asset must be vpt or bnb' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount must be greater than 0' });
    }
    if (!to_address || typeof to_address !== 'string' || to_address.trim().length < 40) {
      return res.status(400).json({ error: 'A valid destination address is required' });
    }

    let result;
    if (asset === 'vpt') {
      result = await WalletService.transferVptToExternal(req.userId, amount, to_address.trim());
    } else {
      result = await WalletService.transferBnbToExternal(req.userId, amount, to_address.trim());
    }

    res.json({ transfer: result });
  } catch (err) {
    console.error('[WalletController] transfer error:', err.message);
    res.status(500).json({ error: err.message || 'Transfer failed' });
  }
}

module.exports = {
  getMyWallet,
  createMyWallet,
  scanBalance,
  importAddress,
  connectExternal,
  disconnectExternal,
  getConnected,
  transfer,
};
