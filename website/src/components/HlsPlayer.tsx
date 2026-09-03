"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { attachHlsCache, type DownloadedRange } from "@/lib/progressiveDownload";

// Most external HLS origins (GCS, CDNs) support CORS, so we load directly
// without proxying. The proxy added latency and server load. If a specific
// origin needs proxying in the future, add it to this allowlist.
const PROXY_ORIGINS: Set<string> = new Set();

function maybeProxyHlsUrl(src: string): string {
  try {
    const parsed = new URL(src);
    // Don't proxy blob: URLs (offline playback) or same-origin URLs
    if (parsed.protocol === "blob:") return src;
    if (typeof window !== "undefined" && parsed.origin !== window.location.origin) {
      if (PROXY_ORIGINS.has(parsed.origin)) {
        return `/api/hls-proxy?url=${encodeURIComponent(src)}`;
      }
    }
  } catch {
    // Not a valid URL, return as-is
  }
  return src;
}

interface HlsPlayerProps {
  src: string;
  onPlay?: () => void;
  onEnded?: () => void;
  onPause?: () => void;
  onSeeked?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onProgressiveDownloadProgress?: (range: DownloadedRange) => void;
  className?: string;
  controls?: boolean;
  playsInline?: boolean;
  offlineId?: string;
}

export function HlsPlayer({
  src,
  onPlay,
  onEnded,
  onPause,
  onSeeked,
  onTimeUpdate,
  onLoadedMetadata,
  onProgressiveDownloadProgress,
  className,
  controls = true,
  playsInline = true,
  offlineId,
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const proxiedSrc = maybeProxyHlsUrl(src);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let detachCache: (() => void) | undefined;
    let proxyAttempted = false;

    // Determine if the source is cross-origin (may need CORS fallback via proxy)
    let isCrossOrigin = false;
    try {
      const parsed = new URL(src);
      isCrossOrigin =
        parsed.protocol !== "blob:" &&
        typeof window !== "undefined" &&
        parsed.origin !== window.location.origin;
    } catch {
      // not a valid URL — leave as false
    }

    const createHlsInstance = (url: string): Hls => {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 90,
        maxMaxBufferLength: 120,
      });
      hls.loadSource(url);
      hls.attachMedia(video);

      // Attach progressive download caching if offlineId is provided
      if (offlineId && onProgressiveDownloadProgress) {
        const [mediaType, mediaId] = offlineId.split("_");
        if (mediaType && mediaId) {
          detachCache = attachHlsCache(
            hls,
            mediaType as "movie" | "episode",
            mediaId,
            onProgressiveDownloadProgress,
          );
        }
      }

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        // If direct cross-origin loading fails with a network error (likely CORS),
        // retry through the server-side proxy as a fallback.
        if (
          data.type === Hls.ErrorTypes.NETWORK_ERROR &&
          !proxyAttempted &&
          isCrossOrigin &&
          url === src
        ) {
          proxyAttempted = true;
          hls.destroy();
          hlsRef.current = null;
          if (detachCache) {
            detachCache();
            detachCache = undefined;
          }
          hlsRef.current = createHlsInstance(
            `/api/hls-proxy?url=${encodeURIComponent(src)}`,
          );
          return;
        }

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            hlsRef.current = null;
            break;
        }
      });

      return hls;
    };

    // Native HLS support (Safari, iOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = proxiedSrc;
      return;
    }

    // Use hls.js for browsers without native HLS support
    if (Hls.isSupported()) {
      hlsRef.current = createHlsInstance(proxiedSrc);
    }

    // Single unified cleanup — destroys HLS instance and detaches cache
    return () => {
      if (detachCache) detachCache();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [proxiedSrc]);

  return (
    <video
      ref={videoRef}
      controls={controls}
      className={className}
      onPlay={onPlay}
      onEnded={onEnded}
      onPause={onPause}
      onSeeked={onSeeked}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        onTimeUpdate?.(v.currentTime, v.duration);
      }}
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        onLoadedMetadata?.(v.duration);
      }}
      playsInline={playsInline}
      preload="metadata"
    />
  );
}
