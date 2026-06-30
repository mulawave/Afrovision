/* eslint-disable @next/next/no-img-element */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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

type ReaderPage = { pageNumber: number; imageUrl: string };

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

type FlipPhase = "idle" | "ready" | "animating";

function buildFallbackSpreads(totalPages: number): ReaderSpread[] {
  const out: ReaderSpread[] = [];
  let idx = 0;
  if (totalPages > 0) {
    out.push({ spreadIndex: idx++, leftPageNumber: null, rightPageNumber: 1 });
  }
  for (let p = 2; p <= totalPages; p += 2) {
    out.push({
      spreadIndex: idx++,
      leftPageNumber: p,
      rightPageNumber: p + 1 <= totalPages ? p + 1 : null,
    });
  }
  return out;
}

/**
 * Normalise manifest pages â€” supports both `pages[]` (with imageUrl) and
 * `pageImageUrls[]` (index-based) so we always have a usable ReaderPage[].
 */
function normalizePages(manifest: ReaderManifest | null): ReaderPage[] {
  if (!manifest) return [];
  if (manifest.pages && manifest.pages.length > 0) {
    const hasUrls = manifest.pages.some((p) => Boolean(p.imageUrl));
    if (hasUrls) return manifest.pages;
    if (manifest.pageImageUrls?.length) {
      return manifest.pages.map((p) => ({
        ...p,
        imageUrl: manifest.pageImageUrls![p.pageNumber - 1] ?? "",
      }));
    }
    return manifest.pages;
  }
  if (manifest.pageImageUrls && manifest.pageImageUrls.length > 0) {
    return manifest.pageImageUrls.map((url, i) => ({
      pageNumber: i + 1,
      imageUrl: url,
    }));
  }
  return [];
}

