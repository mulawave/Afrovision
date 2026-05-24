/* eslint-disable @next/next/no-img-element */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type LibraryBookmark,
  type LibraryItem,
  type LibraryItemDetail,
  getChannelLibraryItemDetailApi,
  getChannelLibraryProgressApi,
  getChannelLibraryReaderManifestApi,
  updateChannelLibraryProgressApi,
  listChannelLibraryBookmarksApi,
  createChannelLibraryBookmarkApi,
  deleteChannelLibraryBookmarkApi,
  getChannelLibraryRecommendationsApi,
} from "@/lib/api";

type ReaderPage = {
  pageNumber: number;
  imageUrl: string;
};

type ReaderSpread = {
  spreadIndex: number;
  leftPageNumber: number | null;
  rightPageNumber: number | null;
};

type ReaderManifest = {
  sourceType?: "pdf" | "images";
  pdfUrl?: string | null;
  pageImageUrls?: string[];
  totalPages?: number;
  pages?: ReaderPage[];
  spreads?: ReaderSpread[];
};

function buildFallbackSpreads(totalPages: number): ReaderSpread[] {
  const spreads: ReaderSpread[] = [];
  let spreadIndex = 0;

  // Cover page spread
  if (totalPages > 0) {
    spreads.push({ spreadIndex, leftPageNumber: null, rightPageNumber: 1 });
    spreadIndex += 1;
  }

  for (let page = 2; page <= totalPages; page += 2) {
    spreads.push({
      spreadIndex,
      leftPageNumber: page,
      rightPageNumber: page + 1 <= totalPages ? page + 1 : null,
    });
    spreadIndex += 1;
  }

  return spreads;
}

