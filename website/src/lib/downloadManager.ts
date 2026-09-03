"use client";

import {
  type MediaType,
  type OfflineVideoMeta,
  type OfflineVideoRecord,
  saveDirectVideo,
  saveHlsStream,
  isDownloaded,
  deleteVideo,
  getVideo,
  requestPersistentStorage,
} from "@/lib/offlineStorage";

export interface DownloadMeta {
  mediaType: MediaType;
  mediaId: string;
  title: string;
  poster_url?: string;
  video_source_mode: string;
  manifest_url?: string;
  hosted_url?: string;
  external_url?: string;
  hls_url?: string;
  duration: number;
  series_id?: string;
  episode_number?: number;
  season_number?: number;
}

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

type ProgressCallback = (progress: DownloadProgress) => void;

const activeDownloads = new Map<string, AbortController>();

function proxyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "blob:") return url;
    if (typeof window !== "undefined" && parsed.origin !== window.location.origin) {
      return `/api/hls-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // not a URL
  }
  return url;
}

/**
 * Fetch with fallback: try proxy first, then direct fetch on 403.
 * Some external CDNs block server-side proxy requests but allow direct browser requests.
 */
async function fetchWithFallback(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const proxied = proxyUrl(url);
  const res = await fetch(proxied, init);
  if (res.ok) return res;

  // On 403 from proxy, try direct fetch (CDN may allow CORS from browser)
  if (res.status === 403 && proxied !== url) {
    const directRes = await fetch(url, init);
    return directRes;
  }

  return res;
}

export async function getDownloadSize(meta: DownloadMeta): Promise<number> {
  const url = getVideoUrl(meta);
  if (!url) return 0;

  if (meta.video_source_mode === "hls") {
    return estimateHlsSize(url);
  }

  // Direct video — HEAD request for Content-Length
  try {
    const res = await fetchWithFallback(url, { method: "HEAD" });
    const len = parseInt(res.headers.get("content-length") || "0", 10);
    return len;
  } catch {
    return 0;
  }
}

async function estimateHlsSize(manifestUrl: string): Promise<number> {
  try {
    const res = await fetchWithFallback(manifestUrl);
    if (!res.ok) return 0;
    const text = await res.text();
    const lines = text.split("\n");
    const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf("/") + 1);

    let totalSize = 0;
    const segmentUrls: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        // Check for key URI
        if (trimmed.startsWith("#EXT-X-KEY") && trimmed.includes("URI=")) {
          const match = trimmed.match(/URI="([^"]+)"/);
          if (match) {
            const keyUrl = match[1].startsWith("http") ? match[1] : baseUrl + match[1];
            segmentUrls.push(keyUrl);
          }
        }
        continue;
      }

      const absoluteUrl = trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;

      // If it's a sub-manifest (.m3u8), recurse
      if (trimmed.endsWith(".m3u8")) {
        totalSize += await estimateHlsSize(absoluteUrl);
      } else {
        segmentUrls.push(absoluteUrl);
      }
    }

    // HEAD request each segment for Content-Length (with concurrency limit)
    const CONCURRENCY = 5;
    for (let i = 0; i < segmentUrls.length; i += CONCURRENCY) {
      const batch = segmentUrls.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (u) => {
          try {
            const r = await fetchWithFallback(u, { method: "HEAD" });
            return parseInt(r.headers.get("content-length") || "0", 10);
          } catch {
            return 0;
          }
        }),
      );
      totalSize += results.reduce((sum, s) => sum + s, 0);
    }

    return totalSize;
  } catch {
    return 0;
  }
}

function getVideoUrl(meta: DownloadMeta): string | null {
  if (meta.video_source_mode === "hls") return meta.hls_url ?? null;
  if (meta.video_source_mode === "external_url") return meta.external_url ?? null;
  return meta.hosted_url ?? null;
}

export async function downloadVideo(
  meta: DownloadMeta,
  onProgress?: ProgressCallback,
): Promise<void> {
  const idKey = `${meta.mediaType}_${meta.mediaId}`;

  // Check if already downloaded
  if (await isDownloaded(meta.mediaType, meta.mediaId)) {
    return;
  }

  // Request persistent storage
  await requestPersistentStorage();

  const controller = new AbortController();
  activeDownloads.set(idKey, controller);

  try {
    const url = getVideoUrl(meta);
    if (!url) throw new Error("No video URL available");

    if (meta.video_source_mode === "hls") {
      await downloadHlsStream(meta, url, onProgress, controller.signal);
    } else {
      await downloadDirectVideo(meta, url, onProgress, controller.signal);
    }
  } finally {
    activeDownloads.delete(idKey);
  }
}

async function downloadDirectVideo(
  meta: DownloadMeta,
  url: string,
  onProgress: ProgressCallback | undefined,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetchWithFallback(url, { signal });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const chunks: Uint8Array[] = [];
  let downloadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    downloadedBytes += value.length;
    if (onProgress && contentLength > 0) {
      onProgress({
        percent: (downloadedBytes / contentLength) * 100,
        downloadedBytes,
        totalBytes: contentLength,
      });
    }
  }

  const blob = new Blob(chunks as BlobPart[]);

  await saveDirectVideo(
    {
      mediaType: meta.mediaType,
      mediaId: meta.mediaId,
      title: meta.title,
      poster_url: meta.poster_url,
      video_source_mode: meta.video_source_mode,
      duration: meta.duration,
      series_id: meta.series_id,
      episode_number: meta.episode_number,
      season_number: meta.season_number,
    },
    blob,
  );

  if (onProgress) {
    onProgress({ percent: 100, downloadedBytes: blob.size, totalBytes: blob.size });
  }
}

async function downloadHlsStream(
  meta: DownloadMeta,
  manifestUrl: string,
  onProgress: ProgressCallback | undefined,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetchWithFallback(manifestUrl, { signal });
  if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);

  const manifestText = await res.text();
  const lines = manifestText.split("\n");
  const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf("/") + 1);

  const segmentUrls: string[] = [];
  let keyUrl: string | null = null;
  let keyIv: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("#EXT-X-KEY")) {
      const uriMatch = trimmed.match(/URI="([^"]+)"/);
      if (uriMatch) {
        keyUrl = uriMatch[1].startsWith("http") ? uriMatch[1] : baseUrl + uriMatch[1];
      }
      const ivMatch = trimmed.match(/IV=0x([0-9a-fA-F]+)/);
      if (ivMatch) {
        keyIv = ivMatch[1];
      }
      continue;
    }

    if (trimmed.startsWith("#")) continue;

    const absoluteUrl = trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;
    if (!trimmed.endsWith(".m3u8")) {
      segmentUrls.push(absoluteUrl);
    }
  }

  // Get total size estimate
  let totalBytes = 0;
  const segmentSizes: number[] = [];
  const CONCURRENCY = 5;

  for (let i = 0; i < segmentUrls.length; i += CONCURRENCY) {
    const batch = segmentUrls.slice(i, i + CONCURRENCY);
    const sizes = await Promise.all(
      batch.map(async (u) => {
        try {
          const r = await fetchWithFallback(u, { method: "HEAD", signal });
          return parseInt(r.headers.get("content-length") || "0", 10);
        } catch {
          return 0;
        }
      }),
    );
    segmentSizes.push(...sizes);
    totalBytes += sizes.reduce((sum, s) => sum + s, 0);
  }

  // Fetch encryption key if present
  let keyBlob: Blob | undefined;
  if (keyUrl) {
    try {
      const keyRes = await fetchWithFallback(keyUrl, { signal });
      if (keyRes.ok) {
        keyBlob = await keyRes.blob();
        totalBytes += keyBlob.size;
      }
    } catch {
      // key fetch failed
    }
  }

  // Download all segments
  const segments: { url: string; blob: Blob; sequence: number }[] = [];
  let downloadedBytes = 0;

  for (let i = 0; i < segmentUrls.length; i += CONCURRENCY) {
    if (signal.aborted) throw new Error("Download cancelled");

    const batch = segmentUrls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (u, j) => {
        const r = await fetchWithFallback(u, { signal });
        if (!r.ok) throw new Error(`Segment fetch failed: ${r.status}`);
        const blob = await r.blob();
        return { url: u, blob, sequence: i + j };
      }),
    );

    segments.push(...results);
    downloadedBytes += results.reduce((sum, r) => sum + r.blob.size, 0);

    if (onProgress && totalBytes > 0) {
      onProgress({
        percent: (downloadedBytes / totalBytes) * 100,
        downloadedBytes,
        totalBytes,
      });
    }
  }

  await saveHlsStream(
    {
      mediaType: meta.mediaType,
      mediaId: meta.mediaId,
      title: meta.title,
      poster_url: meta.poster_url,
      video_source_mode: meta.video_source_mode,
      manifest_url: manifestUrl,
      duration: meta.duration,
      series_id: meta.series_id,
      episode_number: meta.episode_number,
      season_number: meta.season_number,
    },
    manifestText,
    segments,
    keyBlob,
    keyIv ?? undefined,
  );

  if (onProgress) {
    onProgress({ percent: 100, downloadedBytes, totalBytes });
  }
}

export function cancelDownload(mediaType: MediaType, mediaId: string): void {
  const idKey = `${mediaType}_${mediaId}`;
  const controller = activeDownloads.get(idKey);
  if (controller) {
    controller.abort();
    activeDownloads.delete(idKey);
  }
}

export async function removeDownload(mediaType: MediaType, mediaId: string): Promise<void> {
  cancelDownload(mediaType, mediaId);
  await deleteVideo(mediaType, mediaId);
}

export async function getOfflineVideoUrl(
  mediaType: MediaType,
  mediaId: string,
): Promise<string | null> {
  const record = await getVideo(mediaType, mediaId);
  if (!record) return null;

  // Direct video — create a blob URL
  if (record.video_blob) {
    return URL.createObjectURL(record.video_blob);
  }

  // HLS — build a rewritten manifest with blob URLs for segments and keys
  if (record.video_source_mode === "hls" && record.manifest_text) {
    return buildOfflineHlsManifest(record);
  }

  return null;
}

/**
 * Build a playable blob URL for an offline HLS stream.
 * Rewrites the manifest to replace segment and key URIs with blob URLs
 * created from the stored segment blobs in IndexedDB.
 */
async function buildOfflineHlsManifest(record: OfflineVideoRecord): Promise<string | null> {
  if (!record.manifest_text || !record.segments || record.segments.length === 0) return null;

  // Create blob URLs for each segment, keyed by original URL
  const segmentBlobUrls = new Map<string, string>();
  for (const seg of record.segments) {
    segmentBlobUrls.set(seg.url, URL.createObjectURL(seg.blob));
  }

  // Create blob URL for encryption key if present
  let keyBlobUrl: string | null = null;
  if (record.encryption_key) {
    keyBlobUrl = URL.createObjectURL(record.encryption_key);
  }

  // Rewrite manifest lines
  const lines = record.manifest_text.split("\n");
  const baseUrl = record.manifest_url
    ? record.manifest_url.substring(0, record.manifest_url.lastIndexOf("/") + 1)
    : "";

  const rewritten = lines
    .map((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Rewrite URI="..." inside #EXT-X-KEY and #EXT-X-MAP tags
      if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP")) {
        return line.replace(/URI="([^"]+)"/g, (_match: string, uri: string) => {
          const absolute = uri.startsWith("http") ? uri : baseUrl + uri;
          if (keyBlobUrl && record.encryption_iv) {
            // Replace key URI with blob URL
            return `URI="${keyBlobUrl}"`;
          }
          const blobUrl = segmentBlobUrls.get(absolute);
          if (blobUrl) return `URI="${blobUrl}"`;
          return `URI="${uri}"`;
        });
      }

      // Skip other comment/tag lines
      if (trimmed.startsWith("#")) return line;

      // Replace segment URL with blob URL
      const absoluteUrl = trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;
      const blobUrl = segmentBlobUrls.get(absoluteUrl);
      if (blobUrl) return blobUrl;

      return line;
    })
    .join("\n");

  // Create a blob URL for the rewritten manifest
  const manifestBlob = new Blob([rewritten], { type: "application/vnd.apple.mpegurl" });
  return URL.createObjectURL(manifestBlob);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
}
