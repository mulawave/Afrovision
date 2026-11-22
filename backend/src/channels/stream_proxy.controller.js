/**
 * Authenticated Per-Channel Stream Relay Proxy
 *
 * Allows channels flagged with `use_stream_proxy: true` (or falling back from
 * regional/ISP blocks) to relay HLS manifests and segments through AfroVision's
 * backend server so viewers do not need a VPN.
 *
 * Security model (NOT an open proxy):
 *   1. Initial entry requests without a signed token ONLY proxy the channel's
 *      own registered `resolved_playback_url || external_url` and enforce
 *      `checkChannelAccess` for exclusive channels.
 *   2. Rewritten sub-playlists, encryption keys, and segments inside `.m3u8`
 *      manifests are signed with a short-lived HMAC-SHA256 token (`exp` + `sig`).
 *   3. Full SSRF protection blocks private, loopback, link-local, and cloud
 *      metadata IPs both by literal IP and DNS resolution.
 */

const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const { Readable } = require('stream');
const Channel = require('./channel.model');
const { checkChannelAccess } = require('../utils/exclusive-access-helper');
const { verifyToken } = require('../utils/jwt');

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getProxySecret() {
  return (
    process.env.STREAM_PROXY_SECRET ||
    process.env.JWT_SECRET ||
    'afrovision-stream-proxy-fallback'
  );
}

function signTarget(channelId, targetUrl, exp) {
  return crypto
    .createHmac('sha256', getProxySecret())
    .update(`${channelId}:${targetUrl}:${exp}`)
    .digest('hex')
    .slice(0, 32);
}

function verifySignature(channelId, targetUrl, expStr, sig) {
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  const expected = signTarget(channelId, targetUrl, exp);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(sig), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isDisallowedIp(ip) {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    return false;
  }
  return false;
}

async function assertUrlIsSafeToFetch(targetUrl) {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }
  const hostname = parsed.hostname;
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error('Target host is not allowed');
  }
  if (net.isIP(hostname)) {
    if (isDisallowedIp(hostname)) throw new Error('Target host is not allowed');
    return;
  }
  const results = await dns.lookup(hostname, { all: true });
  const addresses = results.map((r) => r.address);
  if (addresses.length === 0 || addresses.some(isDisallowedIp)) {
    throw new Error('Target host is not allowed');
  }
}

function resolveRelativeUrl(uri, originalUrl) {
  try {
    return new URL(uri, originalUrl).toString();
  } catch {
    return null;
  }
}

function buildSignedProxyUrl(baseProxyPath, channelId, targetUrl, exp) {
  const sig = signTarget(channelId, targetUrl, exp);
  return `${baseProxyPath}?url=${encodeURIComponent(targetUrl)}&exp=${exp}&sig=${sig}`;
}

function rewriteManifest(text, originalUrl, baseProxyPath, channelId) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const lines = text.split('\n');
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        // Rewrite URI="..." attributes inside #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA, etc.
        return line.replace(/URI="([^"]+)"/gi, (_, rawUri) => {
          const abs = resolveRelativeUrl(rawUri, originalUrl);
          if (!abs) return `URI="${rawUri}"`;
          return `URI="${buildSignedProxyUrl(baseProxyPath, channelId, abs, exp)}"`;
        });
      }
      const abs = resolveRelativeUrl(trimmed, originalUrl);
      if (!abs) return line;
      return buildSignedProxyUrl(baseProxyPath, channelId, abs, exp);
    })
    .join('\n');
}

async function proxyChannelStream(req, res) {
  try {
    const channelId = req.params.id;
    const channel = await Channel.findById(channelId);
    if (!channel || !channel.is_active || channel.is_banned) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const queryUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const expStr = typeof req.query.exp === 'string' ? req.query.exp.trim() : '';
    const sig = typeof req.query.sig === 'string' ? req.query.sig.trim() : '';

    let targetUrl = '';
    if (queryUrl && expStr && sig) {
      // Signed sub-playlist / segment request generated by manifest rewrite
      if (!verifySignature(channelId, queryUrl, expStr, sig)) {
        return res.status(403).json({ error: 'Invalid or expired stream relay signature' });
      }
      targetUrl = queryUrl;
    } else {
      // Entry request: enforce channel access and strictly restrict to the
      // channel's own registered stream URL (prevents open-proxy abuse).
      let effectiveUserId = req.userId || null;
      if (!effectiveUserId && typeof req.query.token === 'string' && req.query.token.trim()) {
        try {
          const payload = await verifyToken(req.query.token.trim());
          effectiveUserId = payload?.userId || null;
        } catch (_) {}
      }
      const access = await checkChannelAccess(channel, effectiveUserId);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }
      const registeredUrl = (channel.resolved_playback_url || channel.external_url || '').trim();
      if (!registeredUrl) {
        return res.status(404).json({ error: 'No external stream URL configured for this channel' });
      }
      targetUrl = registeredUrl;
    }

    await assertUrlIsSafeToFetch(targetUrl);

    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*',
    };
    if (req.headers.range) {
      upstreamHeaders.Range = req.headers.range;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let upstream;
    try {
      upstream = await fetch(targetUrl, {
        headers: upstreamHeaders,
        redirect: 'follow',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({
        error: `Upstream stream returned HTTP ${upstream.status}`,
      });
    }

    const finalUrl = upstream.url || targetUrl;
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const isManifest =
      contentType.toLowerCase().includes('mpegurl') ||
      finalUrl.toLowerCase().includes('.m3u8');

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (isManifest) {
      const text = await upstream.text();
      const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
      const host = req.get('host');
      const baseProxyPath = `${proto}://${host}/channels/${encodeURIComponent(channelId)}/stream-proxy`;
      const rewritten = rewriteManifest(text, finalUrl, baseProxyPath, channelId);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).send(rewritten);
    }

    // Binary media segment (.ts, .m4s, .mp4, key): stream directly to client.
    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=10');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    if (!upstream.body) {
      return res.end();
    }
    const nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.on('error', () => {
      if (!res.headersSent) res.status(502).end();
      else res.end();
    });
    return nodeStream.pipe(res);
  } catch (err) {
    console.error('[StreamProxy] error:', err.message);
    if (!res.headersSent) {
      return res.status(502).json({ error: 'Stream relay failed' });
    }
    return res.end();
  }
}

module.exports = { proxyChannelStream };
