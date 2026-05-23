"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ChannelSurfer } from "@/components/ChannelSurfer";
import { type Channel } from "@/lib/api";
import { getServerTimeApi } from "@/lib/api";
import { resolveWebsiteMediaUrl } from "@/lib/media";

interface LivePlayerProps {
  streamUrl?: string;
  startTime?: number;
  channelName: string;
  channelLogoUrl?: string;
  title: string;
  viewers: number;
  isLive: boolean;
  duration?: number;
  isLoop?: boolean;
  onProgramEnd?: () => void;
  adPlaying?: boolean;
  currentChannel?: Channel | null;
  availableChannels?: Channel[];
  onSelectChannel?: (channelId: string) => void;
}

function formatViewers(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LivePlayer({
  streamUrl,
  startTime,
  channelName,
  channelLogoUrl,
  title,
  viewers,
  isLive,
  duration,
  isLoop,
  onProgramEnd,
  adPlaying,
  currentChannel,
  availableChannels,
  onSelectChannel,
}: LivePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolume] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncRequestInFlightRef = useRef(false);
  const [showSurfer, setShowSurfer] = useState(false);
  const surferHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SURFER_AUTOHIDE_MS = 5000;

  const clearSurferTimer = () => {
    if (surferHideTimer.current) {
      clearTimeout(surferHideTimer.current);
      surferHideTimer.current = null;
    }
  };
  const resetSurferTimer = () => {
    clearSurferTimer();
    surferHideTimer.current = setTimeout(() => setShowSurfer(false), SURFER_AUTOHIDE_MS);
  };
  const closeSurfer = () => {
    setShowSurfer(false);
    clearSurferTimer();
  };
  const toggleSurfer = () => {
    setShowSurfer((v) => {
      const next = !v;
      if (next) resetSurferTimer(); else clearSurferTimer();
      return next;
    });
  };

  const isYouTubeEmbed = useMemo(() => {
    if (!streamUrl) return false;
    return /https?:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//i.test(streamUrl);
  }, [streamUrl]);

  const iframeSrc = useMemo(() => {
    if (!streamUrl || !isYouTubeEmbed) return undefined;
    try {
      const src = new URL(streamUrl);
      src.searchParams.set("autoplay", "1");
      // Keep native YouTube controls available so viewers can unmute when autoplay is browser-muted.
      src.searchParams.set("controls", "1");
      src.searchParams.set("mute", "0");
      src.searchParams.set("playsinline", "1");
      src.searchParams.set("enablejsapi", "1");
      src.searchParams.set("fs", "1");
      src.searchParams.set("origin", typeof window !== "undefined" ? window.location.origin : "https://afrovision.app");
      return src.toString();
    } catch {
      return streamUrl;
    }
  }, [streamUrl, isYouTubeEmbed]);

  // Auto-hide controls
  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  // Server-time sync — relaxed threshold (8s) to avoid aggressive seeking
  // that causes the "plays a few seconds then restarts" issue.
  // For loop mode, let the browser handle native looping instead of seeking.
  const syncToServer = useCallback(async () => {
    if (!videoRef.current || !startTime) return;
    const vid = videoRef.current;
    if (isLoop) {
      vid.loop = true;
      return;
    }
    if (syncRequestInFlightRef.current) return;
    syncRequestInFlightRef.current = true;
    try {
      const res = await getServerTimeApi();
      if (!res.ok || !("server_time" in res.data)) return;
      const serverNow = res.data.server_time;
      const expectedPos = (serverNow - startTime) / 1000;
      if (duration && duration > 0 && expectedPos >= duration) {
        onProgramEnd?.();
        return;
      }
      const drift = Math.abs(vid.currentTime - expectedPos);
      if (drift > 8) {
        vid.currentTime = expectedPos;
      }
    } finally {
      syncRequestInFlightRef.current = false;
    }
  }, [startTime, duration, isLoop, onProgramEnd]);

  useEffect(() => {
    if (!startTime) return;
    const video = videoRef.current;

    // Initial sync after a short delay to let video buffer
    const initialTimeout = setTimeout(syncToServer, 2000);

    function syncWhenVisible() {
      if (document.visibilityState === "visible") {
        syncToServer();
      }
    }

    window.addEventListener("focus", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);
    video?.addEventListener("loadedmetadata", syncToServer);
    video?.addEventListener("playing", syncToServer);

    return () => {
      clearTimeout(initialTimeout);
      window.removeEventListener("focus", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      video?.removeEventListener("loadedmetadata", syncToServer);
      video?.removeEventListener("playing", syncToServer);
    };
  }, [startTime, syncToServer]);

  // Elapsed timer
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  // TV mode: no play/pause — only volume and quality for YouTube, mute for video
  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setVolume(videoRef.current.muted ? 0 : 100);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  };

  // Ensure video stays playing (TV behavior — no user pause control)
  // Skip auto-resume when an ad break is active
  useEffect(() => {
    if (!videoRef.current || !streamUrl) return;
    const vid = videoRef.current;

    const handlePause = () => {
      if (adPlaying) return; // Don't auto-resume during ad break
      // Auto-resume if paused unexpectedly (TV mode: always playing)
      vid.play().catch(() => {});
    };

    vid.addEventListener("pause", handlePause);
    return () => vid.removeEventListener("pause", handlePause);
  }, [streamUrl, adPlaying]);

  // Pause/resume video when ad break starts/ends
  useEffect(() => {
    if (!videoRef.current || !streamUrl) return;
    const vid = videoRef.current;
    if (adPlaying) {
      vid.pause();
    } else {
      vid.play().catch(() => {});
    }
  }, [adPlaying, streamUrl]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video rounded-2xl overflow-hidden bg-black group"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Channel surfer now anchored inside controls bar */}
      {/* Video element (hidden when no stream URL — shows "Not Transmitting") */}
      {streamUrl ? (
        isYouTubeEmbed && iframeSrc ? (
          <iframe
            src={iframeSrc}
            title={title || channelName}
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="w-full h-full bg-black"
          />
        ) : (
          <video
            ref={videoRef}
            src={streamUrl}
            autoPlay
            muted={volume === 0}
            playsInline
            loop={!!isLoop}
            className="w-full h-full object-contain bg-black"
            onEnded={() => {
              // Program video finished — signal parent to fetch next program
              if (!isLoop) {
                onProgramEnd?.();
              }
            }}
          />
        )
      ) : (
        /* ── "Not Transmitting" screen — TV static / color bars ── */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0a0e2e] via-[#060b2a] to-[#020520]">
          {/* Classic TV color bars at top */}
          <div className="absolute top-0 left-0 right-0 flex h-3 opacity-60">
            <div className="flex-1 bg-[#c0c0c0]" />
            <div className="flex-1 bg-[#c0c000]" />
            <div className="flex-1 bg-[#00c0c0]" />
            <div className="flex-1 bg-[#00c000]" />
            <div className="flex-1 bg-[#c000c0]" />
            <div className="flex-1 bg-[#c00000]" />
            <div className="flex-1 bg-[#0000c0]" />
          </div>

          {/* Static noise overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: "128px 128px",
          }} />

          {/* Channel logo or TV icon */}
          {channelLogoUrl ? (
            <Image
              src={resolveWebsiteMediaUrl(channelLogoUrl)}
              alt={channelName}
              width={96}
              height={96}
              unoptimized
              className="w-24 h-24 rounded-2xl border-2 border-white/10 object-cover mb-5 opacity-80"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl border-2 border-white/10 bg-white/5 flex items-center justify-center mb-5">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="15" rx="2" />
                <polyline points="17 2 12 7 7 2" />
              </svg>
            </div>
          )}

          <p className="text-sm font-semibold text-av-light-orange mb-1.5 tracking-wide uppercase">
            {channelName}
          </p>
          <p className="text-sm text-av-light-orange max-w-xs text-center leading-relaxed">
            This channel is currently not transmitting any show now, check back later.
          </p>

          {/* Pulsing dot */}
          <div className="mt-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
            <span className="text-[11px] text-av-light-orange uppercase tracking-widest font-medium">standby</span>
          </div>

          {/* Color bars at bottom */}
          <div className="absolute bottom-0 left-0 right-0 flex h-3 opacity-60">
            <div className="flex-1 bg-[#0000c0]" />
            <div className="flex-1 bg-[#131313]" />
            <div className="flex-1 bg-[#c000c0]" />
            <div className="flex-1 bg-[#131313]" />
            <div className="flex-1 bg-[#00c0c0]" />
            <div className="flex-1 bg-[#131313]" />
            <div className="flex-1 bg-[#c0c0c0]" />
          </div>
        </div>
      )}

      {/* Top overlay bar — always visible when stream is playing */}
      {streamUrl && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <div className="flex items-center gap-2.5 pointer-events-auto">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-av-error text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-av-error/30">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[11px] font-medium text-av-light-orange">
              👁 {formatViewers(viewers)} watching
            </span>
            {elapsed > 0 && (
              <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[11px] font-mono text-av-light-orange">
                ⏱ {formatDuration(elapsed)}
              </span>
            )}
          </div>
          <span className="px-3 py-1 rounded-full bg-av-card/60 backdrop-blur-sm text-[11px] font-semibold text-av-light-orange">
            📺 {channelName}
          </span>
        </div>
      )}

      {/* Bottom controls bar — TV mode: mute + fullscreen only, NO play/pause */}
      {streamUrl && (
        <div
          className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
        >
          {/* Live indicator bar (no interactive progress/seek) */}
          <div className="w-full h-1 rounded-full bg-white/10 mb-3 overflow-hidden">
            <div className="h-1 rounded-full bg-av-error w-full origin-left animate-pulse" />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!isYouTubeEmbed && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                  className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all"
                  aria-label={volume === 0 ? "Unmute" : "Mute"}
                >
                  {volume === 0 ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.21.05-.43.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-3.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
              )}

              <span className="text-xs text-av-light-orange font-medium">{title}</span>
            </div>

            {/* Center surfer (anchored inside controls bar) */}
            {showSurfer && currentChannel && availableChannels && onSelectChannel && (
              <div className="pointer-events-auto" onMouseEnter={resetSurferTimer} onMouseMove={resetSurferTimer}>
                <ChannelSurfer
                  currentChannel={currentChannel}
                  channels={availableChannels}
                  onSelectChannel={(id) => { closeSurfer(); onSelectChannel(id); }}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Quality indicator for regular video */}
              {!isYouTubeEmbed && (
                <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold text-av-light-orange">
                  HD
                </span>
              )}

              {/* Channels list toggle (TV icon) */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSurfer(); }}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all"
                aria-label="Toggle channel surfer"
                title="Channels"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M21 17H3V5h18v12zM19 7H5v8h14V7zm-8 10h2l1 2h-4l1-2z" />
                </svg>
              </button>

              {/* Fullscreen */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all"
                aria-label="Toggle fullscreen"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
