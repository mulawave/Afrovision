const crypto = require('crypto');
const SettingsService = require('../admin/settings.service');

function normalizeBoolean(value, fallback = true) {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function normalizePercent(value, fallback = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
}

function parseAllowlist(raw) {
  return new Set(
    String(raw || '')
      .split(/[,;\s]+/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

async function getExclusiveRolloutConfig() {
  const [enabledRaw, percentRaw, allowlistRaw] = await Promise.all([
    SettingsService.get('EXCLUSIVE_ROLLOUT_ENABLED'),
    SettingsService.get('EXCLUSIVE_ROLLOUT_PERCENT'),
    SettingsService.get('EXCLUSIVE_ROLLOUT_ALLOWLIST_USER_IDS'),
  ]);

  return {
    enabled: normalizeBoolean(enabledRaw, true),
    percent: normalizePercent(percentRaw, 100),
    allowlist: parseAllowlist(allowlistRaw),
  };
}

function isIncludedByPercent(userId, percent) {
  if (percent >= 100) return true;
  if (percent <= 0) return false;

  const digest = crypto.createHash('sha256').update(String(userId)).digest();
  const bucket = digest.readUInt32BE(0) % 100;
  return bucket < percent;
}

function isUserInExclusiveRollout(userId, config) {
  if (!userId) return false;
  if (!config.enabled) return false;
  if (config.allowlist.has(userId)) return true;
  return isIncludedByPercent(userId, config.percent);
}

async function isExclusiveRolloutEnabledForUser(userId) {
  const config = await getExclusiveRolloutConfig();
  return isUserInExclusiveRollout(userId, config);
}

module.exports = {
  getExclusiveRolloutConfig,
  isUserInExclusiveRollout,
  isExclusiveRolloutEnabledForUser,
};
