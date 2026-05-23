const Currency = require('./currency.model');
const Plan = require('../subscriptions/plan.model');

function getCurrencies(req, res) {
  res.json({ currencies: Currency.getAll() });
}

async function getConvertedPlans(req, res) {
  const { currency } = req.query;
  const targetCode = (currency || 'NGN').toUpperCase();
  const cur = Currency.findByCode(targetCode);
  if (!cur) {
    return res.status(400).json({ error: 'Unsupported currency' });
  }

  const plans = (await Plan.getAll()).map((plan) => ({
    ...plan,
    display_price: Currency.convert(plan.price, targetCode),
    display_currency: targetCode,
    display_symbol: cur.symbol,
  }));

  res.json({ plans, currency: targetCode, symbol: cur.symbol });
}

module.exports = { getCurrencies, getConvertedPlans };
