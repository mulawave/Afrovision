"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  type ChannelSeriesDetail,
  type ChannelSeason,
  type ChannelSeriesEpisode,
  getSeriesDetailApi,
  recordSeriesEpisodeViewApi,
} from "@/lib/api";
import { HlsPlayer } from "@/components/HlsPlayer";
import { loadProgress, saveProgress, clearProgress, shouldResume } from "@/lib/watchProgress";
import { DownloadButton } from "@/components/DownloadButton";
import { getOfflineVideoUrl, type DownloadMeta } from "@/lib/downloadManager";
import { isDownloaded } from "@/lib/offlineStorage";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
}

function flattenEpisodes(series: ChannelSeriesDetail | null): { season: ChannelSeason; episode: ChannelSeriesEpisode }[] {
  if (!series) return [];
  const result: { season: ChannelSeason; episode: ChannelSeriesEpisode }[] = [];
  const sortedSeasons = [...(series.seasons || [])].sort((a, b) => a.season_number - b.season_number);
  for (const season of sortedSeasons) {
    const episodes = [...(season.episodes || [])].sort((a, b) => a.episode_number - b.episode_number);
    for (const episode of episodes) {
      result.push({ season, episode });
    }
  }
  return result;
}

export default function SeriesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [series, setSeries] = useState<ChannelSeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [upNextVisible, setUpNextVisible] = useState(false);
  const [upNextCountdown, setUpNextCountdown] = useState(5);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const upNextTimer = useRef<NodeJS.Timeout | null>(null);
  const recordedEpisodes = useRef<Set<string>>(new Set());
  const pauseAtEnd = useRef(false);
  const lastSaveRef = useRef(0);
  const resumeAttemptedRef = useRef<string | null>(null);
  const [offlineUrl, setOfflineUrl] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const loadSeries = async () => {
    setLoading(true);
    setError(null);
    const res = await getSeriesDetailApi(id);
    if (res.ok && "data" in res.data && res.data.data.series) {
      const s = res.data.data.series;
      setSeries(s);
      const seasons = s.seasons || [];
      if (seasons.length > 0) {
        const firstSeason = [...seasons].sort((a, b) => a.season_number - b.season_number)[0];
        setActiveSeasonId(firstSeason.id);
        const episodes = firstSeason.episodes || [];
        if (episodes.length > 0) {
          const firstEpisode = [...episodes].sort((a, b) => a.episode_number - b.episode_number)[0];
          setActiveEpisodeId(firstEpisode.id);
        }
      }
    } else {
      setError("Series not found or unavailable.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadSeries();
  }, [id]);

  // Check if current episode is available offline
  useEffect(() => {
    if (!activeEpisodeId) {
      setOfflineUrl(null);
      setIsOffline(false);
      return;
    }
    let urlToRevoke: string | null = null;
    void (async () => {
      const downloaded = await isDownloaded("episode", activeEpisodeId);
      if (downloaded) {
        const url = await getOfflineVideoUrl("episode", activeEpisodeId);
        if (url) {
          urlToRevoke = url;
          setOfflineUrl(url);
          setIsOffline(true);
          return;
        }
      }
      setOfflineUrl(null);
      setIsOffline(false);
    })();
    return () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [activeEpisodeId]);

  const allEpisodes = flattenEpisodes(series);
  const currentIndex = allEpisodes.findIndex((e) => e.episode.id === activeEpisodeId);
  const current = allEpisodes[currentIndex];
  const next = allEpisodes[currentIndex + 1];
  const currentEpisodeIsEmbed = current?.episode.video_source_mode === "embed";
  const currentEpisodeIsHls = current?.episode.video_source_mode === "hls";
  const currentMediaUrl = current
    ? currentEpisodeIsEmbed
      ? current.episode.embed_url
      : currentEpisodeIsHls
        ? current.episode.hls_url
        : current.episode.video_source_mode === "external_url"
          ? current.episode.external_url
          : current.episode.video_url
    : null;

  // Use offline URL if available for the current episode
  const effectiveMediaUrl = isOffline && offlineUrl ? offlineUrl : currentMediaUrl;

  const episodeDownloadMeta: DownloadMeta | null = current && !currentEpisodeIsEmbed && activeEpisodeId ? {
    mediaType: "episode",
    mediaId: activeEpisodeId,
    title: current.episode.title,
    poster_url: series?.cover_url,
    video_source_mode: current.episode.video_source_mode || "hosted",
    hls_url: current.episode.hls_url,
    hosted_url: current.episode.video_url,
    external_url: current.episode.external_url,
    duration: current.episode.duration || 0,
    series_id: id,
    episode_number: current.episode.episode_number,
    season_number: current.season.season_number,
  } : null;

  const playEpisode = (episodeId: string, seasonId?: string) => {
    setUpNextVisible(false);
    setHasReachedEnd(false);
    pauseAtEnd.current = false;
    if (seasonId) setActiveSeasonId(seasonId);
    setActiveEpisodeId(episodeId);
    if (videoRef.current) {
      videoRef.current.load();
      void videoRef.current.play();
    }
  };

  const recordView = (episodeId: string) => {
    if (recordedEpisodes.current.has(episodeId)) return;
    recordedEpisodes.current.add(episodeId);
    void recordSeriesEpisodeViewApi(id, episodeId);
  };

  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    if (!duration || duration <= 0) return;
    if (!activeEpisodeId) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 10000) return;
    lastSaveRef.current = now;
    void saveProgress("episode", activeEpisodeId, currentTime, duration);
  }, [activeEpisodeId]);

  const handlePause = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration > 0 && activeEpisodeId) {
      void saveProgress("episode", activeEpisodeId, video.currentTime, video.duration);
    }
  }, [activeEpisodeId]);

  const handleLoadedMetadata = useCallback(async (duration: number) => {
    if (!activeEpisodeId) return;
    if (resumeAttemptedRef.current === activeEpisodeId) return;
    resumeAttemptedRef.current = activeEpisodeId;
    if (!duration || duration <= 0) return;
    const progress = await loadProgress("episode", activeEpisodeId);
    if (progress && shouldResume(progress.position, progress.duration)) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = progress.position;
      }
    }
  }, [activeEpisodeId]);

  const handleSeeked = useCallback(() => {
    const video = videoRef.current;
    if (video && video.currentTime < 5 && activeEpisodeId) {
      clearProgress("episode", activeEpisodeId);
    }
  }, [activeEpisodeId]);

  const handleEnded = () => {
    setHasReachedEnd(true);
    if (!autoplayNext || !next) return;

    setUpNextCountdown(5);
    setUpNextVisible(true);

    upNextTimer.current = setInterval(() => {
      setUpNextCountdown((c) => {
        if (c <= 1) {
          if (upNextTimer.current) clearInterval(upNextTimer.current);
          if (next) playEpisode(next.episode.id, next.season.id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const cancelUpNext = () => {
    if (upNextTimer.current) {
      clearInterval(upNextTimer.current);
      upNextTimer.current = null;
    }
    setUpNextVisible(false);
    setHasReachedEnd(false);
    pauseAtEnd.current = true;
  };

  useEffect(() => {
    return () => {
      if (upNextTimer.current) clearInterval(upNextTimer.current);
      const video = videoRef.current;
      if (video && video.duration > 0 && activeEpisodeId) {
        void saveProgress("episode", activeEpisodeId, video.currentTime, video.duration);
      }
    };
  }, []);

  useEffect(() => {
    if (activeEpisodeId && videoRef.current && !upNextVisible) {
      // When the active episode changes (including autoplay), reset end state.
      setHasReachedEnd(false);
    }
  }, [activeEpisodeId, upNextVisible]);

  if (loading) {
    return (
      <div className="pt-28 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="pt-28 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-3xl">📺</p>
        <p className="text-av-light-orange">{error || "Series not found"}</p>
        <button
          onClick={() => router.push("/series")}
          className="px-5 py-2 rounded-lg bg-av-orange text-av-dark-blue font-semibold text-sm hover:bg-av-light-orange transition-colors"
        >
          Browse Series
        </button>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl overflow-hidden bg-black aspect-video border border-av-input-border/20 shadow-2xl shadow-black/40 relative">
              {effectiveMediaUrl ? (
                currentEpisodeIsEmbed ? (
                  <iframe
                    src={effectiveMediaUrl}
                    onLoad={() => activeEpisodeId && recordView(activeEpisodeId)}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : currentEpisodeIsHls ? (
                  <HlsPlayer
                    src={effectiveMediaUrl}
                    onPlay={() => activeEpisodeId && recordView(activeEpisodeId)}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleEnded}
                    onPause={handlePause}
                    onSeeked={handleSeeked}
                    className="w-full h-full"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={effectiveMediaUrl}
                    controls
                    className="w-full h-full"
                    onPlay={() => activeEpisodeId && recordView(activeEpisodeId)}
                    onTimeUpdate={(e) => {
                      const v = e.currentTarget;
                      handleTimeUpdate(v.currentTime, v.duration);
                    }}
                    onLoadedMetadata={(e) => {
                      void handleLoadedMetadata(e.currentTarget.duration);
                    }}
                    onPause={handlePause}
                    onEnded={handleEnded}
                    onSeeked={handleSeeked}
                    playsInline
                    preload="metadata"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-av-input-fill/20">
                  <p className="text-av-light-orange">No video available for this episode.</p>
                </div>
              )}

              {upNextVisible && next && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                  <div className="text-center max-w-md p-6">
                    <p className="text-sm text-av-light-orange uppercase tracking-wider">Up next</p>
                    <h3 className="text-2xl font-bold text-av-white mt-1">{next.episode.title}</h3>
                    <p className="text-sm text-av-light-orange mt-1">Season {next.season.season_number} · Episode {next.episode.episode_number}</p>
                    <p className="text-av-orange font-bold text-4xl mt-4">{upNextCountdown}</p>
                    <div className="mt-6 flex items-center justify-center gap-3">
                      <button
                        onClick={() => playEpisode(next.episode.id, next.season.id)}
                        className="px-5 py-2.5 rounded-lg bg-av-orange text-av-dark-blue font-bold text-sm hover:bg-av-light-orange transition-colors"
                      >
                        Play Now
                      </button>
                      <button
                        onClick={cancelUpNext}
                        className="px-5 py-2.5 rounded-lg border border-av-input-border/30 text-av-white text-sm hover:bg-av-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {currentEpisodeIsEmbed && effectiveMediaUrl && (
              <div className="flex items-center gap-2 text-xs text-av-light-orange">
                <span>Embed not loading?</span>
                <a
                  href={effectiveMediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-av-orange underline underline-offset-2 hover:text-av-light-orange transition-colors"
                >
                  Watch on original site
                </a>
              </div>
            )}

            {isOffline && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Playing from offline download — no internet needed.</span>
              </div>
            )}

            {episodeDownloadMeta && !isOffline && (
              <DownloadButton meta={episodeDownloadMeta} />
            )}

            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-av-white">{series.title}</h1>
              <label className="flex items-center gap-2 text-sm text-av-light-orange cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoplayNext}
                  onChange={(e) => setAutoplayNext(e.target.checked)}
                  className="h-4 w-4 accent-av-orange"
                />
                Autoplay next episode
              </label>
            </div>

            {series.description && (
              <p className="text-sm text-av-light-orange leading-relaxed">{series.description}</p>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-av-white">Episodes</h2>
            <div className="space-y-3">
              {(series.seasons || [])
                .sort((a, b) => a.season_number - b.season_number)
                .map((season) => (
                  <div key={season.id} className="rounded-xl border border-av-input-border/20 bg-av-card overflow-hidden">
                    <button
                      onClick={() => setActiveSeasonId(activeSeasonId === season.id ? null : season.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <span className="font-semibold text-av-white">Season {season.season_number}: {season.title || "Untitled"}</span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className={`text-av-light-orange transition-transform ${activeSeasonId === season.id ? "rotate-180" : ""}`}
                      >
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    </button>
                    {activeSeasonId === season.id && (
                      <div className="border-t border-av-input-border/20 divide-y divide-av-input-border/10">
                        {(season.episodes || [])
                          .sort((a, b) => a.episode_number - b.episode_number)
                          .map((episode) => {
                            const isActive = episode.id === activeEpisodeId;
                            return (
                              <button
                                key={episode.id}
                                onClick={() => playEpisode(episode.id, season.id)}
                                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                                  isActive ? "bg-av-orange/10" : "hover:bg-av-input-fill/30"
                                }`}
                              >
                                <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                                  isActive ? "bg-av-orange text-av-dark-blue" : "bg-av-input-fill text-av-light-orange"
                                }`}>
                                  {episode.episode_number}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${isActive ? "text-av-orange" : "text-av-white"}`}>
                                    {episode.title}
                                  </p>
                                  {episode.duration !== undefined && episode.duration > 0 && (
                                    <p className="text-[11px] text-av-light-orange">⏱ {formatDuration(episode.duration)}</p>
                                  )}
                                </div>
                                {isActive && (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-orange">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
    </div>
  );
}
