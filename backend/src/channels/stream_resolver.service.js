/**
 * AV-STR-004 — Stream Source Resolver and Validation Service
 *
 * Classifies an inbound URL against the approved AfroVision source matrix,
 * normalizes it into a playback contract, and probes it to establish an
 * initial stream_status. All results are safe to persist via
 * Channel.updateExternalSource().
 *
 * Supported source modes (matching ALLOWED_SOURCE_MODES in channel.model.js):
 *   external_youtube  — YouTube watch, live, or short URLs
 *   external_hls      — Direct HLS manifest (.m3u8)
 *   external_dash     — Direct MPEG-DASH manifest (.mpd)
 *
 * Rejected inputs (return error, never persisted):
 *   - Non-https URLs
 *   - Generic webpages that are not a recognized provider
 *   - Sources whose host is not on the approved list
 */

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ── Approved YouTube host list ──────────────────────────────────────────────
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

const PROBE_TIMEOUT_MS = 8000;
const PROBE_MAX_REDIRECTS = 3;

// ── URL classification ───────────────────────────────────────────────────────

/**
 * Extract a YouTube video/live ID from a recognized YouTube URL.
 * Returns null if not extractable.
 */
function extractYouTubeId(parsedUrl) {
  const host = parsedUrl.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = parsedUrl.pathname.slice(1).split('/')[0];
    return id || null;
  }

  // youtube.com/watch?v=<id>
  const v = parsedUrl.searchParams.get('v');
  if (v) return v;

  // youtube.com/live/<id>  or  youtube.com/shorts/<id>
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2 && ['live', 'shorts', 'embed'].includes(pathParts[0])) {
    return pathParts[1];
  }

  return null;
}

/**
 * Normalize a YouTube ID into the canonical watch URL and embed URL.
 */
function buildYouTubeUrls(videoId) {
  return {
    canonical: `https://www.youtube.com/watch?v=${videoId}`,
    embed: `https://www.youtube.com/embed/${videoId}`,
  };
}

/**
 * Classify a raw URL string into a source mode and normalized form.
 * Returns { mode, provider, externalUrl, resolvedPlaybackUrl, providerMetadata }
 * or throws a ResolverError with a user-readable message.
 */
