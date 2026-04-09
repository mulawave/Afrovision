/**
 * TTS Service — ElevenLabs text-to-speech for flash screens.
 *
 * Generates "Coming Up Next: <title>" and "Now Playing: <title>" audio.
 * Falls back gracefully when ELEVENLABS_API_KEY is not configured.
 */
const https = require('https');
const SettingsService = require('../admin/settings.service');

// In-memory TTS cache (key → audio Buffer) to avoid redundant API calls
const ttsCache = new Map();
const CACHE_MAX = 200;

/**
 * Generate a TTS audio clip via ElevenLabs.
 * @param {string} text  The text to speak.
 * @returns {Promise<Buffer|null>} MP3 audio buffer, or null if TTS unavailable.
 */
async function generateTTS(text) {
  if (!text) return null;

  // Check cache
  const cacheKey = text.toLowerCase().trim();
  if (ttsCache.has(cacheKey)) return ttsCache.get(cacheKey);

  const apiKey = await _getApiKey();
  if (!apiKey) return null;

  const voiceId = await _getVoiceId();

  try {
    const audioBuffer = await _callElevenLabs(apiKey, voiceId, text);
    if (audioBuffer) {
      // Evict oldest if cache full
      if (ttsCache.size >= CACHE_MAX) {
        const firstKey = ttsCache.keys().next().value;
        ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, audioBuffer);
    }
    return audioBuffer;
  } catch (err) {
    console.error('[TTS] ElevenLabs error:', err.message);
    return null;
  }
}

/**
 * Generate a "Coming Up Next" or "Now Playing" announcement.
 * @param {'coming_up'|'now_playing'} type
 * @param {string} title  Program title
 * @param {string} [channelName]
 * @returns {Promise<Buffer|null>}
 */
async function generateFlashAudio(type, title, channelName) {
  const prefix = type === 'now_playing' ? 'Now Playing' : 'Coming Up Next';
  let text = `${prefix}: ${title}`;
  if (channelName) text += `, on ${channelName}`;
  return generateTTS(text);
}

// ─── Internal helpers ───

async function _getApiKey() {
  try {
    const key = await SettingsService.get('ELEVENLABS_API_KEY');
    return key || process.env.ELEVENLABS_API_KEY || null;
  } catch {
    return process.env.ELEVENLABS_API_KEY || null;
  }
}

async function _getVoiceId() {
  try {
    const id = await SettingsService.get('ELEVENLABS_VOICE_ID');
    return id || 'EXAVITQu4vr4xnSDxMaL'; // Default: "Sarah" voice
  } catch {
    return 'EXAVITQu4vr4xnSDxMaL';
  }
}

function _callElevenLabs(apiKey, voiceId, text) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.75,
      },
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        Accept: 'audio/mpeg',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => reject(new Error(`ElevenLabs ${res.statusCode}: ${body}`)));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = { generateTTS, generateFlashAudio };
