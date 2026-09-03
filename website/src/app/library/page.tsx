/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type LibraryItem,
  getPublicLibraryFeedApi,
} from "@/lib/api";

const CONTENT_TYPES = [
  { value: "", label: "All" },
  { value: "magazine", label: "Magazines" },
  { value: "book", label: "Books" },
  { value: "comic", label: "Comics" },
];

export default function LibraryPage() {
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [contentType, setContentType] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadItems = async (p = 1, type = contentType) => {
    setLoading(true);
    setError(null);
    const res = await getPublicLibraryFeedApi({ page: p, limit: 24, contentType: type || undefined });
    if (res.ok && "data" in res.data) {
      setItems(res.data.data.items || []);
      setTotalPages(res.data.data.pagination?.pages || 1);
      setPage(p);
    } else {
      setError("Unable to load library.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadItems(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadItems(1, contentType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  const typeIcon = (type: string) => {
    switch (type) {
      case "magazine":
        return "📰";
      case "book":
        return "📖";
      case "comic":
        return "🦸";
      default:
        return "📚";
    }
  };

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-av-white">Public Library</h1>
            <p className="mt-2 text-av-light-orange">Magazines, books, and comics shared by public channels.</p>
          </div>

          <div className="flex items-center gap-2">
            {CONTENT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setContentType(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  contentType === t.value
                    ? "bg-av-orange text-av-dark-blue border-av-orange"
                    : "bg-av-card border-av-input-border/20 text-av-light-orange hover:text-av-white hover:border-av-orange/40"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-24 rounded-xl bg-av-card border border-av-input-border/20">
            <p className="text-3xl mb-3">📚</p>
            <p className="text-av-light-orange">{error}</p>
            <button
              onClick={() => void loadItems(page, contentType)}
              className="mt-4 px-5 py-2 rounded-lg bg-av-orange text-av-dark-blue font-semibold text-sm hover:bg-av-light-orange transition-colors"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 rounded-xl bg-av-card border border-av-input-border/20">
            <p className="text-3xl mb-3">📚</p>
            <p className="text-av-light-orange">No public library items available right now.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/library/${item.id}`)}
                    className="group rounded-xl bg-av-card border border-av-input-border/20 overflow-hidden text-left hover:border-av-orange/40 transition-all"
                >
                  <div className="relative aspect-[2/3] bg-av-input-fill/40">
                    {item.coverAssetUrl ? (
                      <img
                        src={item.coverAssetUrl}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl group-hover:scale-110 transition-transform">{typeIcon(item.contentType)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-wider text-av-orange font-bold mb-1">{item.contentType}</p>
                    <p className="text-sm font-semibold text-av-white leading-snug line-clamp-2 group-hover:text-av-orange transition-colors">{item.title}</p>
                    {item.subtitle && (
                      <p className="mt-1 text-[11px] text-av-light-orange line-clamp-2">{item.subtitle}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  onClick={() => page > 1 && void loadItems(page - 1, contentType)}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg bg-av-card border border-av-input-border/20 text-sm text-av-light-orange hover:text-av-white disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-av-light-orange">Page {page} of {totalPages}</span>
                <button
                  onClick={() => page < totalPages && void loadItems(page + 1, contentType)}
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
