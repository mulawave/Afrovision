"use client";

import Hls from "hls.js";
import type { FragLoadedData } from "hls.js";
import {
  type MediaType,
  cacheSegment,
  getCachedSegment,
  clearSegmentCache,
  getVideo,
  saveHlsStream,
} from "@/lib/offlineStorage";

export interface DownloadedRange {
  start: number;
  end: number;
}

const activeProgressive = new Map<string, { abort: AbortController; hls?: Hls }>();

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
 * Attach progressive download to an hls.js instance.
 * Caches each loaded fragment to IndexedDB.
 * Returns a cleanup function.
 */
export function attachHlsCache(
  hls: Hls,
  mediaType: MediaType,
  mediaId: string,
  onRangeUpdate?: (range: DownloadedRange) => void,
): () => void {
  const idKey = `${mediaType}_${mediaId}`;
  const cachedSegments = new Map<number, { url: string; blob: Blob; start: number; end: number }>();

  const onFragLoaded = async (_event: string, data: FragLoadedData) => {
    const frag = data.frag;
    if (!frag) return;

    const sn = typeof frag.sn === "number" ? frag.sn : -1;
    const segmentKey = `${idKey}_seg_${sn}`;
    const blob = new Blob([data.payload as ArrayBuffer]);

    cachedSegments.set(sn, {
      url: frag.url,
      blob,
      start: frag.start,
      end: frag.start + frag.duration,
    });

    try {
      await cacheSegment(segmentKey, blob, {
        mediaType,
        mediaId,
        sequence: sn,
        url: frag.url,
      });
    } catch {
      // storage full — silently skip
    }

    // Update range
    if (onRangeUpdate && cachedSegments.size > 0) {
      const starts = Array.from(cachedSegments.values()).map((s) => s.start);
      const ends = Array.from(cachedSegments.values()).map((s) => s.end);
      onRangeUpdate({
        start: Math.min(...starts),
        end: Math.max(...ends),
      });
    }
  };

  hls.on(Hls.Events.FRAG_LOADED, onFragLoaded);

  activeProgressive.set(idKey, { abort: new AbortController(), hls });

  return () => {
    hls.off(Hls.Events.FRAG_LOADED, onFragLoaded);
    activeProgressive.delete(idKey);
  };
}

/**
 * Start progressive download for a direct video file.
 * Fetches chunks ahead of the current playback position using Range requests.
 */
export function startProgressiveVideoDownload(
  video: HTMLVideoElement,
  videoUrl: string,
  mediaType: MediaType,
  mediaId: string,
  onRangeUpdate?: (range: DownloadedRange) => void,
): () => void {
  const idKey = `${mediaType}_${mediaId}`;
  const controller = new AbortController();
  const chunks: { start: number; end: number; data: Uint8Array }[] = [];
  let totalDownloaded = 0;

  activeProgressive.set(idKey, { abort: controller });

  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
  const LOOKAHEAD_SECONDS = 30;

  let nextChunkStart = 0;

  async function fetchAhead() {
    if (controller.signal.aborted) return;
    if (!video.duration || video.duration <= 0) {
      setTimeout(fetchAhead, 2000);
      return;
    }

    // Only fetch ahead of current position
    const targetEnd = video.currentTime + LOOKAHEAD_SECONDS;
    if (nextChunkStart >= targetEnd || nextChunkStart >= video.duration) {
      setTimeout(fetchAhead, 3000);
      return;
    }

    const chunkEnd = Math.min(nextChunkStart + CHUNK_SIZE, video.duration * 1e6);

    try {
      const res = await fetch(proxyUrl(videoUrl), {
        headers: { Range: `bytes=${Math.floor(nextChunkStart * 1e6)}-${Math.floor(chunkEnd * 1e6)}` },
        signal: controller.signal,
      });

      if (!res.ok) return;

      const buffer = await res.arrayBuffer();
      chunks.push({
        start: nextChunkStart,
        end: nextChunkStart + buffer.byteLength / 1e6,
        data: new Uint8Array(buffer),
      });
      totalDownloaded += buffer.byteLength;
      nextChunkStart = chunkEnd;

      if (onRangeUpdate) {
        onRangeUpdate({
          start: 0,
          end: nextChunkStart,
        });
      }

      fetchAhead();
    } catch {
      // network error or aborted — stop
    }
  }

  // Start fetching from beginning
  nextChunkStart = 0;
  fetchAhead();

  return () => {
    controller.abort();
    activeProgressive.delete(idKey);
  };
}

/**
 * Get the downloaded range for a media item from the segment cache.
 */
export async function getDownloadedRange(
  mediaType: MediaType,
  mediaId: string,
): Promise<DownloadedRange | null> {
  // For now, return null — the range is tracked in-memory during playback
  // and reported via callbacks. This could be extended to read from IndexedDB.
  return null;
}

/**
 * Stop progressive download for a media item.
 */
export function stopProgressiveDownload(mediaType: MediaType, mediaId: string): void {
  const idKey = `${mediaType}_${mediaId}`;
  const entry = activeProgressive.get(idKey);
  if (entry) {
    entry.abort.abort();
    activeProgressive.delete(idKey);
  }
}

/**
 * Promote a progressive HLS cache to a full offline download.
 * Called when all segments have been cached during playback.
 */
export async function promoteHlsCacheToOffline(
  mediaType: MediaType,
  mediaId: string,
  manifestText: string,
  manifestUrl: string,
  meta: {
    title: string;
    poster_url?: string;
    duration: number;
    series_id?: string;
    episode_number?: number;
    season_number?: number;
  },
): Promise<void> {
  // Check if already fully downloaded
  const existing = await getVideo(mediaType, mediaId);
  if (existing) return;

  // Gather all cached segments for this media
  // This is a best-effort promotion — if not all segments are cached, it won't save
  const idKey = `${mediaType}_${mediaId}`;

  // We need to read all segment_cache entries for this media
  // Since we don't have a direct query, we skip promotion for now
  // Full downloads should use the downloadManager.downloadVideo function
}
