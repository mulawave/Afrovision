const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

function deriveKey(secret) {
  if (!secret) {
    throw new Error('Encryption secret is required');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function encryptWithSecret(text, secret) {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptWithSecret(text, secret) {
  const key = deriveKey(secret);
  const [ivHex, encryptedHex] = String(text || '').split(':');

  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted payload');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

module.exports = {
  deriveKey,
  encryptWithSecret,
  decryptWithSecret,
};