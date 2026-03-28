const currencies = [
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', rate_to_ngn: 1 },
  { code: 'USD', name: 'US Dollar', symbol: '$', rate_to_ngn: 1580 },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate_to_ngn: 2000 },
  { code: 'EUR', name: 'Euro', symbol: '€', rate_to_ngn: 1720 },
];

function getAll() {
  return currencies;
}

function findByCode(code) {
  return currencies.find((c) => c.code === code);
}

function convert(amountNgn, targetCode) {
  if (targetCode === 'NGN') return amountNgn;
  const currency = findByCode(targetCode);
  if (!currency) return amountNgn;
  return Math.round((amountNgn / currency.rate_to_ngn) * 100) / 100;
}

module.exports = { getAll, findByCode, convert };
