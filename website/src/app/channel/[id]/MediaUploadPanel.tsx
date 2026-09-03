"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ResumableUploader } from "@/lib/resumable-upload";
import {
  createMovieApi,
  updateMovieApi,
  publishMovieApi,
  archiveMovieApi,
  deleteMovieApi,
  listCreatorMoviesApi,
  uploadMoviePosterApi,
  createMovieResumableSessionApi,
  completeMovieResumableSessionApi,
  createSeriesApi,
  updateSeriesApi,
  publishSeriesApi,
  archiveSeriesApi,
  deleteSeriesApi,
  listCreatorSeriesApi,
  uploadSeriesCoverApi,
  createSeasonApi,
  createEpisodeApi,
  createSeriesResumableSessionApi,
  completeSeriesResumableSessionApi,
  type ChannelMovie,
  type ChannelSeries,
  type ChannelSeason,
  type ChannelSeriesEpisode,
} from "@/lib/api";

type MediaTab = "movies" | "series";

interface Props {
  channelId: string;
  isPublic: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function extractEmbedSrc(input: string): string {
  const trimmed = input.trim();
  // Match src="..." or src='...' (case-insensitive, handles uppercase SRC)
  const quoted = trimmed.match(/src\s*=\s*["']([^"']+)["']/i);
  if (quoted) return quoted[1].trim();
  // Match src=URL without quotes (stops at whitespace)
  const unquoted = trimmed.match(/src\s*=\s*([^\s>]+)/i);
  if (unquoted) return unquoted[1].trim();
  return trimmed;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function MediaUploadPanel({ channelId, isPublic }: Props) {
  const [tab, setTab] = useState<MediaTab>("movies");
  const [movies, setMovies] = useState<ChannelMovie[]>([]);
  const [series, setSeries] = useState<ChannelSeries[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMovies = useCallback(async () => {
    const res = await listCreatorMoviesApi(channelId);
    if (res.ok && "movies" in res.data) setMovies(res.data.movies);
  }, [channelId]);

  const loadSeries = useCallback(async () => {
    const res = await listCreatorSeriesApi(channelId);
    if (res.ok && "series" in res.data) setSeries(res.data.series);
  }, [channelId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMovies(), loadSeries()]).finally(() => setLoading(false));
  }, [loadMovies, loadSeries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-av-input-border/20 pb-3">
        {(["movies", "series"] as MediaTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-av-orange text-av-dark-blue"
                : "text-av-light-orange hover:text-av-white hover:bg-av-card"
            }`}
          >
            {t === "movies" ? "Movies" : "Series"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
        </div>
      ) : tab === "movies" ? (
        <MoviesManager channelId={channelId} isPublic={isPublic} movies={movies} onChange={loadMovies} />
      ) : (
        <SeriesManager channelId={channelId} isPublic={isPublic} series={series} onChange={loadSeries} />
      )}
    </div>
  );
}

/* ── Movies Manager ──────────────────────────────────────────────── */

function MoviesManager({
  channelId,
  isPublic,
  movies,
  onChange,
}: {
  channelId: string;
  isPublic: boolean;
  movies: ChannelMovie[];
  onChange: () => void;
}) {
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<ChannelMovie | null>(null);

  const ageOptions = isPublic
    ? [
        { value: "minor_safe", label: "All Ages" },
        { value: "teen", label: "Teen" },
      ]
    : [
        { value: "minor_safe", label: "All Ages" },
        { value: "teen", label: "Teen" },
        { value: "adult", label: "18+ Adult" },
      ];

  return (
    <div className="space-y-4">
      {mode === "list" && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-av-white">Movies ({movies.length})</h3>
            <button
              onClick={() => setMode("create")}
              className="px-4 py-2 rounded-lg bg-av-orange text-av-dark-blue text-sm font-semibold hover:bg-av-light-orange transition-colors"
            >
              + New Movie
            </button>
          </div>

          {movies.length === 0 ? (
            <p className="text-sm text-av-light-orange">No movies yet.</p>
          ) : (
            <div className="space-y-2">
              {movies.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-av-card/50 border border-av-input-border/20"
                >
                  {m.poster_url ? (
                    <img src={m.poster_url} alt={m.title} className="w-12 h-16 object-cover rounded-md" />
                  ) : (
                    <div className="w-12 h-16 bg-av-input-fill rounded-md flex items-center justify-center text-lg">🎬</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-av-white truncate">{m.title}</p>
                    {m.synopsis && (
                      <p className="text-[11px] text-av-light-orange line-clamp-2">{m.synopsis}</p>
                    )}
                    <p className="text-[11px] text-av-light-orange uppercase mt-0.5">{m.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status !== "published" && (
                      <button
                        onClick={async () => {
                          await publishMovieApi(channelId, m.id);
                          onChange();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-medium hover:bg-green-600/30"
                      >
                        Publish
                      </button>
                    )}
                    {m.status === "published" && (
                      <button
                        onClick={async () => {
                          await archiveMovieApi(channelId, m.id);
                          onChange();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-yellow-600/20 text-yellow-400 text-xs font-medium hover:bg-yellow-600/30"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      onClick={() => { setEditing(m); setMode("edit"); }}
                      className="px-3 py-1.5 rounded-lg bg-av-input-fill text-av-light-orange text-xs font-medium hover:text-av-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm("Delete this movie?")) {
                          await deleteMovieApi(channelId, m.id);
                          onChange();
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 text-xs font-medium hover:bg-red-600/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {(mode === "create" || (mode === "edit" && editing)) && (
        <MovieForm
          channelId={channelId}
          ageOptions={ageOptions}
          existing={mode === "edit" ? editing : null}
          isPublic={isPublic}
          onDone={() => { setMode("list"); setEditing(null); onChange(); }}
          onCancel={() => { setMode("list"); setEditing(null); }}
        />
      )}
    </div>
  );
}

function MovieForm({
  channelId,
  existing,
  ageOptions,
  isPublic,
  onDone,
  onCancel,
}: {
  channelId: string;
  existing: ChannelMovie | null;
  ageOptions: { value: string; label: string }[];
  isPublic: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [synopsis, setSynopsis] = useState(existing?.synopsis ?? "");
  const [posterUrl, setPosterUrl] = useState(existing?.poster_url ?? "");
  const [videoMode, setVideoMode] = useState<"hosted" | "external_url" | "embed" | "hls">(existing?.video_source_mode ?? "hosted");
  const [externalUrl, setExternalUrl] = useState(existing?.external_url ?? "");
  const [embedUrl, setEmbedUrl] = useState(existing?.embed_url ?? "");
  const [hlsUrl, setHlsUrl] = useState(existing?.hls_url ?? "");
  const [hostedUrl, setHostedUrl] = useState(existing?.hosted_url ?? "");
  const [age, setAge] = useState(existing?.age_classification ?? (isPublic ? "minor_safe" : "teen"));
  const [date, setDate] = useState(existing?.date_released ? new Date(existing.date_released).toISOString().slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onPosterChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadMoviePosterApi(channelId, file);
    if (res.ok && res.data.url) {
      setPosterUrl(res.data.url);
    } else {
      setUploadError(res.data.error || "Poster upload failed");
    }
  };

  const startVideoUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      const sessionRes = await createMovieResumableSessionApi(channelId, {
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || "video/mp4",
      });
      if (!sessionRes.ok || !("session" in sessionRes.data)) {
        throw new Error("Failed to create upload session");
      }
      const { id, upload_url } = sessionRes.data.session;
      const uploader = new ResumableUploader({
        file,
        sessionId: id,
        sessionUrl: upload_url,
        onProgress: setUploadProgress,
        onError: (err) => setUploadError(err),
      });
      await uploader.start();
      const completeRes = await completeMovieResumableSessionApi(channelId, id);
      if (completeRes.ok && "public_url" in completeRes.data) {
        setHostedUrl(completeRes.data.public_url);
      } else if ("error" in completeRes.data) {
        throw new Error(completeRes.data.error);
      } else {
        throw new Error("Upload completion failed");
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setUploadError(null);

    if (videoMode === "embed" && embedUrl && !isValidHttpUrl(embedUrl)) {
      setUploadError("Embed URL is not a valid http(s) URL. Paste the iframe code or the direct embed URL.");
      setSaving(false);
      return;
    }
    if (videoMode === "hls" && hlsUrl && !isValidHttpUrl(hlsUrl)) {
      setUploadError("HLS URL is not a valid http(s) URL. Enter the .m3u8 stream URL.");
      setSaving(false);
      return;
    }
    if (videoMode === "external_url" && externalUrl && !isValidHttpUrl(externalUrl)) {
      setUploadError("External URL is not a valid http(s) URL.");
      setSaving(false);
      return;
    }

    const payload = {
      title: title.trim(),
      synopsis: synopsis.trim() || undefined,
      poster_url: posterUrl || undefined,
      age_classification: age as "minor_safe" | "teen" | "adult",
      video_source_mode: videoMode,
      hosted_url: videoMode === "hosted" ? (hostedUrl || undefined) : undefined,
      external_url: videoMode === "external_url" ? (externalUrl || undefined) : undefined,
      embed_url: videoMode === "embed" ? (embedUrl || undefined) : undefined,
      hls_url: videoMode === "hls" ? (hlsUrl || undefined) : undefined,
      date_released: date ? new Date(date).getTime() : undefined,
    };
    try {
      const res = existing
        ? await updateMovieApi(channelId, existing.id, payload)
        : await createMovieApi(channelId, payload);
      if (res.ok) {
        onDone();
      } else {
        setUploadError((res.data as { error?: string })?.error || "Failed to save movie");
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to save movie");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-av-input-border/20 bg-av-card/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-av-white">{existing ? "Edit Movie" : "New Movie"}</h3>
        <button onClick={onCancel} className="text-xs text-av-light-orange hover:text-av-white">Cancel</button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-av-light-orange mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
            placeholder="Movie title"
          />
        </div>

        <div>
          <label className="block text-xs text-av-light-orange mb-1">Synopsis</label>
          <textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
            rows={3}
            placeholder="Short description"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-av-light-orange mb-1">Age Rating</label>
            <select
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
            >
              {ageOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-av-light-orange mb-1">Release Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-av-light-orange mb-1">Poster (URL or upload)</label>
          <div className="space-y-2">
            <input
              type="text"
              value={posterUrl}
              onChange={(e) => setPosterUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
            />
            {!posterUrl && (
              <input
                type="file"
                accept="image/*"
                onChange={onPosterChange}
                className="text-sm text-av-light-orange file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:bg-av-input-fill file:text-av-white file:border-0"
              />
            )}
            {posterUrl && (
              <div className="relative w-24 h-32 rounded-lg overflow-hidden border border-av-input-border/20">
                <img src={posterUrl} alt="poster" className="w-full h-full object-cover" />
                <button onClick={() => setPosterUrl("")} className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded">✕</button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs text-av-light-orange mb-1">Video Source</label>
          <div className="flex flex-wrap items-center gap-4 mb-2">
            <label className="flex items-center gap-2 text-sm text-av-white">
              <input type="radio" checked={videoMode === "hosted"} onChange={() => setVideoMode("hosted")} /> Upload file
            </label>
            <label className="flex items-center gap-2 text-sm text-av-white">
              <input type="radio" checked={videoMode === "external_url"} onChange={() => setVideoMode("external_url")} /> External URL
            </label>
            <label className="flex items-center gap-2 text-sm text-av-white">
              <input type="radio" checked={videoMode === "embed"} onChange={() => setVideoMode("embed")} /> Embed
            </label>
            <label className="flex items-center gap-2 text-sm text-av-white">
              <input type="radio" checked={videoMode === "hls"} onChange={() => setVideoMode("hls")} /> HLS Stream
            </label>
          </div>

          {videoMode === "external_url" ? (
            <input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
              placeholder="https://..."
            />
          ) : videoMode === "embed" ? (
            <input
              value={embedUrl}
              onChange={(e) => setEmbedUrl(extractEmbedSrc(e.target.value))}
              className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
              placeholder="https://..."
            />
          ) : videoMode === "hls" ? (
            <input
              value={hlsUrl}
              onChange={(e) => setHlsUrl(e.target.value)}
              className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
              placeholder="https://example.com/stream/index.m3u8"
            />
          ) : hostedUrl ? (
            <div className="flex items-center justify-between rounded-lg bg-av-input-fill px-3 py-2">
              <span className="text-xs text-av-light-orange truncate">Video uploaded</span>
              <button onClick={() => setHostedUrl("")} className="text-xs text-red-400 hover:text-red-300">Replace</button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="file"
                accept="video/*"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && void startVideoUpload(e.target.files[0])}
                className="text-sm text-av-light-orange file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:bg-av-input-fill file:text-av-white file:border-0"
              />
              {uploading && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-av-input-fill overflow-hidden">
                    <div className="h-full bg-av-orange rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-av-light-orange">{uploadProgress}% uploaded</p>
                </div>
              )}
            </div>
          )}
          {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-av-input-border/20 text-sm text-av-light-orange hover:text-av-white">Cancel</button>
          <button
            onClick={submit}
            disabled={saving || uploading || !title.trim()}
            className="px-4 py-2 rounded-lg bg-av-orange text-av-dark-blue text-sm font-semibold hover:bg-av-light-orange disabled:opacity-50"
          >
            {saving ? "Saving..." : (existing ? "Update Movie" : "Create Movie")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Series Manager ──────────────────────────────────────────────── */

function SeriesManager({
  channelId,
  isPublic,
  series,
  onChange,
}: {
  channelId: string;
  isPublic: boolean;
  series: ChannelSeries[];
  onChange: () => void;
}) {
  const [mode, setMode] = useState<"list" | "create" | "edit" | "episodes">("list");
  const [editing, setEditing] = useState<ChannelSeries | null>(null);

  return (
    <div className="space-y-4">
      {mode === "list" && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-av-white">Series ({series.length})</h3>
            <button
              onClick={() => setMode("create")}
              className="px-4 py-2 rounded-lg bg-av-orange text-av-dark-blue text-sm font-semibold hover:bg-av-light-orange transition-colors"
            >
              + New Series
            </button>
          </div>

          {series.length === 0 ? (
            <p className="text-sm text-av-light-orange">No series yet.</p>
          ) : (
            <div className="space-y-2">
              {series.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-av-card/50 border border-av-input-border/20"
                >
                  {s.cover_url ? (
                    <img src={s.cover_url} alt={s.title} className="w-12 h-16 object-cover rounded-md" />
                  ) : (
                    <div className="w-12 h-16 bg-av-input-fill rounded-md flex items-center justify-center text-lg">📺</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-av-white truncate">{s.title}</p>
                    <p className="text-[11px] text-av-light-orange uppercase">{s.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status !== "published" && (
                      <button
                        onClick={async () => { await publishSeriesApi(channelId, s.id); onChange(); }}
                        className="px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-medium hover:bg-green-600/30"
                      >
                        Publish
                      </button>
                    )}
                    {s.status === "published" && (
                      <button
                        onClick={async () => { await archiveSeriesApi(channelId, s.id); onChange(); }}
                        className="px-3 py-1.5 rounded-lg bg-yellow-600/20 text-yellow-400 text-xs font-medium hover:bg-yellow-600/30"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      onClick={() => { setEditing(s); setMode("episodes"); }}
                      className="px-3 py-1.5 rounded-lg bg-av-input-fill text-av-light-orange text-xs font-medium hover:text-av-white"
                    >
                      Episodes
                    </button>
                    <button
                      onClick={() => { setEditing(s); setMode("edit"); }}
                      className="px-3 py-1.5 rounded-lg bg-av-input-fill text-av-light-orange text-xs font-medium hover:text-av-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => { if (confirm("Delete this series?")) { await deleteSeriesApi(channelId, s.id); onChange(); } }}
                      className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 text-xs font-medium hover:bg-red-600/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {(mode === "create" || (mode === "edit" && editing)) && (
        <SeriesForm
          channelId={channelId}
          existing={mode === "edit" ? editing : null}
          onDone={() => { setMode("list"); setEditing(null); onChange(); }}
          onCancel={() => { setMode("list"); setEditing(null); }}
        />
      )}

      {mode === "episodes" && editing && (
        <EpisodesManager channelId={channelId} series={editing} onBack={() => { setMode("list"); setEditing(null); onChange(); }} />
      )}
    </div>
  );
}

function SeriesForm({
  channelId,
  existing,
  onDone,
  onCancel,
}: {
  channelId: string;
  existing: ChannelSeries | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(existing?.cover_url ?? "");
  const [saving, setSaving] = useState(false);

  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadSeriesCoverApi(channelId, file);
    if (res.ok && res.data.url) setCoverUrl(res.data.url);
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const payload = { title: title.trim(), description: description.trim() || undefined, cover_url: coverUrl || undefined };
    if (existing) {
      await updateSeriesApi(channelId, existing.id, payload);
    } else {
      await createSeriesApi(channelId, payload);
    }
    setSaving(false);
    onDone();
  };

  return (
    <div className="space-y-4 rounded-xl border border-av-input-border/20 bg-av-card/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-av-white">{existing ? "Edit Series" : "New Series"}</h3>
        <button onClick={onCancel} className="text-xs text-av-light-orange hover:text-av-white">Cancel</button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-av-light-orange mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
            placeholder="Series title"
          />
        </div>

        <div>
          <label className="block text-xs text-av-light-orange mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
            rows={3}
            placeholder="Short description"
          />
        </div>

        <div>
          <label className="block text-xs text-av-light-orange mb-1">Cover (URL or upload)</label>
          <div className="space-y-2">
            <input
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
            />
            {!coverUrl && (
              <input
                type="file"
                accept="image/*"
                onChange={onCoverChange}
                className="text-sm text-av-light-orange file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:bg-av-input-fill file:text-av-white file:border-0"
              />
            )}
            {coverUrl && (
              <div className="relative w-24 h-32 rounded-lg overflow-hidden border border-av-input-border/20">
                <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />
                <button onClick={() => setCoverUrl("")} className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded">✕</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-av-input-border/20 text-sm text-av-light-orange hover:text-av-white">Cancel</button>
          <button
            onClick={submit}
            disabled={saving || !title.trim()}
            className="px-4 py-2 rounded-lg bg-av-orange text-av-dark-blue text-sm font-semibold hover:bg-av-light-orange disabled:opacity-50"
          >
            {saving ? "Saving..." : (existing ? "Update Series" : "Create Series")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Episodes Manager ────────────────────────────────────────────── */

function EpisodesManager({
  channelId,
  series,
  onBack,
}: {
  channelId: string;
  series: ChannelSeries;
  onBack: () => void;
}) {
  const [seasons, setSeasons] = useState<ChannelSeason[]>((series as { seasons?: ChannelSeason[] }).seasons || []);
  const [activeSeason, setActiveSeason] = useState<ChannelSeason | null>(null);
  const [newSeasonTitle, setNewSeasonTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const createSeason = async () => {
    if (!newSeasonTitle.trim()) return;
    setCreating(true);
    const res = await createSeasonApi(channelId, series.id, {
      title: newSeasonTitle.trim(),
      season_number: seasons.length + 1,
    });
    if (res.ok && "season" in res.data) {
      const data = res.data as { season: ChannelSeason };
      setSeasons((prev) => [...prev, data.season]);
      setActiveSeason(data.season);
      setNewSeasonTitle("");
    }
    setCreating(false);
  };

  const active = activeSeason || seasons[0] || null;

  return (
    <div className="space-y-4 rounded-xl border border-av-input-border/20 bg-av-card/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-av-white">{series.title} — Seasons</h3>
        <button onClick={onBack} className="text-xs text-av-light-orange hover:text-av-white">Done</button>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={newSeasonTitle}
          onChange={(e) => setNewSeasonTitle(e.target.value)}
          className="flex-1 rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
          placeholder="New season title"
        />
        <button
          onClick={createSeason}
          disabled={creating || !newSeasonTitle.trim()}
          className="px-4 py-2 rounded-lg bg-av-orange text-av-dark-blue text-sm font-semibold hover:bg-av-light-orange disabled:opacity-50"
        >
          {creating ? "..." : "Add"}
        </button>
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm text-av-light-orange">No seasons yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSeason(s)}
              className={`w-full text-left px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                active?.id === s.id
                  ? "border-av-orange bg-av-orange/10 text-av-orange"
                  : "border-av-input-border/20 bg-av-card text-av-white hover:bg-av-input-fill"
              }`}
            >
              Season {s.season_number}: {s.title || "Untitled"}
            </button>
          ))}
        </div>
      )}

      {active && (
        <SeasonEpisodeList channelId={channelId} seriesId={series.id} season={active} onRefresh={(updated) => {
          setSeasons((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        }} />
      )}
    </div>
  );
}

function SeasonEpisodeList({
  channelId,
  seriesId,
  season,
  onRefresh,
}: {
  channelId: string;
  seriesId: string;
  season: ChannelSeason;
  onRefresh: (updated: ChannelSeason) => void;
}) {
  const [episodes, setEpisodes] = useState<ChannelSeriesEpisode[]>(season.episodes || []);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoMode, setVideoMode] = useState<"hosted" | "external_url" | "embed" | "hls">("hosted");
  const [externalUrl, setExternalUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [hlsUrl, setHlsUrl] = useState("");
  const [hostedUrl, setHostedUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    setEpisodes(season.episodes || []);
  }, [season]);

  const startUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    const res = await createSeriesResumableSessionApi(channelId, {
      file_name: file.name,
      file_size: file.size,
      content_type: file.type || "video/mp4",
    });
    if (!res.ok || !("session" in res.data)) {
      setUploading(false);
      return;
    }
    const { id, upload_url } = res.data.session;
    const uploader = new ResumableUploader({
      file,
      sessionId: id,
      sessionUrl: upload_url,
      onProgress: setUploadProgress,
    });
    await uploader.start();
    const completeRes = await completeSeriesResumableSessionApi(channelId, id);
    if (completeRes.ok && "public_url" in completeRes.data) {
      setHostedUrl(completeRes.data.public_url);
    }
    setUploading(false);
  };

  const addEpisode = async () => {
    if (!title.trim()) return;
    setSaving(true);

    if (videoMode === "embed" && embedUrl && !isValidHttpUrl(embedUrl)) {
      setSaving(false);
      return;
    }
    if (videoMode === "hls" && hlsUrl && !isValidHttpUrl(hlsUrl)) {
      setSaving(false);
      return;
    }
    if (videoMode === "external_url" && externalUrl && !isValidHttpUrl(externalUrl)) {
      setSaving(false);
      return;
    }

    const res = await createEpisodeApi(channelId, seriesId, season.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      episode_number: episodes.length + 1,
      video_source_mode: videoMode,
      video_url: videoMode === "hosted" ? hostedUrl : undefined,
      external_url: videoMode === "external_url" ? externalUrl : undefined,
      embed_url: videoMode === "embed" ? embedUrl : undefined,
      hls_url: videoMode === "hls" ? hlsUrl : undefined,
    });
    if (res.ok && "episode" in res.data) {
      const updated = { ...season, episodes: [...episodes, res.data.episode] };
      setEpisodes(updated.episodes);
      onRefresh(updated);
      setTitle("");
      setDescription("");
      setExternalUrl("");
      setEmbedUrl("");
      setHostedUrl("");
      setAdding(false);
    }
    setSaving(false);
  };

  return (
    <div className="border border-av-input-border/20 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-av-white">Episodes ({episodes.length})</h4>
        <button onClick={() => setAdding(!adding)} className="text-xs text-av-orange hover:text-av-light-orange">
          {adding ? "Close" : "+ Add Episode"}
        </button>
      </div>

      {episodes.length === 0 && !adding && (
        <p className="text-xs text-av-light-orange">No episodes in this season yet.</p>
      )}

      {episodes.length > 0 && (
        <div className="space-y-1">
          {episodes.map((ep) => (
            <div key={ep.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-av-card text-sm text-av-white">
              <span className="text-xs text-av-orange font-bold w-5">{ep.episode_number}</span>
              <span className="flex-1 truncate">{ep.title}</span>
              <span className="text-[11px] text-av-light-orange uppercase">{ep.status}</span>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="space-y-3 rounded-lg bg-av-card/50 p-3 border border-av-input-border/20">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
            placeholder="Episode title"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
            rows={2}
            placeholder="Description"
          />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-av-white">
              <input type="radio" checked={videoMode === "hosted"} onChange={() => setVideoMode("hosted")} /> Upload
            </label>
            <label className="flex items-center gap-2 text-sm text-av-white">
              <input type="radio" checked={videoMode === "external_url"} onChange={() => setVideoMode("external_url")} /> External URL
            </label>
            <label className="flex items-center gap-2 text-sm text-av-white">
              <input type="radio" checked={videoMode === "embed"} onChange={() => setVideoMode("embed")} /> Embed
            </label>
            <label className="flex items-center gap-2 text-sm text-av-white">
              <input type="radio" checked={videoMode === "hls"} onChange={() => setVideoMode("hls")} /> HLS Stream
            </label>
          </div>
          {videoMode === "external_url" ? (
            <input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
              placeholder="https://..."
            />
          ) : videoMode === "embed" ? (
            <input
              value={embedUrl}
              onChange={(e) => setEmbedUrl(extractEmbedSrc(e.target.value))}
              className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
              placeholder="https://..."
            />
          ) : videoMode === "hls" ? (
            <input
              value={hlsUrl}
              onChange={(e) => setHlsUrl(e.target.value)}
              className="w-full rounded-lg bg-av-input-fill border border-av-input-border/20 px-3 py-2 text-sm text-av-white focus:border-av-orange outline-none"
              placeholder="https://example.com/stream/index.m3u8"
            />
          ) : hostedUrl ? (
            <div className="flex items-center justify-between rounded-lg bg-av-input-fill px-3 py-2">
              <span className="text-xs text-av-light-orange truncate">Video uploaded</span>
              <button onClick={() => setHostedUrl("")} className="text-xs text-red-400 hover:text-red-300">Replace</button>
            </div>
          ) : (
            <div className="space-y-1">
              <input
                type="file"
                accept="video/*"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && void startUpload(e.target.files[0])}
                className="text-sm text-av-light-orange file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:bg-av-input-fill file:text-av-white file:border-0"
              />
              {uploading && (
                <>
                  <div className="h-1.5 rounded-full bg-av-input-fill overflow-hidden">
                    <div className="h-full bg-av-orange rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-av-light-orange">{uploadProgress}%</p>
                </>
              )}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg border border-av-input-border/20 text-xs text-av-light-orange hover:text-av-white">Cancel</button>
            <button
              onClick={addEpisode}
              disabled={saving || uploading || !title.trim()}
              className="px-3 py-1.5 rounded-lg bg-av-orange text-av-dark-blue text-xs font-semibold hover:bg-av-light-orange disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Episode"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
