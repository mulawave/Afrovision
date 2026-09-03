"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { type ChannelMovie, getMovieDetailApi, recordMovieViewApi } from "@/lib/api";
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

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [movie, setMovie] = useState<ChannelMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewRecorded = useRef(false);
  const lastSaveRef = useRef(0);
  const resumeAttempted = useRef(false);
  const [offlineUrl, setOfflineUrl] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const isEmbed = movie?.video_source_mode === "embed";
  const isHls = movie?.video_source_mode === "hls";
  const remoteVideoUrl = isEmbed
    ? movie?.embed_url
    : isHls
      ? movie?.hls_url
      : movie?.video_source_mode === "external_url"
        ? movie.external_url
        : movie?.hosted_url;
  // Use offline URL if available, otherwise remote
  const videoUrl = isOffline ? offlineUrl : remoteVideoUrl;

  const downloadMeta: DownloadMeta | null = movie && !isEmbed ? {
    mediaType: "movie",
    mediaId: id,
    title: movie.title,
    poster_url: movie.poster_url,
    video_source_mode: movie.video_source_mode || "hosted",
    hls_url: movie.hls_url,
    hosted_url: movie.hosted_url,
    external_url: movie.external_url,
    duration: movie.duration || 0,
  } : null;

  const loadMovie = async () => {
    setLoading(true);
    setError(null);
    const res = await getMovieDetailApi(id);
    if (res.ok && "data" in res.data && res.data.data.movie) {
      setMovie(res.data.data.movie);
    } else {
      setError("Movie not found or unavailable.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadMovie();
  }, [id]);

  // Check if video is available offline in IndexedDB
  useEffect(() => {
    if (!id) return;
    let urlToRevoke: string | null = null;
    void (async () => {
      const downloaded = await isDownloaded("movie", id);
      if (downloaded) {
        const url = await getOfflineVideoUrl("movie", id);
        if (url) {
          urlToRevoke = url;
          setOfflineUrl(url);
          setIsOffline(true);
        }
      }
    })();
    return () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [id]);

  const handlePlay = () => {
    if (viewRecorded.current) return;
    viewRecorded.current = true;
    void recordMovieViewApi(id);
  };

  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    if (!duration || duration <= 0) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 10000) return;
    lastSaveRef.current = now;
    void saveProgress("movie", id, currentTime, duration);
  }, [id]);

  const handlePause = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration > 0) {
      void saveProgress("movie", id, video.currentTime, video.duration);
    }
  }, [id]);

  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration > 0) {
      void saveProgress("movie", id, video.duration, video.duration);
    }
  }, [id]);

  const handleLoadedMetadata = useCallback(async (duration: number) => {
    if (resumeAttempted.current) return;
    resumeAttempted.current = true;
    if (!duration || duration <= 0) return;
    const progress = await loadProgress("movie", id);
    if (progress && shouldResume(progress.position, progress.duration)) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = progress.position;
      }
    }
  }, [id]);

  const handleSeeked = useCallback(() => {
    const video = videoRef.current;
    if (video && video.currentTime < 5) {
      clearProgress("movie", id);
    }
  }, [id]);

  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video && video.duration > 0) {
        void saveProgress("movie", id, video.currentTime, video.duration);
      }
    };
  }, [id]);

  if (loading) {
    return (
      <div className="pt-28 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="pt-28 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-3xl">🎬</p>
        <p className="text-av-light-orange">{error || "Movie not found"}</p>
        <button
          onClick={() => router.push("/movies")}
          className="px-5 py-2 rounded-lg bg-av-orange text-av-dark-blue font-semibold text-sm hover:bg-av-light-orange transition-colors"
        >
          Browse Movies
        </button>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Player */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl overflow-hidden bg-black aspect-video border border-av-input-border/20 shadow-2xl shadow-black/40">
              {videoUrl ? (
                isEmbed ? (
                  <iframe
                    src={videoUrl}
                    onLoad={handlePlay}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="fullscreen; autoplay; encrypted-media"
                    allowFullScreen
                  />
                ) : isHls ? (
                  <HlsPlayer
                    src={videoUrl}
                    onPlay={handlePlay}
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
                    src={videoUrl}
                    controls
                    className="w-full h-full"
                    onPlay={handlePlay}
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
                  <p className="text-av-light-orange">No video available for this movie.</p>
                </div>
              )}
            </div>

            {isEmbed && videoUrl && (
              <div className="flex items-center gap-2 text-xs text-av-light-orange">
                <span>Embed not loading?</span>
                <a
                  href={videoUrl}
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

            {downloadMeta && !isOffline && (
              <DownloadButton meta={downloadMeta} />
            )}

            <div className="rounded-xl bg-av-card border border-av-input-border/20 p-5">
              <h1 className="text-2xl font-bold text-av-white">{movie.title}</h1>
              {movie.age_classification === "adult" && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded bg-red-600/80 text-[10px] font-bold text-white">18+</span>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[12px] text-av-light-orange">
                {movie.duration !== undefined && movie.duration > 0 && (
                  <span>⏱ {formatDuration(movie.duration)}</span>
                )}
                {movie.total_views !== undefined && movie.total_views > 0 && (
                  <span>👁 {movie.total_views} views</span>
                )}
              </div>
              {movie.synopsis && (
                <p className="mt-4 text-sm text-av-light-orange leading-relaxed">{movie.synopsis}</p>
              )}
            </div>
          </div>

          {/* Poster / info */}
          <div className="hidden lg:block">
            <div className="rounded-xl overflow-hidden border border-av-input-border/20 bg-av-card">
              {movie.poster_url ? (
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  className="w-full object-cover"
                />
              ) : (
                <div className="w-full aspect-[2/3] flex items-center justify-center bg-av-input-fill/40">
                  <span className="text-5xl">🎬</span>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
