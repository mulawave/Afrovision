'use strict';

const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const { URL } = require('url');

const OPENSUBTITLES_API = 'https://api.opensubtitles.com/api/v1';
const UA = 'AfroVision/1.0';

/**
 * GET /subtitles/search
 * Query params: query (title), language (e.g. en), year (optional)
 * Searches OpenSubtitles.com REST API v1 (no auth needed for search).
 */
router.get('/search', async (req, res) => {
  const { query, language = 'en', year } = req.query;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }

  const params = new URLSearchParams({
    query: query.trim(),
    languages: language,
    ...(year ? { year: String(year) } : {}),
    order_by: 'download_count',
    order_direction: 'desc',
  });

  const url = `${OPENSUBTITLES_API}/subtitles?${params.toString()}`;

  try {
    const raw = await fetchJson(url, { 'User-Agent': UA, 'Accept': 'application/json' });
    const items = (raw.data || []).slice(0, 20).map((item) => ({
      id: item.id,
      title: item.attributes?.feature_details?.title ?? item.attributes?.release ?? query,
      year: item.attributes?.feature_details?.year ?? null,
      language: item.attributes?.language ?? language,
      subtitle_id: item.attributes?.subtitle_id ?? item.id,
      files: (item.attributes?.files || []).map((f) => ({
        file_id: f.file_id,
        file_name: f.file_name,
      })),
      download_count: item.attributes?.download_count ?? 0,
      fps: item.attributes?.fps ?? null,
    }));

    return res.json({ subtitles: items });
  } catch (err) {
    console.error('[Subtitles] search error:', err.message);
    return res.status(502).json({ error: 'Subtitle search failed', detail: err.message });
  }
});

/**
 * POST /subtitles/download
 * Body: { file_id: number }
 * Calls OpenSubtitles download endpoint (guest token) and returns the download URL.
 */
router.post('/download', async (req, res) => {
  const { file_id } = req.body;
  if (!file_id) {
    return res.status(400).json({ error: 'file_id is required' });
  }

  try {
    const raw = await fetchJson(
      `${OPENSUBTITLES_API}/download`,
      { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      'POST',
      JSON.stringify({ file_id: Number(file_id) }),
    );

    return res.json({
      link: raw.link,
      file_name: raw.file_name,
      requests: raw.requests,
      remaining: raw.remaining,
    });
  } catch (err) {
    console.error('[Subtitles] download error:', err.message);
    return res.status(502).json({ error: 'Subtitle download request failed', detail: err.message });
  }
});

/**
 * GET /subtitles/proxy?url=<subtitle_url>
 * Downloads a subtitle file (.srt or .vtt) and returns it to the browser,
 * bypassing CORS restrictions the browser would face hitting the origin directly.
 */
router.get('/proxy', async (req, res) => {
  const { url: rawUrl } = req.query;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Only allow https/http
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only http/https URLs are allowed' });
  }

  try {
    const content = await fetchRaw(rawUrl);
    const ext = (parsed.pathname.split('.').pop() || '').toLowerCase();
    const contentType = ext === 'vtt' ? 'text/vtt' : 'application/x-subrip';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(content);
  } catch (err) {
    console.error('[Subtitles] proxy error:', err.message);
    return res.status(502).json({ error: 'Failed to fetch subtitle file', detail: err.message });
  }
});

// ── helpers ─────────────────────────────────────────────────────────────────

function fetchJson(url, headers = {}, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from ${url}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', reject);
    req.end();
  });
}

module.exports = router;
