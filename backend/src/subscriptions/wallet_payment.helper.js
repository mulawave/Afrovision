const User = require('../users/user.model');
const Ledger = require('../vpt/ledger.model');
const ReferralModel = require('../referrals/referral.model');
const SettingsService = require('../admin/settings.service');

/**
 * WalletPaymentHelper — shared logic for charging in-app wallets (cash + vPT)
 * across all subscription types (platform plans, creator subs, channel subs, renewals).
 *
 * Rules:
 * - If cash alone covers the amount → deduct from cash only
 * - If vPT alone covers the amount → deduct from vPT only (converted at VPT_PRICE_NGN)
 * - If neither alone covers but combined is sufficient → use cash first, vPT for remainder
 * - If combined is insufficient → throw INSUFFICIENT_FUNDS error
 */

async function getVptPriceNgn() {
  return (await SettingsService.getNumber('VPT_PRICE_NGN')) || ReferralModel.VPT_PRICE_NGN || 750;
}

/**
 * Preview a wallet payment without modifying any state.
 * Returns the split that *would* be charged.
 */
async function previewWalletPayment(userId, amountNgn) {
  const user = await User.findById(userId);
  if (!user) {
    return {
      sufficient: false,
      cashBalance: 0,
      vptBalance: 0,
      vptPriceNgn: await getVptPriceNgn(),
      vptEquivalent: 0,
      cashToDeduct: 0,
      vptToDeduct: 0,
      error: 'User not found',
    };
  }

  const cashBalance = Number(user.cash || 0);
  const vptBalance = Number(user.vpt || 0);
  const vptPriceNgn = await getVptPriceNgn();
  const vptValueNgn = vptBalance * vptPriceNgn;
  const vptEquivalent = parseFloat((amountNgn / vptPriceNgn).toFixed(4));

  const totalAvailable = cashBalance + vptValueNgn;
  const sufficient = totalAvailable >= amountNgn;

  let cashToDeduct = 0;
  let vptToDeduct = 0;

  if (sufficient) {
    if (cashBalance >= amountNgn) {
      // Cash alone covers it
      cashToDeduct = amountNgn;
    } else if (vptValueNgn >= amountNgn) {
      // vPT alone covers it
      vptToDeduct = parseFloat((amountNgn / vptPriceNgn).toFixed(4));
    } else {
      // Mixed: cash first, then vPT for remainder
      cashToDeduct = cashBalance;
      const remainderNgn = amountNgn - cashBalance;
      vptToDeduct = parseFloat((remainderNgn / vptPriceNgn).toFixed(4));
    }
  }

  return {
    sufficient,
    cashBalance: parseFloat(cashBalance.toFixed(2)),
    vptBalance: parseFloat(vptBalance.toFixed(4)),
    vptPriceNgn,
    vptEquivalent,
    cashToDeduct: parseFloat(cashToDeduct.toFixed(2)),
    vptToDeduct: parseFloat(vptToDeduct.toFixed(4)),
  };
}

/**
 * Charge the user's wallet for a given NGN amount.
 * Deducts cash and/or vPT and records ledger entries.
 *
 * @param {string} userId - The user ID
 * @param {number} amountNgn - The amount to charge in NGN
 * @param {object} ledgerMeta - Extra metadata for ledger entries (type, description, reference_id, etc.)
 * @returns {Promise<{cashCharged: number, vptCharged: number, vptPriceNgn: number}>}
 * @throws {Error} with code INSUFFICIENT_FUNDS if combined balances are insufficient
 */
async function chargeWallet(userId, amountNgn, ledgerMeta = {}) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const cashBalance = Number(user.cash || 0);
  const vptBalance = Number(user.vpt || 0);
  const vptPriceNgn = await getVptPriceNgn();
  const vptValueNgn = vptBalance * vptPriceNgn;
  const totalAvailable = cashBalance + vptValueNgn;

  if (totalAvailable < amountNgn) {
    const err = new Error('Insufficient wallet balance');
    err.code = 'INSUFFICIENT_FUNDS';
    err.details = {
      cashBalance: parseFloat(cashBalance.toFixed(2)),
      vptBalance: parseFloat(vptBalance.toFixed(4)),
      vptValueNgn: parseFloat(vptValueNgn.toFixed(2)),
      totalAvailable: parseFloat(totalAvailable.toFixed(2)),
      amountRequired: amountNgn,
      shortfall: parseFloat((amountNgn - totalAvailable).toFixed(2)),
    };
    throw err;
  }

  let cashToDeduct = 0;
  let vptToDeduct = 0;

  if (cashBalance >= amountNgn) {
    cashToDeduct = amountNgn;
  } else if (vptValueNgn >= amountNgn) {
    vptToDeduct = parseFloat((amountNgn / vptPriceNgn).toFixed(4));
  } else {
    cashToDeduct = cashBalance;
    const remainderNgn = amountNgn - cashBalance;
    vptToDeduct = parseFloat((remainderNgn / vptPriceNgn).toFixed(4));
  }

  // Deduct cash portion
  if (cashToDeduct > 0) {
    await User.adjustCash(userId, -cashToDeduct);
    await Ledger.create({
      uid: userId,
      type: ledgerMeta.type || 'PLAN_PAYMENT',
      direction: 'debit',
      currency: 'ngn',
      amount_ngn: cashToDeduct,
      amount_vpt_units: 0,
      status: 'success',
      reference_id: ledgerMeta.reference_id || null,
      meta: {
        ...ledgerMeta.meta,
        wallet_method: 'cash',
      },
      description: ledgerMeta.description
        ? `${ledgerMeta.description} (cash portion)`
        : 'Wallet payment (cash portion)',
    });
  }

  // Deduct vPT portion
  if (vptToDeduct > 0) {
    await User.adjustVpt(userId, -vptToDeduct);
    await Ledger.create({
      uid: userId,
      type: ledgerMeta.type || 'PLAN_PAYMENT',
      direction: 'debit',
      currency: 'vpt',
      amount_vpt_units: vptToDeduct,
      amount_ngn: Math.round(vptToDeduct * vptPriceNgn),
      status: 'success',
      reference_id: ledgerMeta.reference_id || null,
      meta: {
        ...ledgerMeta.meta,
        wallet_method: 'vpt',
        vpt_price_ngn: vptPriceNgn,
      },
      description: ledgerMeta.description
        ? `${ledgerMeta.description} (vPT portion)`
        : 'Wallet payment (vPT portion)',
    });
  }

  return {
    cashCharged: parseFloat(cashToDeduct.toFixed(2)),
    vptCharged: parseFloat(vptToDeduct.toFixed(4)),
    vptPriceNgn,
  };
}

module.exports = {
  previewWalletPayment,
  chargeWallet,
  getVptPriceNgn,
};