export default function LibraryReaderPage() {
  const router = useRouter();
  const params = useParams<{ id: string; itemId: string }>();
  const channelId = String(params.id ?? "");
  const initialItemId = String(params.itemId ?? "");

  // ── Data state ──────────────────────────────────────────────────────────────
  const [currentItemId, setCurrentItemId] = useState(initialItemId);
  const [itemDetail, setItemDetail] = useState<LibraryItemDetail | null>(null);
  const [manifest, setManifest] = useState<ReaderManifest | null>(null);
  const [bookmarks, setBookmarks] = useState<LibraryBookmark[]>([]);
  const [recommendations, setRecommendations] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProgress, setSavingProgress] = useState(false);

  // ── Reader UI state ─────────────────────────────────────────────────────────
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [showCompletionSheet, setShowCompletionSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false);
  const [zoom, setZoom] = useState(1.0);

  // ── Mobile state ─────────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePageIdx, setMobilePageIdx] = useState(0);
  const [mobileFadeKey, setMobileFadeKey] = useState(0);

  // ── Flip animation state ────────────────────────────────────────────────────
  const [flipPhase, setFlipPhase] = useState<FlipPhase>("idle");
  const [flipDir, setFlipDir] = useState<"next" | "prev">("next");
  const [pendingSpreadIndex, setPendingSpreadIndex] = useState(0);

  const saveProgressTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const flipTimerRef = useRef<number | null>(null);
  const flipRafRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const prevMobilePagesLenRef = useRef(0);

  // ── Derived data ────────────────────────────────────────────────────────────
  const pages = useMemo(() => normalizePages(manifest), [manifest]);

  const spreads = useMemo(() => {
    if (manifest?.spreads?.length) return manifest.spreads;
    const total = itemDetail?.item?.totalPages ?? pages.length;
    return buildFallbackSpreads(total);
  }, [manifest?.spreads, itemDetail?.item?.totalPages, pages.length]);

  const pagesByNumber = useMemo(() => {
    const map = new Map<number, ReaderPage>();
    for (const p of pages) map.set(p.pageNumber, p);
    return map;
  }, [pages]);

  // Mobile: flat ordered page list from all spreads
  const allMobilePages = useMemo(() => {
    const result: Array<{ pageNumber: number; imageUrl: string }> = [];
    for (const spread of spreads) {
      if (spread.leftPageNumber != null) {
        const p = pagesByNumber.get(spread.leftPageNumber);
        result.push({ pageNumber: spread.leftPageNumber, imageUrl: p?.imageUrl ?? "" });
      }
      if (spread.rightPageNumber != null) {
        const p = pagesByNumber.get(spread.rightPageNumber);
        result.push({ pageNumber: spread.rightPageNumber, imageUrl: p?.imageUrl ?? "" });
      }
    }
    return result;
  }, [spreads, pagesByNumber]);

  const currentMobilePage = allMobilePages[mobilePageIdx] ?? null;
  const mobileHasPrev = mobilePageIdx > 0;
  const mobileHasNext = mobilePageIdx < allMobilePages.length - 1;

  const currentSpread = useMemo(
    () => spreads[currentSpreadIndex] ?? { spreadIndex: 0, leftPageNumber: null, rightPageNumber: null },
    [spreads, currentSpreadIndex]
  );
  const pendingSpread = useMemo(
    () => spreads[pendingSpreadIndex] ?? { spreadIndex: 0, leftPageNumber: null, rightPageNumber: null },
    [spreads, pendingSpreadIndex]
  );

  const getPage = (n: number | null | undefined) =>
    n != null ? (pagesByNumber.get(n) ?? null) : null;

  const curLeft  = getPage(currentSpread.leftPageNumber);
  const curRight = getPage(currentSpread.rightPageNumber);
  const penLeft  = getPage(pendingSpread.leftPageNumber);
  const penRight = getPage(pendingSpread.rightPageNumber);

  const pdfUrl        = manifest?.pdfUrl ?? null;
  const hasImagePages = pages.length > 0;
  const hasPrev       = currentSpreadIndex > 0;
  const hasNext       = currentSpreadIndex < spreads.length - 1;
  const isFlipping    = flipPhase !== "idle";

  // ── Trigger CSS transition one paint after "ready" ──────────────────────────
  useEffect(() => {
    if (flipPhase === "ready") {
      const outer = requestAnimationFrame(() => {
        flipRafRef.current = requestAnimationFrame(() => setFlipPhase("animating"));
      });
      return () => {
        cancelAnimationFrame(outer);
        if (flipRafRef.current) cancelAnimationFrame(flipRafRef.current);
      };
    }
  }, [flipPhase]);

  // ── Toast ───────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  // ── Load reader data ────────────────────────────────────────────────────────
  const loadReaderData = useCallback(async (itemId: string) => {
    setLoading(true);
    setShowCompletionSheet(false);
    setFlipPhase("idle");

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

    let startSpread = 0;
    if (progressRes.ok && "data" in progressRes.data) {
      startSpread = Math.max(0, progressRes.data.data.currentSpreadIndex ?? 0);
    } else if (detail.progress) {
      startSpread = Math.max(0, detail.progress.currentSpreadIndex ?? 0);
    }
    setCurrentSpreadIndex(startSpread);
    setPendingSpreadIndex(startSpread);

    setBookmarks(bookmarksRes.ok && "data" in bookmarksRes.data ? bookmarksRes.data.data ?? [] : []);

    if (manifestRes.ok && "data" in manifestRes.data) {
      try {
        const mJson = await fetch(manifestRes.data.data.manifestUrl, { cache: "no-store" }).then((r) => r.json());
        setManifest(mJson as ReaderManifest);
      } catch { setManifest(null); }
    } else {
      setManifest(null);
    }

    setLoading(false);
  }, [channelId, showToast]);

  useEffect(() => {
    if (!channelId || !currentItemId) return;
    const t = window.setTimeout(() => void loadReaderData(currentItemId), 0);
    return () => window.clearTimeout(t);
  }, [channelId, currentItemId, loadReaderData]);

  // ── Auto-save progress ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!channelId || !currentItemId || spreads.length === 0) return;
    if (saveProgressTimerRef.current) window.clearTimeout(saveProgressTimerRef.current);
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
    return () => { if (saveProgressTimerRef.current) window.clearTimeout(saveProgressTimerRef.current); };
  }, [channelId, currentItemId, currentSpreadIndex, spreads]);

  useEffect(() => {
    return () => {
      if (saveProgressTimerRef.current) window.clearTimeout(saveProgressTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
      if (flipRafRef.current) cancelAnimationFrame(flipRafRef.current);
    };
  }, []);

  // ── Mobile detection ──────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Preload adjacent spread images ────────────────────────────────────────────
  useEffect(() => {
    if (!hasImagePages) return;
    const urls: string[] = [];
    for (let i = Math.max(0, currentSpreadIndex - 1); i <= Math.min(spreads.length - 1, currentSpreadIndex + 2); i++) {
      const s = spreads[i];
      if (!s) continue;
      [s.leftPageNumber, s.rightPageNumber].forEach((pn) => {
        if (pn == null) return;
        const p = pagesByNumber.get(pn);
        if (p?.imageUrl) urls.push(p.imageUrl);
      });
    }
    urls.forEach((url) => { const img = new window.Image(); img.src = url; });
  }, [currentSpreadIndex, spreads, pagesByNumber, hasImagePages]);

  // ── Sync mobile page index when pages first load ──────────────────────────────
  useEffect(() => {
    if (prevMobilePagesLenRef.current === 0 && allMobilePages.length > 0) {
      const spread = spreads[currentSpreadIndex];
      const targetPage = spread?.leftPageNumber ?? spread?.rightPageNumber;
      if (targetPage != null) {
        const idx = allMobilePages.findIndex((p) => p.pageNumber === targetPage);
        if (idx >= 0) setMobilePageIdx(idx);
      }
    }
    prevMobilePagesLenRef.current = allMobilePages.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMobilePages]);

  // ── Flip trigger ─────────────────────────────────────────────────────────────
  const triggerFlip = useCallback((direction: "next" | "prev", targetIdx: number) => {
    if (isFlipping) return;
    setFlipDir(direction);
    setPendingSpreadIndex(targetIdx);
    setFlipPhase("ready");
    if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
    flipTimerRef.current = window.setTimeout(() => {
      setCurrentSpreadIndex(targetIdx);
      setFlipPhase("idle");
    }, 520);
  }, [isFlipping]);

  // A "single-page" spread has exactly one side populated (e.g. the cover = page 1
  // on the right with a blank left). These are shown as one centered page.
  const isSinglePageSpread = useCallback(
    (s?: ReaderSpread | null) =>
      !!s && (s.leftPageNumber == null) !== (s.rightPageNumber == null),
    []
  );

  // Switch spreads: use the 3D flip between full two-page spreads, but cut directly
  // (no flip) when either side of the transition is a single-page spread, since the
  // single page and the two-page book have different layouts.
  const advanceTo = useCallback(
    (direction: "next" | "prev", targetIdx: number) => {
      if (isFlipping) return;
      if (isSinglePageSpread(spreads[currentSpreadIndex]) || isSinglePageSpread(spreads[targetIdx])) {
        setCurrentSpreadIndex(targetIdx);
        setPendingSpreadIndex(targetIdx);
        return;
      }
      triggerFlip(direction, targetIdx);
    },
    [isFlipping, isSinglePageSpread, spreads, currentSpreadIndex, triggerFlip]
  );

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = useCallback(async () => {
    if (isFlipping) return;
    if (hasNext) { advanceTo("next", currentSpreadIndex + 1); return; }
    const nextId = itemDetail?.navigation?.nextItemId;
    if (nextId) { showToast("Up next in this series…"); setCurrentItemId(nextId); return; }
    const recRes = await getChannelLibraryRecommendationsApi(channelId, 6);
    if (recRes.ok && "data" in recRes.data) setRecommendations(recRes.data.data ?? []);
    setShowCompletionSheet(true);
  }, [isFlipping, hasNext, advanceTo, currentSpreadIndex, itemDetail?.navigation?.nextItemId, channelId, showToast]);

  const goPrev = useCallback(() => {
    if (isFlipping || !hasPrev) return;
    advanceTo("prev", currentSpreadIndex - 1);
  }, [isFlipping, hasPrev, advanceTo, currentSpreadIndex]);

  // ── Bookmarks ─────────────────────────────────────────────────────────────────
  const addBookmark = useCallback(async () => {
    const res = await createChannelLibraryBookmarkApi(channelId, currentItemId, {
      spreadIndex: currentSpreadIndex,
      page: currentSpread.rightPageNumber ?? currentSpread.leftPageNumber ?? 1,
      note: "",
    });
    if (!res.ok || !("data" in res)) return;
    const bookmark = (res as unknown as { data: LibraryBookmark }).data;
    setBookmarks((prev) => [bookmark, ...prev]);
    showToast("Bookmark saved ✓");
  }, [channelId, currentItemId, currentSpread, currentSpreadIndex, showToast]);

  const deleteBookmark = useCallback(async (id: string) => {
    const res = await deleteChannelLibraryBookmarkApi(channelId, currentItemId, id);
    if (res.ok) { setBookmarks((prev) => prev.filter((b) => b.id !== id)); showToast("Bookmark removed"); }
  }, [channelId, currentItemId, showToast]);

  const jumpToBookmark = useCallback((spreadIndex: number) => {
    const t = Math.max(0, Math.min(spreadIndex, spreads.length - 1));
    setCurrentSpreadIndex(t); setPendingSpreadIndex(t); setShowBookmarksPanel(false);
  }, [spreads.length]);

  const saveSession = useCallback(async () => {
    if (!channelId || !currentItemId) return;
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
    showToast("Session saved ✓");
  }, [channelId, currentItemId, currentSpreadIndex, spreads, showToast]);

  // ── Mobile navigation ─────────────────────────────────────────────────────────
  const mobileGoNext = useCallback(async () => {
    if (mobileHasNext) {
      const nextIdx = mobilePageIdx + 1;
      const nextPage = allMobilePages[nextIdx];
      if (nextPage) {
        const sIdx = spreads.findIndex(
          (s) => s.leftPageNumber === nextPage.pageNumber || s.rightPageNumber === nextPage.pageNumber
        );
        if (sIdx >= 0 && sIdx !== currentSpreadIndex) setCurrentSpreadIndex(sIdx);
      }
      setMobilePageIdx(nextIdx);
      setMobileFadeKey((k) => k + 1);
      return;
    }
    const nextId = itemDetail?.navigation?.nextItemId;
    if (nextId) { showToast("Up next in this series…"); setCurrentItemId(nextId); return; }
    const recRes = await getChannelLibraryRecommendationsApi(channelId, 6);
    if (recRes.ok && "data" in recRes.data) setRecommendations(recRes.data.data ?? []);
    setShowCompletionSheet(true);
  }, [mobileHasNext, mobilePageIdx, allMobilePages, spreads, currentSpreadIndex, itemDetail?.navigation?.nextItemId, channelId, showToast]);

  const mobileGoPrev = useCallback(() => {
    if (!mobileHasPrev) return;
    const prevIdx = mobilePageIdx - 1;
    const prevPage = allMobilePages[prevIdx];
    if (prevPage) {
      const sIdx = spreads.findIndex(
        (s) => s.leftPageNumber === prevPage.pageNumber || s.rightPageNumber === prevPage.pageNumber
      );
      if (sIdx >= 0 && sIdx !== currentSpreadIndex) setCurrentSpreadIndex(sIdx);
    }
    setMobilePageIdx(prevIdx);
    setMobileFadeKey((k) => k + 1);
  }, [mobileHasPrev, mobilePageIdx, allMobilePages, spreads, currentSpreadIndex]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowRight": case " ": e.preventDefault(); void goNext(); break;
        case "ArrowLeft":            e.preventDefault(); goPrev();       break;
        case "Escape":  router.push(`/channel/${channelId}`);            break;
        case "+": case "=": setZoom((z) => Math.min(z + 0.2, 3));       break;
        case "-":           setZoom((z) => Math.max(z - 0.2, 0.4));     break;
        case "b": case "B": void addBookmark();                          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, router, channelId, addBookmark]);

  // ── Page-slot renderer ────────────────────────────────────────────────────────
  function renderSlot(
    page: ReaderPage | null,
    pageNum: number | null | undefined,
    side: "left" | "right",
    bg = "#faf4e8"
  ) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: bg }}>
        {page?.imageUrl ? (
          <img src={page.imageUrl} alt={`Page ${page.pageNumber}`}
            className="h-full w-full object-contain" loading="eager" decoding="async" draggable={false} />
        ) : pageNum != null ? (
          <div className="flex flex-col items-center gap-1.5 opacity-35">
            <div className="text-3xl text-[#9a8a7a]">{side === "left" ? "◀" : "▶"}</div>
            <div className="text-[11px] font-mono text-[#9a8a7a]">Page {pageNum}</div>
          </div>
        ) : (
          <div className="text-3xl text-[#c4b8a8] opacity-20">{side === "left" ? "◀" : "▶"}</div>
        )}
      </div>
    );
  }

  const flipTransform =
    flipPhase === "animating"
      ? flipDir === "next" ? "rotateY(-180deg)" : "rotateY(180deg)"
      : "rotateY(0deg)";

  // At rest, the cover (and any trailing odd page) is shown as one centered page
  // rather than a two-page book with a blank half.
  const showSingleCover = !isFlipping && isSinglePageSpread(currentSpread);
  const singleCoverPage = curRight ?? curLeft;
  const singleCoverNum  = currentSpread.rightPageNumber ?? currentSpread.leftPageNumber;

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#08091a] overflow-hidden">
      <style>{`@keyframes mobileFadeIn { from { opacity:0; transform:scale(0.985); } to { opacity:1; transform:scale(1); } }`}</style>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 h-12 items-center gap-2 border-b border-white/[0.07] bg-[#08091a]/98 px-3 sm:px-4 backdrop-blur-sm z-10">
        <button onClick={() => router.push(`/channel/${channelId}`)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#F5C16C] hover:bg-white/6 transition-colors shrink-0">
          ← Back
        </button>
        <div className="flex-1 min-w-0 hidden sm:block">
          <p className="truncate text-sm font-bold text-white leading-tight">{itemDetail?.item?.title ?? ""}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs text-[#F5C16C] shrink-0">
          {isMobile ? (
            <>
              <span className="font-semibold text-white">{allMobilePages.length > 0 ? mobilePageIdx + 1 : 1}</span>
              <span className="opacity-40">/</span>
              <span>{Math.max(allMobilePages.length, 1)}</span>
            </>
          ) : (
            <>
              <span className="font-semibold text-white">{Math.min(currentSpreadIndex + 1, Math.max(spreads.length, 1))}</span>
              <span className="opacity-40">/</span>
              <span>{Math.max(spreads.length, 1)}</span>
            </>
          )}
        </div>
        {/* Zoom */}
        <div className="flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5 shrink-0">
          <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))} disabled={zoom <= 0.41}
            className="flex h-7 w-7 items-center justify-center rounded text-base font-bold text-[#F5C16C] hover:bg-white/10 disabled:opacity-25 transition-colors" title="Zoom out (−)">−</button>
          <button onClick={() => setZoom(1)}
            className="w-10 text-center text-[10px] text-[#F5C16C]/60 hover:text-[#F5C16C] transition-colors" title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom((z) => Math.min(z + 0.2, 3))} disabled={zoom >= 2.99}
            className="flex h-7 w-7 items-center justify-center rounded text-base font-bold text-[#F5C16C] hover:bg-white/10 disabled:opacity-25 transition-colors" title="Zoom in (+)">+</button>
        </div>
        {/* Bookmark */}
        <button onClick={() => void addBookmark()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-[#F5C16C] hover:bg-white/10 transition-colors shrink-0" title="Bookmark this spread (B)">
          🔖
        </button>
        {/* Save session */}
        <button onClick={() => void saveSession()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-[#F5C16C] hover:bg-white/10 transition-colors shrink-0" title="Save reading session">
          {savingProgress
            ? <span className="h-3.5 w-3.5 rounded-full border-2 border-[#F5C16C] border-t-transparent animate-spin" />
            : "💾"}
        </button>
        {/* Bookmarks panel toggle */}
        <button onClick={() => setShowBookmarksPanel((v) => !v)}
          className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors shrink-0 ${showBookmarksPanel ? "bg-[#F49617]/20 text-[#F49617]" : "text-[#F5C16C] hover:bg-white/10"}`}
          title="Bookmarks">
          📚
          {bookmarks.length > 0 && (
            <span className="rounded-full bg-[#F49617] px-1 py-0.5 text-[10px] font-bold text-[#050A30] leading-none">{bookmarks.length}</span>
          )}
        </button>
      </header>

      {/* ── READING AREA ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {loading || !itemDetail ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full border-2 border-[#F49617] border-t-transparent animate-spin" />
              <p className="text-sm text-[#F5C16C]/50">Opening your book…</p>
            </div>
          </div>
        ) : !hasImagePages && pdfUrl ? (
          <div className="h-full w-full p-2">
            <iframe src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`} title="Reader PDF"
              className="h-full w-full rounded-xl border border-white/10" />
          </div>
        ) : (
          /* ── READER ──────────────────────────────────────────────── */
          isMobile ? (
            /* ── MOBILE: SINGLE-PAGE ────────────────────────────── */
            <div
              className="relative flex h-full w-full items-center justify-center select-none overflow-hidden"
              style={{ background: "#0e0a04", touchAction: "pan-y" }}
              onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (touchStartXRef.current == null) return;
                const dx = e.changedTouches[0].clientX - touchStartXRef.current;
                touchStartXRef.current = null;
                if (dx < -45) void mobileGoNext();
                else if (dx > 45) mobileGoPrev();
              }}
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const x = e.clientX - rect.left;
                if (x < rect.width * 0.28) mobileGoPrev();
                else if (x > rect.width * 0.72) void mobileGoNext();
              }}
            >
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.18s ease" }}
              >
                {currentMobilePage?.imageUrl ? (
                  <img
                    key={mobileFadeKey}
                    src={currentMobilePage.imageUrl}
                    alt={`Page ${currentMobilePage.pageNumber}`}
                    className="max-h-full max-w-full object-contain"
                    style={{ animation: "mobileFadeIn 0.2s ease-out" }}
                    loading="eager"
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <div className="text-white/25 text-sm">No page content</div>
                )}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-14 flex items-center justify-start pl-3" style={{ opacity: mobileHasPrev ? 0.22 : 0.06 }}>
                <span className="text-3xl text-white">‹</span>
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-14 flex items-center justify-end pr-3" style={{ opacity: 0.22 }}>
                <span className="text-3xl text-white">›</span>
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/18 pointer-events-none whitespace-nowrap">
                ← swipe or tap edges →
              </div>
            </div>
          ) : (
            /* ── DESKTOP: SPREAD WITH 3D FLIP ──────────────────── */
            <div className="flex h-full w-full items-center justify-center" style={{ perspective: "2800px" }}>
              {/* Prev arrow */}
              <button onClick={goPrev} disabled={!hasPrev || isFlipping}
                className="absolute left-2 top-1/2 z-20 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 text-2xl font-bold text-[#F5C16C] hover:bg-black/60 hover:border-[#F49617]/40 disabled:opacity-20 transition-all shadow-2xl backdrop-blur-sm"
                title="Previous spread (←)">‹</button>

              {/* Zoomable book */}
              <div className="relative flex items-center justify-center"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.18s ease" }}>
                {/* Ambient glow */}
                <div className="pointer-events-none absolute -inset-10 -z-10">
                  <div className="absolute inset-0 rounded-3xl bg-[#F49617]/5 blur-3xl" />
                  <div className="absolute bottom-0 left-1/2 h-14 w-4/5 -translate-x-1/2 rounded-full bg-black/70 blur-3xl" />
                </div>

                {showSingleCover ? (
                  /* ── SINGLE COVER PAGE (e.g. page 1 before the spread begins) ── */
                  <div
                    key={`cover-${currentSpreadIndex}`}
                    className="relative overflow-hidden rounded-xl shadow-[0_32px_120px_rgba(0,0,0,0.9)]"
                    style={{
                      height: "min(76vh,800px)", aspectRatio: "1/1.41",
                      border: "1px solid rgba(196,168,130,0.12)", background: "#fffbf3",
                      animation: "mobileFadeIn 0.25s ease-out",
                    }}
                  >
                    {singleCoverPage?.imageUrl ? (
                      <img src={singleCoverPage.imageUrl} alt={`Page ${singleCoverNum ?? 1}`}
                        className="h-full w-full object-contain" loading="eager" decoding="async" draggable={false} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="flex flex-col items-center gap-1.5 opacity-35">
                          <div className="text-[11px] font-mono text-[#9a8a7a]">Page {singleCoverNum ?? 1}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                /* Book spread — overflow:visible so the flip card can swing past the spine */
                <div
                  className="relative overflow-visible rounded-xl shadow-[0_32px_120px_rgba(0,0,0,0.9)]"
                  style={{ height: "min(76vh,800px)", aspectRatio: "2/1.41", border: "1px solid rgba(196,168,130,0.12)" }}
                >
                  {/* LEFT HALF BASE */}
                  <div className="absolute left-0 top-0 h-full w-1/2 overflow-hidden rounded-l-xl" style={{ background: "#faf4e8" }}>
                    {renderSlot(
                      isFlipping && flipDir === "prev" ? penLeft : curLeft,
                      isFlipping && flipDir === "prev" ? pendingSpread.leftPageNumber : currentSpread.leftPageNumber,
                      "left", "#faf4e8"
                    )}
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/15 via-black/4 to-transparent z-[5]" />
                  </div>

                  {/* RIGHT HALF BASE */}
                  <div className="absolute right-0 top-0 h-full w-1/2 overflow-hidden rounded-r-xl" style={{ background: "#fffbf3" }}>
                    {renderSlot(
                      isFlipping && flipDir === "next" ? penRight : curRight,
                      isFlipping && flipDir === "next" ? pendingSpread.rightPageNumber : currentSpread.rightPageNumber,
                      "right", "#fffbf3"
                    )}
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/15 via-black/4 to-transparent z-[5]" />
                  </div>

                  {/* SPINE */}
                  <div className="absolute left-1/2 top-0 bottom-0 z-[6] w-[2px] -translate-x-1/2 bg-gradient-to-b from-[#c4a882]/8 via-[#c4a882]/45 to-[#c4a882]/8 shadow-[0_0_10px_rgba(196,168,130,0.25)]" />

                  {/* FLIP CARD — at book level (not inside a half), so it swings freely over the spine */}
                  {isFlipping && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: flipDir === "next" ? "50%" : "0%",
                        width: "50%",
                        height: "100%",
                        transformOrigin: flipDir === "next" ? "left center" : "right center",
                        transform: flipTransform,
                        transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)",
                        transformStyle: "preserve-3d",
                        willChange: "transform",
                        zIndex: 15,
                      }}
                    >
                      {/* Front face */}
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{
                          backfaceVisibility: "hidden",
                          background: flipDir === "next" ? "#fffbf3" : "#faf4e8",
                        }}
                      >
                        {renderSlot(
                          flipDir === "next" ? curRight : curLeft,
                          flipDir === "next" ? currentSpread.rightPageNumber : currentSpread.leftPageNumber,
                          flipDir === "next" ? "right" : "left",
                          flipDir === "next" ? "#fffbf3" : "#faf4e8"
                        )}
                        <div
                          className="pointer-events-none absolute inset-y-0 w-5 z-[5]"
                          style={{
                            ...(flipDir === "next" ? { left: 0 } : { right: 0 }),
                            background: flipDir === "next"
                              ? "linear-gradient(to right,rgba(0,0,0,0.28),transparent)"
                              : "linear-gradient(to left,rgba(0,0,0,0.28),transparent)",
                          }}
                        />
                      </div>
                      {/* Back face */}
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                          background: flipDir === "next" ? "#faf4e8" : "#fffbf3",
                        }}
                      >
                        {renderSlot(
                          flipDir === "next" ? penLeft : penRight,
                          flipDir === "next" ? pendingSpread.leftPageNumber : pendingSpread.rightPageNumber,
                          flipDir === "next" ? "left" : "right",
                          flipDir === "next" ? "#faf4e8" : "#fffbf3"
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mid-flip shadow sweep */}
                  {isFlipping && (
                    <div
                      className={`pointer-events-none absolute inset-y-0 z-[8] w-1/4 ${flipDir === "next" ? "right-1/2" : "left-1/2"}`}
                      style={{ background: flipDir === "next" ? "linear-gradient(to left,rgba(0,0,0,0.12),transparent)" : "linear-gradient(to right,rgba(0,0,0,0.12),transparent)" }}
                    />
                  )}
                </div>
                )}
              </div>

              {/* Next arrow */}
              <button onClick={() => void goNext()} disabled={isFlipping}
                className="absolute right-2 top-1/2 z-20 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 text-2xl font-bold text-[#F5C16C] hover:bg-black/60 hover:border-[#F49617]/40 disabled:opacity-40 transition-all shadow-2xl backdrop-blur-sm"
                title="Next spread (→)">›</button>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/18 pointer-events-none whitespace-nowrap hidden sm:block">
                ← → arrows&nbsp;•&nbsp;B bookmark&nbsp;•&nbsp;+/− zoom&nbsp;•&nbsp;Esc exit
              </div>
            </div>
          )
        )}

        {/* ── BOOKMARKS PANEL ──────────────────────────────────────── */}
        <aside className={`absolute right-0 top-0 bottom-0 z-30 w-72 border-l border-white/8 bg-[#0a0b1e]/97 backdrop-blur-md transition-transform duration-300 ${showBookmarksPanel ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Bookmarks</h3>
            <button onClick={() => setShowBookmarksPanel(false)}
              className="h-6 w-6 text-[#F5C16C]/50 hover:text-[#F5C16C] text-xl leading-none flex items-center justify-center transition-colors">×</button>
          </div>
          <div className="overflow-y-auto h-full p-3 pb-20 space-y-2">
            <button onClick={() => void addBookmark()}
              className="w-full rounded-lg border border-[#F49617]/30 bg-[#F49617]/8 px-3 py-2 text-xs font-semibold text-[#F5C16C] hover:bg-[#F49617]/15 transition-colors">
              + Bookmark spread {currentSpreadIndex + 1}
            </button>
            {bookmarks.length === 0 ? (
              <p className="mt-8 text-center text-xs text-white/25">No bookmarks yet.</p>
            ) : bookmarks.map((bm) => (
              <div key={bm.id} className="rounded-lg border border-white/8 bg-white/3 p-2.5">
                <button onClick={() => jumpToBookmark(bm.spreadIndex)}
                  className="w-full text-left text-xs font-medium text-white hover:text-[#F5C16C] transition-colors">
                  Spread {bm.spreadIndex + 1}{bm.page ? ` · Page ${bm.page}` : ""}
                </button>
                <button onClick={() => void deleteBookmark(bm.id)}
                  className="mt-1 text-[11px] text-white/30 hover:text-red-400 transition-colors">Remove</button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ── BOTTOM NAVIGATION BAR ─────────────────────────────────────────── */}
      {!loading && itemDetail && hasImagePages && (
        <footer className="shrink-0 flex h-14 items-center justify-between gap-3 border-t border-white/[0.07] bg-[#08091a]/98 px-4 backdrop-blur-sm z-10">
          <button
            onClick={isMobile ? mobileGoPrev : goPrev}
            disabled={isMobile ? !mobileHasPrev : (!hasPrev || isFlipping)}
            className="rounded-xl border border-white/12 px-4 sm:px-5 py-2 text-xs font-semibold text-white hover:border-[#F49617]/40 hover:text-[#F5C16C] disabled:opacity-25 transition-all">
            ← Previous
          </button>
          <div className="flex flex-col items-center gap-1 min-w-0">
            {isMobile ? (
              <>
                <div className="text-xs text-white/55">
                  Page <span className="font-bold text-white">{allMobilePages.length > 0 ? mobilePageIdx + 1 : 1}</span> of {Math.max(allMobilePages.length, 1)}
                </div>
                <div className="h-1 w-28 sm:w-48 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#F49617] to-[#F5C16C] transition-all duration-300"
                    style={{ width: `${allMobilePages.length > 0 ? ((mobilePageIdx + 1) / allMobilePages.length) * 100 : 0}%` }} />
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-white/55">
                  Spread <span className="font-bold text-white">{Math.min(currentSpreadIndex + 1, Math.max(spreads.length, 1))}</span> of {Math.max(spreads.length, 1)}
                </div>
                <div className="h-1 w-28 sm:w-48 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#F49617] to-[#F5C16C] transition-all duration-400"
                    style={{ width: `${spreads.length > 0 ? ((currentSpreadIndex + 1) / spreads.length) * 100 : 0}%` }} />
                </div>
              </>
            )}
          </div>
          <button
            onClick={isMobile ? () => void mobileGoNext() : () => void goNext()}
            disabled={isMobile ? false : isFlipping}
            className="rounded-xl bg-gradient-to-r from-[#F49617] to-[#F5C16C] px-4 sm:px-5 py-2 text-xs font-bold text-[#050A30] hover:opacity-90 disabled:opacity-40 transition-opacity">
            {isMobile ? (mobileHasNext ? "Next →" : "Finish ✓") : (hasNext ? "Next →" : "Finish ✓")}
          </button>
        </footer>
      )}

      {/* ── COMPLETION SHEET ─────────────────────────────────────────────── */}
      {showCompletionSheet && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#050A30]/90 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c0d22] p-6 shadow-2xl">
            <div className="text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-lg font-bold text-white">You finished this item!</h3>
              <p className="mt-1 text-sm text-[#F5C16C]/70">
                {recommendations.length > 0 ? "Continue with something you might enjoy:" : "Explore more in this channel."}
              </p>
            </div>
            {recommendations.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {recommendations.slice(0, 4).map((rec) => (
                  <button key={rec.id} onClick={() => { setShowCompletionSheet(false); setCurrentItemId(rec.id); }}
                    className="rounded-xl border border-white/10 bg-white/3 p-3 text-left hover:border-[#F49617]/40 transition-colors">
                    <p className="truncate text-xs font-semibold text-white">{rec.title}</p>
                    <p className="truncate text-[11px] text-[#F5C16C]/60">{rec.author}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowCompletionSheet(false)}
                className="flex-1 rounded-xl border border-white/12 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors">
                Keep Reading
              </button>
              <button onClick={() => router.push(`/channel/${channelId}`)}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#F49617] to-[#F5C16C] py-2.5 text-xs font-bold text-[#050A30]">
                Back to Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#F49617]/30 bg-[#0c0d22]/95 px-5 py-2.5 text-xs font-medium text-[#F5C16C] shadow-2xl backdrop-blur-md pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}