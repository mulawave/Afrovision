const { google } = require('googleapis');
const SettingsService = require('../admin/settings.service');

async function getSettingOrEnv(key, envKeys = []) {
  try {
    const value = await SettingsService.get(key);
    if (value) return value;
  } catch (_) {}

  for (const envKey of envKeys) {
    if (process.env[envKey]) return process.env[envKey];
  }

  return null;
}

async function getAndroidPublisherClient() {
  const clientEmail = await getSettingOrEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL', ['GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL']);
  const privateKeyRaw = await getSettingOrEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY', ['GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY']);
  if (!clientEmail || !privateKeyRaw) {
    const error = new Error('Google Play verification is not configured');
    error.statusCode = 503;
    throw error;
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKeyRaw.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  return google.androidpublisher({ version: 'v3', auth });
}

async function verifyProductPurchase({ packageName, productId, purchaseToken }) {
  const androidpublisher = await getAndroidPublisherClient();
  const result = await androidpublisher.purchases.products.get({
    packageName,
    productId,
    token: purchaseToken,
  });
  const purchase = result.data || {};
  const purchaseState = Number(purchase.purchaseState ?? 1);
  return {
    valid: purchaseState === 0,
    purchase,
  };
}

async function verifySubscriptionPurchase({ packageName, productId, purchaseToken }) {
  const androidpublisher = await getAndroidPublisherClient();
  const result = await androidpublisher.purchases.subscriptions.get({
    packageName,
    subscriptionId: productId,
    token: purchaseToken,
  });
  const purchase = result.data || {};
  const paymentState = Number(purchase.paymentState ?? 0);
  const expiryTimeMillis = Number(purchase.expiryTimeMillis || 0);
  return {
    valid: [1, 2].includes(paymentState) && expiryTimeMillis > Date.now(),
    purchase,
  };
}

module.exports = {
  verifyProductPurchase,
  verifySubscriptionPurchase,
};