function classifyUrl(rawUrl) {
  // Must be a non-empty string
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new ResolverError('URL must be a non-empty string', 'INVALID_INPUT');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new ResolverError('URL is not a valid URL format', 'INVALID_FORMAT');
  }

  // Require https for all external sources
  if (parsed.protocol !== 'https:') {
    throw new ResolverError(
      'Only HTTPS sources are accepted. HTTP or other protocols are not allowed.',
      'INSECURE_PROTOCOL',
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // ── YouTube ──
  if (YOUTUBE_HOSTS.has(hostname)) {
    const videoId = extractYouTubeId(parsed);
    if (!videoId) {
      throw new ResolverError(
        'YouTube URL does not contain a recognizable video or live ID',
        'YOUTUBE_NO_ID',
      );
    }
    const { canonical, embed } = buildYouTubeUrls(videoId);
    return {
      mode: 'external_youtube',
      provider: 'youtube',
      externalUrl: canonical,
      resolvedPlaybackUrl: embed,
      providerMetadata: {
        video_id: videoId,
        embed_url: embed,
        canonical_url: canonical,
      },
    };
  }

  // ── HLS (.m3u8) ──
  const pathLower = parsed.pathname.toLowerCase();
  if (pathLower.endsWith('.m3u8') || pathLower.includes('.m3u8?')) {
    return {
      mode: 'external_hls',
      provider: 'direct_hls',
      externalUrl: parsed.href,
      resolvedPlaybackUrl: parsed.href,
      providerMetadata: {
        manifest_type: 'hls',
        host: hostname,
      },
    };
  }

  // ── MPEG-DASH (.mpd) ──
  if (pathLower.endsWith('.mpd') || pathLower.includes('.mpd?')) {
    return {
      mode: 'external_dash',
      provider: 'direct_dash',
      externalUrl: parsed.href,
      resolvedPlaybackUrl: parsed.href,
      providerMetadata: {
        manifest_type: 'dash',
        host: hostname,
      },
    };
  }

  throw new ResolverError(
    'URL does not match any supported source type. Accepted: YouTube Live, HLS (.m3u8), DASH (.mpd)',
    'UNSUPPORTED_SOURCE',
  );
}

// ── URL probing ──────────────────────────────────────────────────────────────

/**
 * Probe the YouTube oEmbed API to determine if a video is publicly accessible.
 * This is the only reliable server-side signal available without a YouTube
 * Data API key. It does not distinguish live/scheduled/ended but does detect
 * private, deleted, and inaccessible videos accurately.
 *
 * HTTP semantics:
 *   200 → video exists and is publicly accessible (live, scheduled, or VOD)
 *   401 → private or age-restricted
 *   403 → geo-blocked or access denied
 *   404 → deleted or invalid video ID
 *   network error / timeout → treat as offline
 *
 * Returns { streamStatus, httpStatus, probeLatencyMs, probeError }
 */
async function probeYouTubeOEmbed(videoId) {
  const encodedUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodedUrl}&format=json`;

  const probe = await probeUrl(oEmbedUrl);

  if (probe.httpStatus === 200 && probe.reachable) {
    return { streamStatus: 'valid', httpStatus: 200, probeLatencyMs: probe.latencyMs, probeError: null };
  }
  if (probe.httpStatus === 401 || probe.httpStatus === 403) {
    return { streamStatus: 'access_denied', httpStatus: probe.httpStatus, probeLatencyMs: probe.latencyMs, probeError: null };
  }
  if (probe.httpStatus === 404) {
    return { streamStatus: 'invalid', httpStatus: 404, probeLatencyMs: probe.latencyMs, probeError: null };
  }
  if (probe.error === 'timeout' || (!probe.reachable && probe.httpStatus === null)) {
    return { streamStatus: 'offline', httpStatus: null, probeLatencyMs: probe.latencyMs, probeError: probe.error };
  }
  return { streamStatus: 'invalid', httpStatus: probe.httpStatus, probeLatencyMs: probe.latencyMs, probeError: probe.error };
}

/**
 * Extract the YouTube video ID from a canonical embed URL.
 * Accepts: https://www.youtube.com/embed/VIDEO_ID
 */
function extractVideoIdFromEmbedUrl(embedUrl) {
  try {
    const parsed = new URL(embedUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] === 'embed' && parts[1]) return parts[1];
  } catch {
    // ignore
  }
  return null;
}

/**
 * Perform a HEAD request to a URL and return reachability metadata.
 * Falls back to GET when the server rejects HEAD with 405 (common for HLS origins).
 * Never follows more than PROBE_MAX_REDIRECTS redirects.
 * Returns { reachable, httpStatus, latencyMs, error }.
 */
function probeUrl(url, redirectsRemaining = PROBE_MAX_REDIRECTS, methodOverride = null) {
  return new Promise((resolve) => {
    const startMs = Date.now();

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return resolve({ reachable: false, httpStatus: null, latencyMs: 0, error: 'Invalid URL' });
    }

    const method = methodOverride || 'HEAD';
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers: {
          'User-Agent': 'AfroVision-StreamValidator/1.0',
          Accept: '*/*',
        },
        timeout: PROBE_TIMEOUT_MS,
      },
      (res) => {
        const latencyMs = Date.now() - startMs;
        const status = res.statusCode;

        // Consume body to free socket
        res.resume();

        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirectsRemaining > 0) {
          let next;
          try {
            next = new URL(res.headers.location, url).href;
          } catch {
            return resolve({ reachable: false, httpStatus: status, latencyMs, error: 'Bad redirect location' });
          }
          probeUrl(next, redirectsRemaining - 1, methodOverride).then(resolve);
          return;
        }

        // 405 Method Not Allowed or 403 Forbidden: retry with GET
        // (common for HLS origins that only accept GET requests)
        if ((status === 405 || status === 403) && !methodOverride) {
          probeUrl(url, redirectsRemaining, 'GET').then(resolve);
          return;
        }

        resolve({ reachable: status >= 200 && status < 400, httpStatus: status, latencyMs, error: null });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ reachable: false, httpStatus: null, latencyMs: PROBE_TIMEOUT_MS, error: 'timeout' });
    });

    req.on('error', (err) => {
      resolve({ reachable: false, httpStatus: null, latencyMs: Date.now() - startMs, error: err.message });
    });

    req.end();
  });
}

// ── Main public API ──────────────────────────────────────────────────────────

/**
 * Resolve a raw URL into a full stream source contract ready to persist.
 *
 * Returns:
 * {
 *   ok: true,
 *   stream_source_mode,
 *   external_provider,
 *   external_url,
 *   resolved_playback_url,
 *   stream_status,       // 'valid' | 'offline' | 'access_denied' | 'invalid'
 *   last_checked_at,
 *   provider_metadata,
 * }
 *
 * Or on rejection:
 * {
 *   ok: false,
 *   error_code,          // machine-readable
 *   error_message,       // user-readable
 * }
 */
async function resolveSource(rawUrl) {
  let classification;
  try {
    classification = classifyUrl(rawUrl);
  } catch (err) {
    if (err instanceof ResolverError) {
      return { ok: false, error_code: err.code, error_message: err.message };
    }
    return { ok: false, error_code: 'CLASSIFY_ERROR', error_message: String(err.message) };
  }

  const now = new Date().toISOString();

  // YouTube: probe via oEmbed API (no API key required).
  // oEmbed accurately signals valid (200), private/blocked (401/403), or
  // deleted/invalid (404). It does not distinguish live vs scheduled vs ended —
  // that requires the Data API. The stream_status reflects accessibility, not
  // live-ness. The player layer handles live vs non-live UI from the status.
  if (classification.mode === 'external_youtube') {
    const videoId = classification.providerMetadata.video_id;
    const yt = await probeYouTubeOEmbed(videoId);
    return {
      ok: true,
      stream_source_mode: classification.mode,
      external_provider: classification.provider,
      external_url: classification.externalUrl,
      resolved_playback_url: classification.resolvedPlaybackUrl,
      stream_status: yt.streamStatus,
      last_checked_at: now,
      provider_metadata: {
        ...classification.providerMetadata,
        probe_method: 'oembed',
        probe_http_status: yt.httpStatus,
        probe_latency_ms: yt.probeLatencyMs,
        probe_error: yt.probeError,
      },
    };
  }

  // HLS / DASH: probe the manifest URL
  const probe = await probeUrl(classification.resolvedPlaybackUrl);

  let streamStatus;
  if (!probe.reachable && probe.httpStatus === null) {
    // Network failure / timeout — treat as offline, not invalid
    streamStatus = 'offline';
  } else if (probe.httpStatus === 403 || probe.httpStatus === 401) {
    streamStatus = 'access_denied';
  } else if (probe.reachable) {
    streamStatus = 'valid';
  } else {
    streamStatus = 'invalid';
  }

  return {
    ok: true,
    stream_source_mode: classification.mode,
    external_provider: classification.provider,
    external_url: classification.externalUrl,
    resolved_playback_url: classification.resolvedPlaybackUrl,
    stream_status: streamStatus,
    last_checked_at: now,
    provider_metadata: {
      ...classification.providerMetadata,
      probe_http_status: probe.httpStatus,
      probe_latency_ms: probe.latencyMs,
      probe_error: probe.error,
    },
  };
}

/**
 * Re-check the health of an already-resolved source URL.
 * Updates stream_status and last_checked_at without re-classifying.
 * Returns { stream_status, last_checked_at, probe_http_status, probe_latency_ms }.
 */
async function recheckHealth(resolvedPlaybackUrl, mode) {
  const now = new Date().toISOString();

  if (mode === 'external_youtube') {
    // Extract video ID from stored embed URL and re-probe oEmbed.
    const videoId = extractVideoIdFromEmbedUrl(resolvedPlaybackUrl);
    if (!videoId) {
      return { stream_status: 'invalid', last_checked_at: now, probe_http_status: null, probe_latency_ms: null };
    }
    const yt = await probeYouTubeOEmbed(videoId);
    return {
      stream_status: yt.streamStatus,
      last_checked_at: now,
      probe_http_status: yt.httpStatus,
      probe_latency_ms: yt.probeLatencyMs,
      probe_method: 'oembed',
    };
  }

  const probe = await probeUrl(resolvedPlaybackUrl);
  let streamStatus;
  if (!probe.reachable && probe.httpStatus === null) {
    streamStatus = 'offline';
  } else if (probe.httpStatus === 403 || probe.httpStatus === 401) {
    streamStatus = 'access_denied';
  } else if (probe.reachable) {
    streamStatus = 'valid';
  } else {
    streamStatus = 'invalid';
  }

  return {
    stream_status: streamStatus,
    last_checked_at: now,
    probe_http_status: probe.httpStatus,
    probe_latency_ms: probe.latencyMs,
  };
}

// ── Custom error class ───────────────────────────────────────────────────────

class ResolverError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'ResolverError';
  }
}

module.exports = {
  resolveSource,
  recheckHealth,
  classifyUrl,
  ResolverError,
};
