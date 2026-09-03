"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveWebsiteMediaUrl } from "@/lib/media";
import { downloadSubtitleApi, getSubtitleProxyUrl, searchSubtitlesApi, type Channel, type SubtitleResult, type ScheduleProgram } from "@/lib/api";
import { getClassificationMeta, getContentLabels, type ContentRating } from "@/lib/content-rating";
import { ChannelSurfer } from "@/components/ChannelSurfer";

type StreamMode = "native" | "external_url" | "external_youtube" | "external_hls" | "external_dash";

type SchedulerState = { reason: string; program_id?: string; video_missing?: boolean } | null;

interface ExternalStreamPlayerProps {
  currentChannel?: Channel | null;
  availableChannels?: Channel[];
  onSelectChannel?: (channelId: string) => void;
  channelName: string;
  channelLogoUrl?: string | null;
  streamSourceMode?: StreamMode;
  playbackUrl: string | null;
  streamStatus?: string;
  schedule?: ScheduleProgram[];
  serverTime?: number;
  schedulerState?: SchedulerState;
  onRefreshUrl?: () => void;
  contentRating?: ContentRating | null;
  // Native (upload) stream sync data
  programStartTime?: number;
  programEndTime?: number;
  programDuration?: number;
  programPosition?: number;
  isLoop?: boolean;
  onProgramEnd?: () => void;
}

type RuntimeMode = "youtube" | "hls" | "dash" | "url" | "unknown";

interface AudioTrack {
  id: number;
  name: string;
  lang: string;
}

interface StreamMeta {
  title: string | null;
  language: string | null;
  audioTracks: AudioTrack[];
  hasSubtitlesTracks: boolean;
}

interface QualityOption {
  levelIndex: number;
  label: string;
}

function mapHlsErrorMessage(details?: string, fatalType?: string): string {
  const detail = (details ?? "").toLowerCase();

  if (detail.includes("manifestloaderror") || detail.includes("manifestloadtimeout")) {
    return "Stream source is temporarily unavailable. Retrying...";
  }
  if (detail.includes("manifestparsingerror")) {
    return "This channel stream is misconfigured right now. Please try again shortly.";
  }
  if (detail.includes("levelloaderror") || detail.includes("fragloaderror")) {
    return "Network is unstable for this channel. Reconnecting...";
  }
  if (fatalType === "networkError") {
    return "Network interruption detected. Reconnecting stream...";
  }
  if (fatalType === "mediaError") {
    return "Recovering media playback...";
  }

  return "Playback issue detected. Attempting to recover...";
}

function inferMode(streamSourceMode: StreamMode | undefined, playbackUrl: string | null): RuntimeMode {
  if (!playbackUrl) return "unknown";
  if (streamSourceMode === "external_youtube") return "youtube";
  if (streamSourceMode === "external_hls") return "hls";
  if (streamSourceMode === "external_dash") return "dash";
  const lower = playbackUrl.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtube-nocookie.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes(".m3u8")) return "hls";
  if (lower.includes(".mpd")) return "dash";
  return "url";
}

type SchedulerMessageType = "starting_soon" | "program_has_no_video" | "offline" | "no_source";

interface SchedulerMessage {
  type: SchedulerMessageType;
  startTime?: number;
  title?: string;
}

function getSchedulerMessage(
  streamSourceMode: StreamMode | undefined,
  schedule: ScheduleProgram[],
  serverTime: number,
  schedulerState: SchedulerState,
): SchedulerMessage | null {
  // Only native channels resolve playback from the schedule. External modes keep their existing error path.
  if (!streamSourceMode || streamSourceMode === "external_url" || streamSourceMode.startsWith("external_")) {
    return null;
  }

  const reason = schedulerState?.reason;

  if (reason === "current" && schedulerState?.video_missing) {
    return { type: "program_has_no_video" };
  }

  if (reason === "upcoming") {
    const program = schedulerState?.program_id
      ? schedule.find((p) => p.id === schedulerState.program_id)
      : schedule.find((p) => p.start_time > serverTime);
    if (program) {
      return { type: "starting_soon", startTime: program.start_time, title: program.video_title };
    }
  }

  if (reason === "loop" || reason === "offline") {
    return { type: "offline" };
  }

  // Fallback when schedulerState is absent or stale: compute directly from schedule.
  const currentProgram = schedule.find((p) => p.start_time <= serverTime && p.end_time > serverTime);
  if (currentProgram) {
    return { type: "program_has_no_video" };
  }
  const upcoming = schedule.find((p) => p.start_time > serverTime);
  if (upcoming) {
    return { type: "starting_soon", startTime: upcoming.start_time, title: upcoming.video_title };
  }
  if (schedule.length > 0) {
    return { type: "offline" };
  }
  return { type: "no_source" };
}

function formatStartingSoonTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildYouTubeEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    let videoId = "";
    if (host.includes("youtu.be")) {
      videoId = parts[0] ?? "";
    } else {
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        videoId = parts[embedIdx + 1];
      } else {
        videoId = parsed.searchParams.get("v") ?? "";
      }
    }
    if (!videoId) return null;
    const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    url.searchParams.set("autoplay", "1");
    // Try to start with audio; browsers may still force muted autoplay, so keep controls visible.
    url.searchParams.set("mute", "0");
    url.searchParams.set("playsinline", "1");
    url.searchParams.set("controls", "1");
    url.searchParams.set("modestbranding", "1");
    url.searchParams.set("rel", "0");
    url.searchParams.set("iv_load_policy", "3");
    url.searchParams.set("disablekb", "0");
    url.searchParams.set("fs", "1");
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("origin", typeof window !== "undefined" ? window.location.origin : "https://afrovision.online");
    return url.toString();
  } catch {
    return null;
  }
}

