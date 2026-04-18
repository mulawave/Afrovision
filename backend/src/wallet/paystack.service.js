const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const SettingsService = require('../admin/settings.service');

async function getPaystackSecretKey() {
  // Try Firestore-backed admin settings first, fall back to env var for cold-start compatibility
  try {
    const secret = await SettingsService.get('PAYSTACK_SECRET_KEY');
    if (secret) return secret;
  } catch (_) {
    // settings not initialised yet — fall through to env var
  }
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error('Paystack is not configured. Set PAYSTACK_SECRET_KEY in Admin → Settings → Payment Gateways.');
  }
  return secret;
}

async function paystackRequest(path, { method = 'GET', body } = {}) {
  const secret = await getPaystackSecretKey();
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok || payload.status === false) {
    throw new Error(payload.message || 'Paystack request failed');
  }

  return payload.data;
}

async function listBanks() {
  const data = await paystackRequest('/bank?country=nigeria&perPage=500');
  return Array.isArray(data)
    ? data.map((bank) => ({
        name: bank.name,
        code: bank.code,
        slug: bank.slug || null,
      }))
    : [];
}

async function resolveAccountNumber(accountNumber, bankCode) {
  const params = new URLSearchParams({
    account_number: accountNumber,
    bank_code: bankCode,
  });
  const data = await paystackRequest(`/bank/resolve?${params.toString()}`);
  return {
    account_number: data.account_number,
    account_name: data.account_name,
    bank_code: data.bank_code,
  };
}

module.exports = {
  listBanks,
  resolveAccountNumber,
};