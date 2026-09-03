/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ChannelMovie,
  getPublicMoviesApi,
} from "@/lib/api";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
}

export default function MoviesPage() {
  const router = useRouter();
  const [movies, setMovies] = useState<ChannelMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadMovies = async (p = 1) => {
    setLoading(true);
    setError(null);
    const res = await getPublicMoviesApi({ page: p, limit: 24 });
    if (res.ok && "data" in res.data) {
      setMovies(res.data.data.movies || []);
      setTotalPages(res.data.data.pagination?.pages || 1);
      setPage(p);
    } else {
      setError("Unable to load movies.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadMovies(1);
  }, []);

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-av-white">Movies</h1>
          <p className="mt-2 text-av-light-orange">Watch movies from public channels across AfroVision.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-24 rounded-xl bg-av-card border border-av-input-border/20">
            <p className="text-3xl mb-3">🎬</p>
            <p className="text-av-light-orange">{error}</p>
            <button
              onClick={() => void loadMovies(page)}
              className="mt-4 px-5 py-2 rounded-lg bg-av-orange text-av-dark-blue font-semibold text-sm hover:bg-av-light-orange transition-colors"
            >
              Retry
            </button>
          </div>
        ) : movies.length === 0 ? (
          <div className="text-center py-24 rounded-xl bg-av-card border border-av-input-border/20">
            <p className="text-3xl mb-3">🎬</p>
            <p className="text-av-light-orange">No public movies available right now.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {movies.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => router.push(`/movies/${movie.id}`)}
                  className="group rounded-xl bg-av-card border border-av-input-border/20 overflow-hidden text-left hover:border-av-orange/40 transition-all"
                >
                  <div className="relative aspect-[2/3] bg-av-input-fill/40">
                    {movie.poster_url ? (
                      <img
                        src={movie.poster_url}
                        alt={movie.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl group-hover:scale-110 transition-transform">🎬</span>
                      </div>
                    )}
                    {movie.age_classification === "adult" && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-red-600/80 text-[10px] font-bold text-white">18+</span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-av-white leading-snug line-clamp-2 group-hover:text-av-orange transition-colors">{movie.title}</p>
                    {movie.synopsis && (
                      <p className="mt-1 text-[11px] text-av-light-orange line-clamp-2">{movie.synopsis}</p>
                    )}
                    {movie.duration !== undefined && movie.duration > 0 && (
                      <p className="mt-1 text-[10px] text-av-light-orange">⏱ {formatDuration(movie.duration)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  onClick={() => page > 1 && void loadMovies(page - 1)}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg bg-av-card border border-av-input-border/20 text-sm text-av-light-orange hover:text-av-white disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-av-light-orange">Page {page} of {totalPages}</span>
                <button
                  onClick={() => page < totalPages && void loadMovies(page + 1)}
                  disabled={page >= totalPages}
                  className="px-4 py-2 rounded-lg bg-av-card border border-av-input-border/20 text-sm text-av-light-orange hover:text-av-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
    </div>
  );
}