export default function LibraryReaderPage() {
  const params = useParams<{ id: string; itemId: string }>();

  const channelId = String(params.id || "");
  const initialItemId = String(params.itemId || "");

  const [currentItemId, setCurrentItemId] = useState(initialItemId);
  const [itemDetail, setItemDetail] = useState<LibraryItemDetail | null>(null);
  const [manifest, setManifest] = useState<ReaderManifest | null>(null);
  const [bookmarks, setBookmarks] = useState<LibraryBookmark[]>([]);
  const [recommendations, setRecommendations] = useState<LibraryItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingProgress, setSavingProgress] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(null);

  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [showCompletionSheet, setShowCompletionSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showBookmarkNudge, setShowBookmarkNudge] = useState(false);

  const saveProgressTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const bookmarkNudgeTimerRef = useRef<number | null>(null);

  const spreads = useMemo(() => {
    if (manifest?.spreads && manifest.spreads.length > 0) return manifest.spreads;
    const totalPages = itemDetail?.item?.totalPages || 0;
    return buildFallbackSpreads(totalPages);
  }, [manifest?.spreads, itemDetail?.item?.totalPages]);

  const pagesByNumber = useMemo(() => {
    const map = new Map<number, ReaderPage>();
    for (const page of manifest?.pages || []) {
      map.set(page.pageNumber, page);
    }
    return map;
  }, [manifest?.pages]);

  const currentSpread = useMemo(() => {
    return spreads[currentSpreadIndex] || {
      spreadIndex: 0,
      leftPageNumber: null,
      rightPageNumber: null,
    };
  }, [spreads, currentSpreadIndex]);

  const leftPage = currentSpread.leftPageNumber ? pagesByNumber.get(currentSpread.leftPageNumber) : null;
  const rightPage = currentSpread.rightPageNumber ? pagesByNumber.get(currentSpread.rightPageNumber) : null;
  const pdfUrl = manifest?.pdfUrl || null;
  const hasImagePages = useMemo(() => {
    const pages = manifest?.pages || [];
    return pages.some((p) => Boolean(p?.imageUrl));
  }, [manifest?.pages]);

  const hasPrev = currentSpreadIndex > 0;
  const hasNext = currentSpreadIndex < spreads.length - 1;

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const loadReaderData = useCallback(async (itemId: string) => {
    setLoading(true);
    setShowCompletionSheet(false);
    setShowBookmarkNudge(false);

    const [detailRes, progressRes, bookmarksRes, manifestRes] = await Promise.all([
      getChannelLibraryItemDetailApi(channelId, itemId),
      getChannelLibraryProgressApi(channelId, itemId),
      listChannelLibraryBookmarksApi(channelId, itemId),
      getChannelLibraryReaderManifestApi(channelId, itemId),
    ]);

    if (!detailRes.ok || !("data" in detailRes.data)) {
      setLoading(false);
      showToast("Unable to load this book.");
      return;
    }

    const detail = detailRes.data.data;
    setItemDetail(detail);

    if (progressRes.ok && "data" in progressRes.data) {
      setCurrentSpreadIndex(Math.max(0, progressRes.data.data.currentSpreadIndex || 0));
    } else if (detail.progress) {
      setCurrentSpreadIndex(Math.max(0, detail.progress.currentSpreadIndex || 0));
    } else {
      setCurrentSpreadIndex(0);
    }

    if (bookmarksRes.ok && "data" in bookmarksRes.data) {
      setBookmarks(bookmarksRes.data.data || []);
    } else {
      setBookmarks([]);
    }

    if (manifestRes.ok && "data" in manifestRes.data) {
      try {
        const manifestJson = await fetch(manifestRes.data.data.manifestUrl, { cache: "no-store" }).then((r) => r.json());
        setManifest(manifestJson as ReaderManifest);
      } catch {
        setManifest(null);
      }
    } else {
      setManifest(null);
    }

    setLoading(false);
  }, [channelId, showToast]);

  useEffect(() => {
    if (!channelId || !currentItemId) return;
    const timer = window.setTimeout(() => {
      void loadReaderData(currentItemId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [channelId, currentItemId, loadReaderData]);

  // Bookmark reminder nudge after sustained reading.
  useEffect(() => {
    if (loading || showCompletionSheet || bookmarks.length > 0) {
      if (bookmarkNudgeTimerRef.current) {
        window.clearTimeout(bookmarkNudgeTimerRef.current);
      }
      return;
    }

    if (bookmarkNudgeTimerRef.current) {
      window.clearTimeout(bookmarkNudgeTimerRef.current);
    }

    bookmarkNudgeTimerRef.current = window.setTimeout(() => {
      setShowBookmarkNudge(true);
    }, 60000);

    return () => {
      if (bookmarkNudgeTimerRef.current) {
        window.clearTimeout(bookmarkNudgeTimerRef.current);
      }
    };
  }, [bookmarks.length, loading, showCompletionSheet, currentItemId]);

  const shouldShowBookmarkNudge =
    showBookmarkNudge && !loading && !showCompletionSheet && bookmarks.length === 0;

  // Auto-save progress after spread changes (debounced)
  useEffect(() => {
    if (!channelId || !currentItemId || spreads.length === 0) return;

    if (saveProgressTimerRef.current) {
      window.clearTimeout(saveProgressTimerRef.current);
    }

    saveProgressTimerRef.current = window.setTimeout(async () => {
      const spread = spreads[currentSpreadIndex];
      if (!spread) return;
      setSavingProgress(true);
      await updateChannelLibraryProgressApi(channelId, currentItemId, {
        currentSpreadIndex,
        currentPageLeft: spread.leftPageNumber,
        currentPageRight: spread.rightPageNumber,
        isCompleted: currentSpreadIndex >= spreads.length - 1,
      });
      setSavingProgress(false);
    }, 450);

    return () => {
      if (saveProgressTimerRef.current) {
        window.clearTimeout(saveProgressTimerRef.current);
      }
    };
  }, [channelId, currentItemId, currentSpreadIndex, spreads]);

  useEffect(() => {
    return () => {
      if (saveProgressTimerRef.current) window.clearTimeout(saveProgressTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (bookmarkNudgeTimerRef.current) window.clearTimeout(bookmarkNudgeTimerRef.current);
    };
  }, []);

  const goNext = useCallback(async () => {
    if (hasNext) {
      setFlipDirection("next");
      setCurrentSpreadIndex((prev) => Math.min(prev + 1, spreads.length - 1));
      window.setTimeout(() => setFlipDirection(null), 260);
      return;
    }

    const nextItemId = itemDetail?.navigation?.nextItemId;
    if (nextItemId) {
      showToast("Up next in this series");
      setCurrentItemId(nextItemId);
      return;
    }

    const recRes = await getChannelLibraryRecommendationsApi(channelId, 6);
    if (recRes.ok && "data" in recRes.data) {
      setRecommendations(recRes.data.data || []);
    }
    setShowCompletionSheet(true);
  }, [hasNext, spreads.length, itemDetail?.navigation?.nextItemId, channelId, showToast]);

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    setFlipDirection("prev");
    setCurrentSpreadIndex((prev) => Math.max(prev - 1, 0));
    window.setTimeout(() => setFlipDirection(null), 260);
  }, [hasPrev]);

  const addBookmark = useCallback(async () => {
    if (!currentSpread) return;
    const created = await createChannelLibraryBookmarkApi(channelId, currentItemId, {
      spreadIndex: currentSpreadIndex,
      page: currentSpread.rightPageNumber || currentSpread.leftPageNumber || 1,
      note: "",
    });

    if (!created.ok) return;
    const payload = created.data;
    if (!("data" in payload)) return;

    setBookmarks((prev) => [payload.data, ...prev]);
    setShowBookmarkNudge(false);
    showToast("Bookmark saved");
  }, [channelId, currentItemId, currentSpread, currentSpreadIndex, showToast]);

  const deleteBookmark = useCallback(async (bookmarkId: string) => {
    const res = await deleteChannelLibraryBookmarkApi(channelId, currentItemId, bookmarkId);
    if (res.ok) {
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
      showToast("Bookmark removed");
    }
  }, [channelId, currentItemId, showToast]);

  const jumpToBookmark = useCallback((spreadIndex: number) => {
    setCurrentSpreadIndex(Math.max(0, Math.min(spreadIndex, Math.max(0, spreads.length - 1))));
  }, [spreads.length]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-av-light-blue to-av-dark-blue text-av-white">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/channel/${channelId}`} className="text-sm text-av-light-orange hover:text-av-orange transition-colors">
            ← Back to Channel
          </Link>
          <div className="text-xs text-av-light-orange">
            {savingProgress ? "Saving progress..." : "Progress synced"}
          </div>
        </div>
      </div>

      {loading || !itemDetail ? (
        <div className="flex items-center justify-center py-40">
          <div className="h-8 w-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 pb-12">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{itemDetail.item.title}</h1>
            <p className="mt-1 text-sm text-av-light-orange">{itemDetail.item.author}</p>
            {shouldShowBookmarkNudge ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-av-orange/35 bg-av-card px-3 py-1.5 text-xs text-av-light-orange">
                Bookmark this page?
                <button
                  type="button"
                  onClick={() => void addBookmark()}
                  className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-3 py-1 text-[11px] font-semibold text-av-dark-blue"
                >
                  Save bookmark
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
            <section className="rounded-2xl border border-av-input-border/30 bg-av-card/70 backdrop-blur-sm p-4 md:p-6 shadow-2xl shadow-black/30">
              <div className="relative overflow-hidden rounded-xl border border-av-input-border/20 bg-gradient-to-b from-av-dark-blue/95 to-black/80 min-h-[560px]">
                <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-av-light-orange/10 blur-3xl" />

                {!hasImagePages && pdfUrl ? (
                  <div className="p-4 md:p-6">
                    <div className="overflow-hidden rounded-lg border border-av-input-border/20 bg-white">
                      <iframe
                        src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                        title="Reader PDF"
                        className="h-[620px] w-full"
                      />
                    </div>
                    <p className="mt-2 text-xs text-av-light-orange">
                      PDF reader mode: if you prefer page-flip view, upload page images in Library Studio.
                    </p>
                  </div>
                ) : (
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-0 transition-transform duration-300 ${flipDirection === "next" ? "translate-x-2" : ""} ${flipDirection === "prev" ? "-translate-x-2" : ""}`}>
                  <article className="min-h-[560px] border-r border-av-input-border/15 p-5 md:p-8 bg-[#fffaf2] text-[#26211c]">
                    <p className="mb-3 text-xs uppercase tracking-widest text-[#6a5b4b]">Left Page</p>
                    {leftPage?.imageUrl ? (
                      <img src={leftPage.imageUrl} alt={`Page ${leftPage.pageNumber}`} className="h-[470px] w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-[470px] items-center justify-center rounded-lg border border-[#dfd4c4] bg-[#f4eadc] text-sm text-[#6a5b4b]">
                        {leftPage?.pageNumber ? `Page ${leftPage.pageNumber}` : "Front Matter"}
                      </div>
                    )}
                  </article>

                  <article className="min-h-[560px] p-5 md:p-8 bg-[#fff7ec] text-[#26211c]">
                    <p className="mb-3 text-xs uppercase tracking-widest text-[#6a5b4b]">Right Page</p>
                    {rightPage?.imageUrl ? (
                      <img src={rightPage.imageUrl} alt={`Page ${rightPage.pageNumber}`} className="h-[470px] w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-[470px] items-center justify-center rounded-lg border border-[#dfd4c4] bg-[#f4eadc] text-sm text-[#6a5b4b]">
                        {rightPage?.pageNumber ? `Page ${rightPage.pageNumber}` : "End Page"}
                      </div>
                    )}
                  </article>
                </div>
                )}
              </div>

              {hasImagePages ? (
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  onClick={goPrev}
                  disabled={!hasPrev}
                  className="rounded-xl border border-av-input-border/30 px-4 py-2 text-sm font-semibold text-av-white disabled:opacity-40"
                >
                  Previous Spread
                </button>
                <div className="text-xs text-av-light-orange">
                  Spread {Math.min(currentSpreadIndex + 1, Math.max(spreads.length, 1))} of {Math.max(spreads.length, 1)}
                </div>
                <button
                  onClick={() => void goNext()}
                  className="rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-sm font-semibold text-av-dark-blue"
                >
                  {hasNext ? "Next Spread" : "Finish"}
                </button>
              </div>
              ) : null}
            </section>

            <aside className="space-y-4">
              <div className="rounded-xl border border-av-input-border/25 bg-av-card/80 p-4">
                <h2 className="text-sm font-semibold">Reader Controls</h2>
                <button
                  onClick={() => void addBookmark()}
                  className="mt-3 w-full rounded-xl border border-av-input-border/30 px-4 py-2 text-sm font-semibold hover:border-av-orange/35"
                >
                  Add Bookmark
                </button>
              </div>

              <div className="rounded-xl border border-av-input-border/25 bg-av-card/80 p-4">
                <h2 className="text-sm font-semibold">Bookmarks</h2>
                {bookmarks.length === 0 ? (
                  <p className="mt-3 text-xs text-av-light-orange">No bookmarks yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {bookmarks.slice(0, 8).map((bookmark) => (
                      <li key={bookmark.id} className="rounded-lg border border-av-input-border/20 p-2">
                        <button
                          onClick={() => jumpToBookmark(bookmark.spreadIndex)}
                          className="w-full text-left text-xs text-av-white hover:text-av-orange"
                        >
                          Jump to spread {bookmark.spreadIndex + 1}
                        </button>
                        <button
                          onClick={() => void deleteBookmark(bookmark.id)}
                          className="mt-1 text-[11px] text-av-light-orange hover:text-av-orange"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {showCompletionSheet && (
        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-av-input-border/25 bg-av-card/95 backdrop-blur-md p-4">
          <div className="mx-auto max-w-6xl">
            <h3 className="text-sm font-semibold">You finished this item</h3>
            <p className="mt-1 text-xs text-av-light-orange">No next book in this series. Continue with recommendations.</p>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {recommendations.map((rec) => (
                <button
                  key={rec.id}
                  onClick={() => setCurrentItemId(rec.id)}
                  className="rounded-lg border border-av-input-border/25 p-2 text-left hover:border-av-orange/30"
                >
                  <p className="truncate text-xs font-semibold">{rec.title}</p>
                  <p className="truncate text-[11px] text-av-light-orange">{rec.author}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-av-orange/30 bg-av-card px-4 py-2 text-xs text-av-light-orange shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}
