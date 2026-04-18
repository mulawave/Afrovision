const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'site_config';
const DOC_ID = 'promo_modal';

/**
 * Default shape for the promo modal config document.
 */
const DEFAULT_CONFIG = {
  enabled: false,
  image_url: '',
  title: '',
  subtitle: '',
  body_text: '',
  button_text: '',
  button_link: '',
  open_in_new_tab: true,
  updated_at: null,
  updated_by: null,
};

/**
 * Get the current promo modal config from Firestore.
 * Returns the default if no document exists yet.
 */
async function getConfig() {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...doc.data() };
}

/**
 * Save / update the promo modal config in Firestore.
 */
/**
 * Validate that a link is safe (relative path or http/https URL).
 * Rejects javascript:, data:, vbscript:, and other dangerous schemes.
 */
function sanitizeLink(raw) {
  const link = (raw || '').trim();
  if (!link) return '';
  // Allow relative paths
  if (link.startsWith('/')) return link;
  // Allow only http and https
  try {
    const url = new URL(link);
    if (['http:', 'https:'].includes(url.protocol)) return link;
  } catch (_) { /* not a valid URL */ }
  return ''; // reject unsafe schemes
}

async function saveConfig(data, adminId) {
  const db = getFirestore();
  const payload = {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : false,
    image_url: (data.image_url || '').trim(),
    title: (data.title || '').trim().slice(0, 100),
    subtitle: (data.subtitle || '').trim().slice(0, 150),
    body_text: (data.body_text || '').trim().slice(0, 500),
    button_text: (data.button_text || '').trim().slice(0, 40),
    button_link: sanitizeLink(data.button_link),
    open_in_new_tab: typeof data.open_in_new_tab === 'boolean' ? data.open_in_new_tab : true,
    updated_at: Date.now(),
    updated_by: adminId,
  };
  await db.collection(COLLECTION).doc(DOC_ID).set(payload, { merge: true });
  return payload;
}

module.exports = { getConfig, saveConfig };
