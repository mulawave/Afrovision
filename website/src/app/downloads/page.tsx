"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  type OfflineVideoMeta,
  listDownloaded,
  deleteVideo,
  getStorageEstimate,
} from "@/lib/offlineStorage";
import { formatBytes } from "@/lib/downloadManager";

export default function DownloadsPage() {
  const router = useRouter();
  const [downloads, setDownloads] = useState<OfflineVideoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [storage, setStorage] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [list, est] = await Promise.all([listDownloaded(), getStorageEstimate()]);
    setDownloads(list);
    setStorage(est);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDelete = useCallback(async (id: string, mediaType: "movie" | "episode", mediaId: string) => {
    await deleteVideo(mediaType, mediaId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    void loadData();
  }, [loadData]);

  const handleBulkDelete = useCallback(async () => {
    const toDelete = downloads.filter((d) => selectedIds.has(d.id));
    await Promise.all(
      toDelete.map((d) => deleteVideo(d.mediaType, d.mediaId)),
    );
    setSelectedIds(new Set());
    void loadData();
  }, [downloads, selectedIds, loadData]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === downloads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(downloads.map((d) => d.id)));
    }
  }, [downloads, selectedIds]);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleWatch = useCallback((item: OfflineVideoMeta) => {
    if (item.mediaType === "movie") {
      router.push(`/movies/${item.mediaId}`);
    } else {
      router.push(`/series/${item.series_id || ""}`);
    }
  }, [router]);

  const filtered = downloads.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="pt-28 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-av-white">Downloads</h1>
          <p className="text-sm text-av-light-orange mt-1">
            Watch your downloaded movies and episodes offline.
          </p>
          {storage.quota > 0 && (
            <p className="text-xs text-av-light-orange mt-2">
              {formatBytes(storage.usage)} used of {formatBytes(storage.quota)} available
            </p>
          )}
        </div>

        {downloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
            <span className="text-5xl">📥</span>
            <p className="text-av-light-orange text-lg">No downloads yet</p>
            <p className="text-av-light-orange text-sm">Download movies to watch offline.</p>
            <button
              onClick={() => router.push("/movies")}
              className="px-5 py-2 rounded-lg bg-av-orange text-av-dark-blue font-semibold text-sm hover:bg-av-light-orange transition-colors"
            >
              Browse Movies
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <input
                type="text"
                placeholder="Search downloads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] max-w-xs rounded-lg bg-av-card border border-av-input-border/30 px-4 py-2 text-sm text-av-white placeholder:text-av-light-orange/50 focus:outline-none focus:border-av-orange/50"
              />
              <button
                onClick={handleSelectAll}
                className="px-3 py-2 rounded-lg border border-av-input-border/30 text-av-white text-xs font-semibold hover:bg-white/5 transition-colors"
              >
                {selectedIds.size === downloads.length ? "Deselect All" : "Select All"}
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-2 rounded-lg bg-red-600/20 border border-red-600/40 text-red-400 text-xs font-semibold hover:bg-red-600/30 transition-colors"
                >
                  Delete Selected ({selectedIds.size})
                </button>
              )}
            </div>

            {/* Downloads list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl bg-av-card border overflow-hidden transition-colors ${
                    selectedIds.has(item.id)
                      ? "border-av-orange/50"
                      : "border-av-input-border/20"
                  }`}
                >
                  <div className="flex gap-3 p-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => handleSelect(item.id)}
                      className="mt-1 w-4 h-4 accent-av-orange shrink-0"
                    />

                    {/* Poster */}
                    {item.poster_url ? (
                      <img
                        src={item.poster_url}
                        alt={item.title}
                        className="w-16 h-24 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-24 rounded-lg bg-av-input-fill/40 flex items-center justify-center shrink-0">
                        <span className="text-2xl">🎬</span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-av-white truncate">{item.title}</h3>
                        <p className="text-xs text-av-light-orange mt-0.5">
                          {item.mediaType === "episode" ? "Episode" : "Movie"}
                          {item.episode_number ? ` · Ep ${item.episode_number}` : ""}
                        </p>
                        <p className="text-xs text-av-light-orange/70 mt-0.5">
                          {formatBytes(item.total_size)}
                        </p>
                        <p className="text-[10px] text-av-light-orange/50 mt-0.5">
                          {new Date(item.downloaded_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleWatch(item)}
                          className="px-3 py-1.5 rounded-lg bg-av-orange text-av-dark-blue font-bold text-[11px] hover:bg-av-light-orange transition-colors"
                        >
                          Watch
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.mediaType, item.mediaId)}
                          className="px-3 py-1.5 rounded-lg border border-red-600/30 text-red-400 text-[11px] font-semibold hover:bg-red-600/10 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && search && (
              <p className="text-center text-av-light-orange text-sm mt-8">No downloads match your search.</p>
            )}
          </>
        )}
    </div>
  );
}