/** Convert .srt text to WebVTT so it can be used in a <track> element */
function srtToVtt(srt: string): string {
  return "WEBVTT\n\n" + srt
    .replace(/\r\n/g, "\n")
    .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, "$1:$2:$3.$4")
    .trim();
}

export function ExternalStreamPlayer({
  currentChannel,
  availableChannels,
  onSelectChannel,
  channelName,
  channelLogoUrl,
  streamSourceMode,
  playbackUrl,
  streamStatus,
  schedule = [],
  serverTime = Date.now(),
  schedulerState = null,
  onRefreshUrl,
  contentRating = null,
  programStartTime,
  programEndTime,
  programDuration,
  programPosition,
  isLoop = false,
  onProgramEnd,
}: ExternalStreamPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);
  const subtitleTrackRef = useRef<HTMLTrackElement | null>(null);

  // Restore fullscreen after a channel-surfer navigation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldRestore = sessionStorage.getItem("av_restore_fullscreen");
    if (!shouldRestore) return;
    sessionStorage.removeItem("av_restore_fullscreen");
    const timer = setTimeout(() => {
      const el = containerRef.current;
      if (el && !document.fullscreenElement) {
        void el.requestFullscreen().catch(() => {});
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [activePlaybackUrl, setActivePlaybackUrl] = useState<string | null>(playbackUrl);
  const [httpFallbackTried, setHttpFallbackTried] = useState(false);
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 100;
    const saved = localStorage.getItem("av_player_volume");
    return saved !== null ? Number(saved) : 100;
  });
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stream metadata ────────────────────────────────────────────────────────
  const [meta, setMeta] = useState<StreamMeta>({ title: null, language: null, audioTracks: [], hasSubtitlesTracks: false });
  const [activeAudioTrack, setActiveAudioTrack] = useState<number | null>(null);
  const [showAudioMenu, setShowAudioMenu] = useState(false);

  // ── Subtitles ──────────────────────────────────────────────────────────────
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showSurfer, setShowSurfer] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [streamUnavailable, setStreamUnavailable] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([{ levelIndex: -1, label: "Auto" }]);
  const [activeQualityLevel, setActiveQualityLevel] = useState<number>(-1);
  const recoveringRef = useRef(false);
  const urlRefreshAttempted = useRef(false);
  const surferHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SURFER_AUTOHIDE_MS = 5000;

  const setRecovering = useCallback((next: boolean) => {
    recoveringRef.current = next;
    setIsRecovering(next);
  }, []);

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
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [subResults, setSubResults] = useState<SubtitleResult[]>([]);
  const [subSearching, setSubSearching] = useState(false);
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [activeSubUrl, setActiveSubUrl] = useState<string | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const runtimeMode = useMemo(() => inferMode(streamSourceMode, playbackUrl), [streamSourceMode, playbackUrl]);
  const schedulerMessage = useMemo(
    () => getSchedulerMessage(streamSourceMode, schedule, serverTime, schedulerState),
    [streamSourceMode, schedule, serverTime, schedulerState],
  );
  const isVideoRuntime = ["hls", "dash", "url"].includes(runtimeMode);
  const currentQualityLabel = useMemo(() => {
    if (runtimeMode !== "hls") return "Auto";
    if (activeQualityLevel < 0) return "Auto";
    return qualityOptions.find((q) => q.levelIndex === activeQualityLevel)?.label ?? "Auto";
  }, [runtimeMode, activeQualityLevel, qualityOptions]);

  // ── Native (upload) stream server-time sync ──────────────────────────────
  // For upload streams (runtimeMode === "url"), seek to the correct live
  // position using the backend-provided programPosition so all devices
  // see the same playback point. No periodic resync — the HLS pipeline
  // handles continuous playback correctly.
  const hasNativeSyncedRef = useRef(false);

  useEffect(() => {
    if (!programStartTime || isLoop || runtimeMode !== "url") return;
    const video = videoRef.current;
    if (!video) return;

    hasNativeSyncedRef.current = false;

    const onLoadedMetadata = () => {
      if (hasNativeSyncedRef.current) return;
      hasNativeSyncedRef.current = true;
      // Use backend-provided position (seconds) for one-time seek
      const seekPos = programPosition ?? 0;
      if (programDuration && programDuration > 0 && seekPos >= programDuration) {
        onProgramEnd?.();
        return;
      }
      if (seekPos > 0 && seekPos < (programDuration || Infinity)) {
        try { video.currentTime = seekPos; } catch {}
      }
    };

    const onTimeUpdate = () => {
      // Check for program end during playback
      if (!programEndTime) return;
      const elapsed = video.currentTime * 1000 + programStartTime;
      if (elapsed >= programEndTime) {
        onProgramEnd?.();
      }
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [programStartTime, programEndTime, programDuration, programPosition, isLoop, runtimeMode, onProgramEnd]);

  const youtubeEmbedUrl = useMemo(() => {
    if (!playbackUrl || runtimeMode !== "youtube") return null;
    return buildYouTubeEmbedUrl(playbackUrl);
  }, [runtimeMode, playbackUrl]);

  const clearPlaybackNoticeTimer = useCallback(() => {
    if (playbackNoticeTimer.current) {
      clearTimeout(playbackNoticeTimer.current);
      playbackNoticeTimer.current = null;
    }
  }, []);

  const clearPlaybackNotice = useCallback(() => {
    setPlaybackError(null);
    setRecovering(false);
    clearPlaybackNoticeTimer();
  }, [clearPlaybackNoticeTimer, setRecovering]);

  // Reset on URL change
  useEffect(() => {
    clearPlaybackNoticeTimer();
    setPlaybackError(null);
    setRecovering(false);
    setStreamUnavailable(false);
    setUnavailableReason(null);
    setActivePlaybackUrl(playbackUrl);
    setHttpFallbackTried(false);
    setMeta({ title: null, language: null, audioTracks: [], hasSubtitlesTracks: false });
    setActiveAudioTrack(null);
    setQualityOptions([{ levelIndex: -1, label: "Auto" }]);
    setActiveQualityLevel(-1);
    setActiveSubUrl(null);
    setSubtitlesEnabled(true);
    setSubResults([]);
    setSubStatus(null);
    urlRefreshAttempted.current = false;
  }, [playbackUrl, runtimeMode, setRecovering, retryToken, clearPlaybackNoticeTimer]);

  // Keep transient recovery notices informative but non-sticky.
  useEffect(() => {
    if (!playbackError || streamUnavailable) return;
    clearPlaybackNoticeTimer();
    playbackNoticeTimer.current = setTimeout(() => {
      setPlaybackError(null);
      setRecovering(false);
      playbackNoticeTimer.current = null;
    }, 4500);

    return () => {
      clearPlaybackNoticeTimer();
    };
  }, [playbackError, streamUnavailable, clearPlaybackNoticeTimer, setRecovering]);

  // HTTP fallback in local dev
  useEffect(() => {
    if (!activePlaybackUrl || runtimeMode !== "hls" || httpFallbackTried) return;
    if (!activePlaybackUrl.startsWith("https://")) return;
    if (process.env.NODE_ENV === "production") return;
    const fallbackUrl = activePlaybackUrl.replace("https://", "http://");
    setActivePlaybackUrl(fallbackUrl);
    setHttpFallbackTried(true);
  }, [activePlaybackUrl, runtimeMode, httpFallbackTried]);

  // HLS / DASH / plain boot
  useEffect(() => {
    if (!activePlaybackUrl || !videoRef.current) return;
    const video = videoRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dashInstance: any = null;
    let cancelled = false;
    let networkRecoveries = 0;
    let mediaRecoveries = 0;

    let bufferNoticeTimer: ReturnType<typeof setTimeout> | null = null;

    const handleWaiting = () => {
      if (cancelled) return;
      // Don't immediately show a scary "network is unstable" message —
      // normal buffering (seek, startup, rebuffer) happens frequently.
      // Only show after 3s of sustained buffering.
      if (bufferNoticeTimer) clearTimeout(bufferNoticeTimer);
      bufferNoticeTimer = setTimeout(() => {
        if (cancelled) return;
        if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
          setRecovering(true);
          setPlaybackError("Buffering... network is slow.");
        }
      }, 3000);
    };

    const handlePlaying = () => {
      if (cancelled) return;
      if (bufferNoticeTimer) { clearTimeout(bufferNoticeTimer); bufferNoticeTimer = null; }
      clearPlaybackNotice();
    };

    const handleProgress = () => {
      if (cancelled) return;
      if (bufferNoticeTimer) { clearTimeout(bufferNoticeTimer); bufferNoticeTimer = null; }
      if (!recoveringRef.current) return;
      if (video.paused) return;
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
      clearPlaybackNotice();
    };

    const handleStalled = () => {
      if (cancelled) return;
      const snapshotTime = video.currentTime;
      // Delay showing "stalled" message — browser often recovers on its own.
      if (bufferNoticeTimer) clearTimeout(bufferNoticeTimer);
      bufferNoticeTimer = setTimeout(() => {
        if (cancelled) return;
        if (Math.abs(video.currentTime - snapshotTime) < 0.05) {
          setRecovering(true);
          setPlaybackError("Playback stalled. Attempting to recover...");
          try {
            video.currentTime = snapshotTime + 0.1;
          } catch {
            // ignore seek errors on live windows
          }
          void video.play().catch(() => undefined);
        }
      }, 3000);
    };

    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleProgress);
    video.addEventListener("timeupdate", handleProgress);
    video.addEventListener("stalled", handleStalled);

    const boot = async () => {
      try {
        if (runtimeMode === "hls") {
          const canPlayNative = video.canPlayType("application/vnd.apple.mpegurl") !== "";
          if (canPlayNative) {
            video.src = activePlaybackUrl;
            await video.play().catch(() => undefined);
            return;
          }

          const hlsMod = await import("hls.js");
          const HlsCtor = hlsMod.default;
          if (cancelled) return;
          if (!HlsCtor.isSupported()) {
            setPlaybackError("This browser cannot play HLS streams.");
            return;
          }

          // Tuned for resilience on unstable/high-latency networks.
          // Key strategy:
          //  - Start at lowest quality (startLevel: 0) so first frame appears fast,
          //    then ABR scales up as bandwidth is measured.
          //  - Large buffer (120s max) so the player can ride out congestion spikes.
          //  - Conservative up-switch, aggressive down-switch for smooth ABR.
          //  - Generous retries because segments now redirect to GCS directly, and
          //    GCS may occasionally return 5xx under load.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hls: any = new HlsCtor({
            enableWorker: true,
            lowLatencyMode: false,
            autoStartLoad: true,
            startLevel: 0,
            testBandwidth: true,
            capLevelToPlayerSize: true,
            maxBufferLength: 90,
            maxMaxBufferLength: 120,
            backBufferLength: 60,
            highBufferWatchdogPeriod: 2,
            maxBufferHole: 0.5,
            nudgeOffset: 0.1,
            nudgeMaxRetry: 12,
            liveSyncDurationCount: 4,
            liveMaxLatencyDurationCount: 12,
            maxLiveSyncPlaybackRate: 1.1,
            manifestLoadingTimeOut: 20000,
            manifestLoadingMaxRetry: 8,
            manifestLoadingRetryDelay: 1000,
            levelLoadingTimeOut: 20000,
            levelLoadingMaxRetry: 8,
            levelLoadingRetryDelay: 1000,
            fragLoadingTimeOut: 30000,
            fragLoadingMaxRetry: 10,
            fragLoadingRetryDelay: 1000,
            fragLoadingMaxRetryTimeout: 10000,
            abrEwmaFastLive: 3.0,
            abrEwmaSlowLive: 9.0,
            abrEwmaFastVoD: 3.0,
            abrEwmaSlowVoD: 9.0,
            abrBandWidthFactor: 0.75,
            abrBandWidthUpFactor: 0.4,
            abrMaxWithRealBitrate: true,
          });
          hlsRef.current = hls;

          hls.on(
            HlsCtor.Events.ERROR,
            (
              _e: unknown,
              data: { fatal?: boolean; details?: string; type?: string },
            ) => {
              if (!data?.fatal) return;

              if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
                networkRecoveries += 1;
                setRecovering(true);
                setPlaybackError(mapHlsErrorMessage(data.details, data.type));
                try {
                  hls.startLoad();
                  if (typeof hls.currentLevel === "number" && hls.currentLevel > 0) {
                    hls.nextLevel = Math.max(0, hls.currentLevel - 1);
                  }
                } catch {
                  // ignore and let retry loop continue
                }

                if (networkRecoveries > 6) {
                  setRecovering(false);
                  setPlaybackError("Connection to this channel is unstable. Tap retry to reconnect.");
                  setStreamUnavailable(true);
                  setUnavailableReason("This channel cannot be reached right now. Please retry in a moment.");
                }
                return;
              }

              if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
                mediaRecoveries += 1;
                setRecovering(true);
                setPlaybackError(mapHlsErrorMessage(data.details, data.type));
                try {
                  hls.recoverMediaError();
                } catch {
                  // ignore and show generic error below on repeated failures
                }

                if (mediaRecoveries > 3) {
                  setRecovering(false);
                  setPlaybackError("Playback decoding failed on this device.");
                  setStreamUnavailable(true);
                  setUnavailableReason("This stream is not decoding correctly on your device right now.");
                }
                return;
              }

              setRecovering(false);
              setPlaybackError(mapHlsErrorMessage(data.details, data.type));

              const detail = (data.details ?? "").toLowerCase();
              if (detail.includes("manifestloaderror") || detail.includes("manifestloadtimeout") || detail.includes("manifestparsingerror")) {
                setStreamUnavailable(true);
                setUnavailableReason("This channel stream is temporarily unavailable.");
              }
            },
          );

          hls.on(HlsCtor.Events.LEVEL_SWITCHED, () => {
            if (!recoveringRef.current) return;
            setRecovering(false);
            setPlaybackError(null);
          });

          // Extract metadata once manifest is parsed
          hls.on(HlsCtor.Events.MANIFEST_PARSED, (_e: unknown, data: { audioTracks?: { id: number; name: string; lang: string }[]; subtitleTracks?: { id: number; name: string; lang: string }[] }) => {
            if (cancelled) return;
            setRecovering(false);
            setPlaybackError(null);
            setStreamUnavailable(false);
            setUnavailableReason(null);
            const audioTracks: AudioTrack[] = (data.audioTracks || []).map((t) => ({
              id: t.id,
              name: t.name || t.lang || `Track ${t.id}`,
              lang: t.lang || "",
            }));
            const hasSubtitlesTracks = (data.subtitleTracks || []).length > 0;
            const firstLang = audioTracks[0]?.lang || null;
            setMeta((prev) => ({ ...prev, audioTracks, hasSubtitlesTracks, language: firstLang }));
            if (audioTracks.length > 0) setActiveAudioTrack(audioTracks[0].id);

            const levels: QualityOption[] = [{ levelIndex: -1, label: "Auto" }];
            if (Array.isArray(hls.levels)) {
              hls.levels.forEach((level: { height?: number; bitrate?: number }, idx: number) => {
                const byHeight = typeof level.height === "number" && level.height > 0
                  ? `${level.height}p`
                  : null;
                const byBitrate = typeof level.bitrate === "number" && level.bitrate > 0
                  ? `${Math.round(level.bitrate / 1000)} kbps`
                  : `Level ${idx + 1}`;
                levels.push({ levelIndex: idx, label: byHeight ?? byBitrate });
              });
            }
            setQualityOptions(levels);
            setActiveQualityLevel(-1);

            // Auto-trigger subtitle search if audio language detected and not English
            if (firstLang && firstLang !== "en" && firstLang !== "eng") {
              const guessTitle = channelName.replace(/\d+|hls|stream|live|channel/gi, "").trim();
              if (guessTitle.length > 2) {
                triggerAutoSubSearch(guessTitle, "en");
              }
            }
          });

          // Extract program title from ID3 tags / program metadata if available
          hls.on(HlsCtor.Events.FRAG_LOADED, (_e: unknown, data: { frag?: { programDateTime?: string; title?: string } }) => {
            if (cancelled) return;
            const title = data?.frag?.title;
            if (title && !meta.title) {
              setMeta((prev) => ({ ...prev, title }));
            }
          });

          hls.loadSource(activePlaybackUrl);
          hls.attachMedia(video);
          return;
        }

        if (runtimeMode === "dash") {
          const dashMod = await import("dashjs");
          if (cancelled) return;
          const mediaPlayerFactory = dashMod.MediaPlayer;
          if (!mediaPlayerFactory) { setPlaybackError("DASH engine failed to initialize."); return; }
          dashInstance = mediaPlayerFactory().create();
          dashInstance.updateSettings({
            streaming: {
              abr: {
                autoSwitchBitrate: { video: true },
                initialBitrate: { video: 800 },
              },
              buffer: {
                stableBufferTime: 12,
                bufferTimeAtTopQuality: 20,
                bufferTimeAtTopQualityLongForm: 30,
                fastSwitchEnabled: true,
              },
            },
          });
          dashInstance.on("error", () => {
            if (cancelled) return;
            setRecovering(true);
            setPlaybackError("DASH playback error. Retrying...");
            if (!recoveringRef.current) {
              setStreamUnavailable(true);
              setUnavailableReason("This channel stream is temporarily unavailable.");
            }
          });
          dashInstance.initialize(video, activePlaybackUrl, true);
          return;
        }

        if (runtimeMode === "url") {
          video.src = activePlaybackUrl;
          // Enable native looping for loop-mode programs (repeating content)
          if (isLoop) {
            video.loop = true;
          }
          await video.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) setPlaybackError("Stream failed to load.");
      }
    };

    if (runtimeMode !== "youtube") void boot();

    return () => {
      cancelled = true;
      if (bufferNoticeTimer) { clearTimeout(bufferNoticeTimer); bufferNoticeTimer = null; }
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleProgress);
      video.removeEventListener("timeupdate", handleProgress);
      video.removeEventListener("stalled", handleStalled);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (dashInstance) dashInstance.reset();
      video.removeAttribute("src");
      video.load();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeMode, activePlaybackUrl, setRecovering, clearPlaybackNotice]);

  // Volume sync + persistence
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = Math.max(0, Math.min(1, volume / 100));
    videoRef.current.muted = volume === 0;
    try { localStorage.setItem("av_player_volume", String(volume)); } catch {}
  }, [volume]);

  // Detect embedded subtitle tracks on native uploads and apply subtitle visibility.
  useEffect(() => {
    if (!videoRef.current || !isVideoRuntime) return;
    const video = videoRef.current;

    const syncEmbeddedTracks = () => {
      const tracks = video.textTracks;
      const hasEmbeddedTracks = (tracks?.length ?? 0) > 0;
      if (hasEmbeddedTracks) {
        setMeta((prev) => ({ ...prev, hasSubtitlesTracks: true }));
      }
      for (let i = 0; i < tracks.length; i += 1) {
        tracks[i].mode = subtitlesEnabled ? "showing" : "hidden";
      }
    };

    video.addEventListener("loadedmetadata", syncEmbeddedTracks);
    window.setTimeout(syncEmbeddedTracks, 0);

    return () => {
      video.removeEventListener("loadedmetadata", syncEmbeddedTracks);
    };
  }, [isVideoRuntime, subtitlesEnabled, activePlaybackUrl]);

  // Audio track switch via hls.js
  useEffect(() => {
    if (activeAudioTrack === null || !hlsRef.current) return;
    try { hlsRef.current.audioTrack = activeAudioTrack; } catch { /* ignore */ }
  }, [activeAudioTrack]);

  // Quality selector (HLS): -1 = Auto, >=0 = specific level
  useEffect(() => {
    if (!hlsRef.current || runtimeMode !== "hls") return;
    try {
      if (activeQualityLevel < 0) {
        // Keep ABR in fully automatic mode by default and on explicit Auto selection.
        hlsRef.current.currentLevel = -1;
        hlsRef.current.nextLevel = -1;
        if (typeof hlsRef.current.loadLevel === "number") {
          hlsRef.current.loadLevel = -1;
        }
      } else {
        hlsRef.current.currentLevel = activeQualityLevel;
        hlsRef.current.nextLevel = activeQualityLevel;
      }
    } catch {
      // ignore quality switch errors
    }
  }, [activeQualityLevel, runtimeMode]);

  // Subtitle track injection into video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Remove old track
    if (subtitleTrackRef.current) {
      try { video.removeChild(subtitleTrackRef.current); } catch { /* already gone */ }
      subtitleTrackRef.current = null;
    }

    if (!activeSubUrl) return;

    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = "English";
    track.srclang = "en";
    track.src = activeSubUrl;
    track.default = true;
    video.appendChild(track);
    subtitleTrackRef.current = track;

    // Activate text track
    const activate = () => {
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = subtitlesEnabled ? "showing" : "hidden";
      }
    };
    track.addEventListener("load", activate);
    return () => track.removeEventListener("load", activate);
  }, [activeSubUrl, subtitlesEnabled]);

  // Toggle subtitle visibility when subtitlesEnabled changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = subtitlesEnabled ? "showing" : "hidden";
    }
  }, [subtitlesEnabled]);

  // Controls auto-hide
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    void el.requestFullscreen();
  }, []);

  // Auto subtitle search helper
  const triggerAutoSubSearch = useCallback(async (query: string, lang: string) => {
    setSubStatus(`Auto-searching English subtitles for "${query}"…`);
    const res = await searchSubtitlesApi(query, lang);
    if (!res.ok || !("subtitles" in res.data) || res.data.subtitles.length === 0) {
      setSubStatus("No subtitles found automatically.");
      return;
    }
    const best = res.data.subtitles[0];
    const firstFile = best.files?.[0];
    if (!firstFile?.file_id) {
      setSubStatus("No downloadable subtitle file found.");
      return;
    }
    await loadSubtitleFile(firstFile.file_id, best.title);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubtitleFile = useCallback(async (fileId: number, title: string) => {
    setSubStatus(`Loading subtitle: ${title}…`);
    const dlRes = await downloadSubtitleApi(fileId);
    if (!dlRes.ok || !("link" in dlRes.data) || !dlRes.data.link) {
      setSubStatus("Failed to get subtitle download link.");
      return;
    }
    const proxiedUrl = getSubtitleProxyUrl(dlRes.data.link);
    // Fetch the raw subtitle, convert srt→vtt if needed, create blob URL
    try {
      const resp = await fetch(proxiedUrl);
      const text = await resp.text();
      const isVtt = text.trimStart().startsWith("WEBVTT");
      const vttText = isVtt ? text : srtToVtt(text);
      const blob = new Blob([vttText], { type: "text/vtt" });
      const blobUrl = URL.createObjectURL(blob);
      setActiveSubUrl(blobUrl);
      setSubtitlesEnabled(true);
      setSubStatus(`Subtitles loaded: ${dlRes.data.file_name ?? title}`);
      setShowSubMenu(false);
    } catch {
      setSubStatus("Failed to load subtitle file.");
    }
  }, []);

  const handleSubSearch = useCallback(async () => {
    if (!subSearchQuery.trim()) return;
    setSubSearching(true);
    setSubStatus(null);
    const res = await searchSubtitlesApi(subSearchQuery.trim(), "en");
    setSubSearching(false);
    if (!res.ok || !("subtitles" in res.data)) {
      setSubStatus("Search failed.");
      return;
    }
    setSubResults(res.data.subtitles);
    if (res.data.subtitles.length === 0) setSubStatus("No results found.");
  }, [subSearchQuery]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!activePlaybackUrl) {
    if (schedulerMessage) {
      const { type, startTime, title } = schedulerMessage;
      if (type === "starting_soon") {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-semibold text-av-white">Starting soon</p>
            <p className="text-xs text-av-light-orange">
              {title ? `"${title}"` : "Schedule is set"} — stream begins at {startTime ? formatStartingSoonTime(startTime) : "the scheduled time"}.
            </p>
          </div>
        );
      }
      if (type === "program_has_no_video") {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-semibold text-av-white">We&apos;ll be right back</p>
            <p className="text-xs text-av-light-orange">Preparing your next program — stay tuned.</p>
          </div>
        );
      }
      if (type === "offline") {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-semibold text-av-white">We&apos;ll be right back</p>
            <p className="text-xs text-av-light-orange">Brief intermission — stay tuned.</p>
          </div>
        );
      }
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-semibold text-av-white">We&apos;ll be right back</p>
        <p className="text-xs text-av-light-orange">Brief intermission — stay tuned.</p>
      </div>
    );
  }

  if (runtimeMode === "unknown") {
    if (schedulerMessage?.type === "program_has_no_video") {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-semibold text-av-white">We&apos;ll be right back</p>
          <p className="text-xs text-av-light-orange">Preparing your next program — stay tuned.</p>
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-semibold text-av-white">
          {playbackError ?? (streamStatus === "offline" ? "We&apos;ll be right back" : "We&apos;ll be right back")}
        </p>
        <p className="text-xs text-av-light-orange">Brief intermission — stay tuned.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => setShowControls(false)}
      onClick={() => { setShowAudioMenu(false); setShowSubMenu(false); setShowQualityMenu(false); }}
    >
      {/* ── Media ── */}
      {runtimeMode === "youtube" && youtubeEmbedUrl ? (
        <iframe
          src={youtubeEmbedUrl}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          title={channelName}
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          controls={false}
          className="absolute inset-0 h-full w-full object-contain"
          onError={() => {
            // Attempt one URL refresh before showing a hard error —
            // the signed URL may have expired or the network blipped.
            if (!urlRefreshAttempted.current && onRefreshUrl) {
              urlRefreshAttempted.current = true;
              setRecovering(true);
              setPlaybackError("Refreshing stream...");
              onRefreshUrl();
              return;
            }
            setPlaybackError("Stream failed to play on this device.");
          }}
        />
      )}

      {/* ── Channel logo — top right ── */}
      {channelLogoUrl && (
        <div className="absolute right-3 top-3 rounded-xl border border-white/20 bg-black/45 p-1.5 backdrop-blur-sm pointer-events-none">
          <Image
            src={resolveWebsiteMediaUrl(channelLogoUrl)}
            alt={channelName}
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 rounded-lg object-cover"
          />
        </div>
      )}

      {/* ── Content rating badge — below logo ── */}
      {contentRating?.age_classification && (
        <div className="absolute right-3 top-16 flex flex-col items-end gap-1 pointer-events-none">
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm"
            style={{
              background: getClassificationMeta(contentRating.age_classification).bg,
              border: getClassificationMeta(contentRating.age_classification).border,
              color: getClassificationMeta(contentRating.age_classification).color,
            }}
          >
            {getClassificationMeta(contentRating.age_classification).label}
          </span>
          {getContentLabels(contentRating).length > 0 && (
            <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white/80 backdrop-blur-sm tracking-wide">
              {getContentLabels(contentRating).join(" · ")}
            </span>
          )}
        </div>
      )}

      {/* Channel surfer now anchored inside controls bar */}

      {/* ── Meta badge — top left (stream title / language) ── */}
      {(meta.title || meta.language) && (
        <div className="absolute left-3 top-3 flex flex-col gap-1 pointer-events-none">
          {meta.title && (
            <span className="rounded-lg bg-black/65 px-2 py-1 text-[11px] font-semibold text-av-white backdrop-blur-sm max-w-[220px] truncate">
              🎬 {meta.title}
            </span>
          )}
          {meta.language && (
            <span className="rounded-lg bg-black/55 px-2 py-1 text-[10px] text-av-light-orange backdrop-blur-sm uppercase tracking-wide">
              🌐 {meta.language}
            </span>
          )}
        </div>
      )}

      {/* ── Controls overlay — bottom bar ── */}
      {runtimeMode !== "youtube" && (
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pb-3 pt-8 px-3 flex items-end justify-between gap-2 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {/* Volume — bottom left */}
        {isVideoRuntime && (
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/60 px-2 py-1.5 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setVolume((v) => (v === 0 ? 80 : 0))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              aria-label={volume === 0 ? "Unmute" : "Mute"}
            >
              {volume === 0 ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.21.05-.43.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              ) : volume < 50 ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-3.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 accent-av-orange"
              aria-label="Volume"
            />
          </div>
        )}

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

        {/* Right side controls */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>

          {/* Channels list toggle (TV icon) */}
          <button
            onClick={() => { setShowAudioMenu(false); setShowSubMenu(false); setShowQualityMenu(false); toggleSurfer(); }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-av-light-orange backdrop-blur-sm hover:bg-black/80 transition-colors"
            aria-label="Toggle channel surfer"
            title="Channels"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 17H3V5h18v12zM19 7H5v8h14V7zm-8 10h2l1 2h-4l1-2z" />
            </svg>
          </button>

          {/* Quality selector with Auto mode; HLS exposes additional fixed levels */}
          {isVideoRuntime && qualityOptions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setShowQualityMenu((v) => !v); setShowAudioMenu(false); setShowSubMenu(false); }}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-black/60 px-3 text-[11px] font-semibold text-av-light-orange backdrop-blur-sm hover:bg-black/80"
                aria-label="Video quality"
              >
                Q {currentQualityLabel}
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-11 right-0 z-50 w-40 rounded-xl border border-white/15 bg-[#050A30]/95 p-1.5 backdrop-blur-md shadow-2xl">
                  <p className="px-2 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-av-light-orange/60">Quality</p>
                  {qualityOptions.map((option) => {
                    const isActive = option.levelIndex < 0 ? activeQualityLevel < 0 : activeQualityLevel === option.levelIndex;
                    return (
                      <button
                        key={`${option.levelIndex}-${option.label}`}
                        onClick={() => { setActiveQualityLevel(option.levelIndex); setShowQualityMenu(false); }}
                        className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${isActive ? "bg-av-orange/20 text-av-orange font-semibold" : "text-av-white hover:bg-white/10"}`}
                      >
                        {option.label}
                        {isActive && " ✓"}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Audio track switcher — only if multiple tracks */}
          {meta.audioTracks.length > 1 && (
            <div className="relative">
              <button
                onClick={() => { setShowAudioMenu((v) => !v); setShowSubMenu(false); setShowQualityMenu(false); }}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-black/60 px-3 text-[11px] font-semibold text-av-light-orange backdrop-blur-sm hover:bg-black/80"
                aria-label="Switch audio track"
              >
                🎧 Audio
              </button>
              {showAudioMenu && (
                <div className="absolute bottom-11 right-0 z-50 w-44 rounded-xl border border-white/15 bg-[#050A30]/95 p-1.5 backdrop-blur-md shadow-2xl">
                  <p className="px-2 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-av-light-orange/60">Audio Tracks</p>
                  {meta.audioTracks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setActiveAudioTrack(t.id); setShowAudioMenu(false); }}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${activeAudioTrack === t.id ? "bg-av-orange/20 text-av-orange font-semibold" : "text-av-white hover:bg-white/10"}`}
                    >
                      {t.name}{t.lang ? ` (${t.lang})` : ""}
                      {activeAudioTrack === t.id && " ✓"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subtitle button */}
          {isVideoRuntime && (
            <div className="relative">
              <button
                onClick={() => { setShowSubMenu((v) => !v); setShowAudioMenu(false); setShowQualityMenu(false); }}
                className={`flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-black/60 px-3 text-[11px] font-semibold backdrop-blur-sm hover:bg-black/80 ${activeSubUrl ? "text-av-orange border-av-orange/30" : "text-av-light-orange"}`}
                aria-label="Subtitles"
              >
                CC{activeSubUrl ? " ✓" : ""}
              </button>

              {showSubMenu && (
                <div
                  className="absolute bottom-11 right-0 z-50 w-72 rounded-xl border border-white/15 bg-[#050A30]/95 p-3 backdrop-blur-md shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-av-light-orange/60">Subtitles</p>

                  <button
                    onClick={() => {
                      setSubtitlesEnabled(false);
                      setActiveSubUrl(null);
                      setSubStatus("Subtitles turned off.");
                    }}
                    className={`mb-2 w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${!subtitlesEnabled || !activeSubUrl ? "bg-white/10 text-av-light-orange font-semibold" : "text-av-white hover:bg-white/10"}`}
                  >
                    Off
                  </button>

                  {activeSubUrl && (
                    <div className="mb-2 flex items-center justify-between rounded-lg bg-av-orange/10 px-3 py-1.5">
                      <span className="text-[11px] text-av-orange font-semibold">Subtitles active</span>
                      <button
                        onClick={() => setSubtitlesEnabled((v) => !v)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${subtitlesEnabled ? "bg-av-orange text-av-dark-blue" : "bg-white/10 text-av-light-orange"}`}
                      >
                        {subtitlesEnabled ? "ON" : "OFF"}
                      </button>
                    </div>
                  )}

                  {/* Search bar */}
                  <div className="flex gap-1.5 mb-2">
                    <input
                      value={subSearchQuery}
                      onChange={(e) => setSubSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubSearch()}
                      placeholder="Search by movie title…"
                      className="flex-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-av-white placeholder-white/30 outline-none focus:ring-1 focus:ring-av-orange"
                    />
                    <button
                      onClick={handleSubSearch}
                      disabled={subSearching}
                      className="rounded-lg bg-av-orange px-3 py-1.5 text-[11px] font-bold text-av-dark-blue disabled:opacity-50"
                    >
                      {subSearching ? "…" : "Go"}
                    </button>
                  </div>

                  {subStatus && <p className="mb-2 text-[10px] text-av-light-orange">{subStatus}</p>}

                  {/* Results */}
                  {subResults.length > 0 && (
                    <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                      {subResults.map((r) => {
                        const file = r.files?.[0];
                        return file ? (
                          <button
                            key={r.id}
                            onClick={() => loadSubtitleFile(file.file_id, r.title)}
                            className="w-full text-left rounded-lg px-2.5 py-2 text-xs text-av-white hover:bg-white/10 transition-colors"
                          >
                            <span className="block font-semibold truncate">{r.title}</span>
                            <span className="text-av-light-orange text-[10px]">{r.year ?? ""} · {r.language.toUpperCase()} · {r.download_count?.toLocaleString()} downloads</span>
                          </button>
                        ) : null;
                      })}
                    </div>
                  )}

                  {activeSubUrl && (
                    <button
                      onClick={() => { setActiveSubUrl(null); setSubStatus(null); setSubResults([]); setShowSubMenu(false); }}
                      className="mt-2 w-full rounded-lg border border-white/10 py-1.5 text-[10px] text-av-light-orange hover:border-av-error/50 hover:text-av-error transition-colors"
                    >
                      Remove subtitles
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fullscreen — bottom right */}
          <button
            onClick={toggleFullscreen}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
            aria-label="Toggle fullscreen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
        </div>
      </div>
      )}

      {/* ── Fatal error banner ── */}
      {playbackError && isVideoRuntime && !streamUnavailable && (
        <div className="absolute inset-x-4 bottom-20 rounded-xl border border-av-input-border/30 bg-black/85 px-3 py-2 text-xs text-av-light-orange backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate">{isRecovering ? "⟳" : "⚠"} {playbackError}</span>
            {!isRecovering && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearPlaybackNotice();
                  setRecovering(true);
                  setStreamUnavailable(false);
                  setUnavailableReason(null);
                  setRetryToken((v) => v + 1);
                }}
                className="shrink-0 rounded-md border border-av-orange/40 bg-av-orange/20 px-2 py-1 text-[10px] font-semibold text-av-orange hover:bg-av-orange/30"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Full unavailable fallback ── */}
      {streamUnavailable && isVideoRuntime && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-av-white">Channel Temporarily Unavailable</p>
          <p className="max-w-md text-xs text-av-light-orange">
            {unavailableReason ?? "The stream is currently unreachable. Please try again shortly."}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStreamUnavailable(false);
              setUnavailableReason(null);
              setPlaybackError(null);
              setRecovering(true);
              setRetryToken((v) => v + 1);
            }}
            className="mt-1 rounded-md border border-av-orange/40 bg-av-orange/20 px-3 py-1.5 text-xs font-semibold text-av-orange hover:bg-av-orange/30"
          >
            Retry Channel
          </button>
        </div>
      )}
    </div>
  );
}

