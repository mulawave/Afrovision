/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  getWaveFeedApi,
  addWavePulseApi,
  toggleWaveBookmarkApi,
  setWaveInterestApi,
  reportWaveApi,
  getWaveCommentsApi,
  postWaveCommentApi,
  getWavePulseMomentsApi,
  getChannelWavesApi,
  getChannelApi,
  getChannelLibraryApi,
  getChannelFollowStatusApi,
  getChannelLibraryItemDetailApi,
  trackWaveViewApi,
  type Wave,
  type WaveComment,
  type WavePulseMoment,
  type Channel,
  type LibraryItem,
  type LibraryItemDetail,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

// -- Helpers ----------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// -- SVG Icons (encoding-safe, no emoji) ------------------------------------

function IcoPlay() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z"/></svg>;
}
function IcoPulse() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>;
}
function IcoComment() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>;
}
function IcoBookmark({ filled }: { filled?: boolean }) {
  return filled
    ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>;
}
function IcoDots() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>;
}
function IcoExpand() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>;
}
function IcoCompress() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>;
}
function IcoRepeat() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>;
}
function IcoPause() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
}
function IcoThumbUp() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/></svg>;
}
function IcoThumbDown() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1.91l.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>;
}
function IcoFlag() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/></svg>;
}
function IcoCheck() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>;
}
function IcoClose() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>;
}
function IcoChevronUp() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>;
}
function IcoChevronDown() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>;
}
function IcoLock() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>;
}
function IcoWave() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 opacity-30"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>;
}
function IcoEye() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>;
}

function channelTypeBadge(channel: Channel): { label: string; color: string } {
  if (channel.type === "exclusive") return { label: "EXCLUSIVE", color: "#F49617" };
  if (channel.is_premium_channel) return { label: "PREMIUM", color: "#a855f7" };
  if (channel.type === "private") return { label: "PRIVATE", color: "#60a5fa" };
  return { label: "PUBLIC", color: "#34d399" };
}

// -- ECG Pulse Timeline -----------------------------------------------------

function WavePulseTimeline({
  duration,
  moments,
  currentTime,
  onSeek,
}: {
  duration: number;
  moments: WavePulseMoment[];
  currentTime: number;
  onSeek: (t: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maxIntensity = Math.max(1, ...moments.map((m) => m.intensity_sum));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const midY = H * 0.6;
    const dur = duration || 1;

    const map: Record<number, number> = {};
    moments.forEach((m) => { map[m.second] = m.intensity_sum; });

    // ECG baseline
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();

    // ECG spikes
    ctx.beginPath();
    ctx.strokeStyle = "#F49617";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#F49617";
    ctx.shadowBlur = 5;
    for (let px = 0; px < W; px++) {
      const sec = Math.floor((px / W) * dur);
      const intensity = map[sec] || 0;
      const spike = intensity > 0 ? (intensity / maxIntensity) * (H * 0.5) : 0;
      const y = midY - spike;
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.lineTo(W, midY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Played region tint
    if (duration > 0) {
      const playedPx = (currentTime / duration) * W;
      ctx.fillStyle = "rgba(244,150,23,0.08)";
      ctx.fillRect(0, 0, playedPx, H);
      // Playhead
      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 6;
      ctx.moveTo(playedPx, 0);
      ctx.lineTo(playedPx, H);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [duration, moments, currentTime, maxIntensity]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
    >
      <div className="flex justify-between items-center px-2 pt-1.5">
        <span className="text-[11px] font-mono text-white/70">{formatTime(currentTime)}</span>
        <span className="text-[10px] text-white/35 tracking-widest">ECG PULSE</span>
        <span className="text-[11px] font-mono text-white/70">{formatTime(duration)}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={38}
        className="w-full cursor-pointer"
        style={{ imageRendering: "crisp-edges" }}
        onClick={handleClick}
      />
    </div>
  );
}

// -- Pulsing Next-Wave Border ----------------------------------------------

function PulsingNextBorder() {
  return (
    <div
      className="absolute inset-0 rounded-lg pointer-events-none overflow-hidden"
      style={{ zIndex: 10 }}
    >
      {/* Rotating conic gradient sweep */}
      <div
        className="wave-next-border absolute"
        style={{
          inset: "-50%",
          background:
            "conic-gradient(transparent 0deg, transparent 260deg, rgba(255,255,255,0.25) 300deg, rgba(255,255,255,0.9) 340deg, transparent 360deg)",
        }}
      />
      {/* Solid border outline */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{ border: "2px solid rgba(255,255,255,0.55)", boxShadow: "0 0 10px 2px rgba(255,255,255,0.2)" }}
      />
    </div>
  );
}

// -- Wave Grid Tile ---------------------------------------------------------

function WaveGridTile({
  wave,
  isActive,
  isNext,
  onClick,
}: {
  wave: Wave;
  isActive: boolean;
  isNext: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-[1.03] focus:outline-none"
      style={{
        aspectRatio: "9 / 16",
        background: "#0A1040",
        border: isActive ? "2px solid #F49617" : "1.5px solid transparent",
        backgroundImage: isActive ? "none" : "linear-gradient(#0A1040, #0A1040), linear-gradient(160deg, #F5C16C, #F49617, #173A6D)",
        backgroundOrigin: isActive ? "border-box" : "border-box",
        backgroundClip: isActive ? "border-box" : "padding-box, border-box",
        boxShadow: isActive ? "0 0 12px 2px rgba(244,150,23,0.45)" : "none",
      }}
    >
      {wave.thumbnail_url ? (
        <img src={wave.thumbnail_url} alt={wave.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <video
          src={`${wave.video_url}#t=0.1`}
          muted
          preload="metadata"
          playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      )}

      {isNext && <PulsingNextBorder />}

      {isNext && (
        <div
          className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider"
          style={{ background: "rgba(255,255,255,0.15)", color: "#fff", backdropFilter: "blur(4px)" }}
        >
          NEXT
        </div>
      )}
      {isActive && (
        <div
          className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider"
          style={{ background: "rgba(244,150,23,0.85)", color: "#fff" }}
        >
          PLAYING
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5 pt-4 z-10"
        style={{ background: "linear-gradient(to top, rgba(5,10,48,0.9) 0%, transparent 100%)" }}
      >
        <p className="text-white text-[9px] font-medium line-clamp-2 leading-tight">{wave.title}</p>
        <p className="text-white/50 text-[8px] mt-0.5">{formatCount(wave.pulse_count)} pulses</p>
      </div>
    </button>
  );
}

// -- Channel Info Section ---------------------------------------------------

function ChannelInfoSection({
  channel,
  followersCount,
  totalReactions,
  onViewChannel,
}: {
  channel: Channel;
  followersCount: number;
  totalReactions: number;
  onViewChannel: () => void;
}) {
  const badge = channelTypeBadge(channel);
  const displayFollowers = followersCount || channel.followers_count || 0;

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0D1B3E 0%, #050A30 100%)", border: "1px solid rgba(245,193,108,0.25)" }}
    >
      {channel.banner_url && (
        <div className="absolute inset-0">
          <img src={channel.banner_url} alt="" className="w-full h-full object-cover" style={{ opacity: 0.18 }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 0%, #050A30 80%)" }} />
        </div>
      )}
      <div className="relative p-3">
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{ border: "1.5px solid rgba(245,193,108,0.6)", background: "#0A1040" }}
          >
            {channel.logo_url ? (
              <img src={channel.logo_url} alt={channel.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white/60 text-base font-bold">{channel.name[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight line-clamp-1">{channel.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded"
                style={{ background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}55` }}
              >
                {badge.label}
              </span>
              {channel.category && <span className="text-[9px] text-white/40 truncate">{channel.category}</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
          <div className="text-center">
            <p className="text-white font-bold text-sm">{formatCount(displayFollowers)}</p>
            <p className="text-white/40 text-[9px] uppercase tracking-wider">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-sm">{formatCount(totalReactions)}</p>
            <p className="text-white/40 text-[9px] uppercase tracking-wider">Pulses</p>
          </div>
        </div>
        <button
          onClick={onViewChannel}
          className="w-full py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:brightness-110"
          style={{ background: "linear-gradient(90deg, #F49617, #F5C16C)", color: "#050A30" }}
        >
          View Channel &rarr;
        </button>
      </div>
    </div>
  );
}

// -- Library Item Detail Modal ----------------------------------------------

function LibraryItemModal({
  item,
  detail,
  loading,
  channelId,
  onClose,
}: {
  item: LibraryItem;
  detail: LibraryItemDetail | null;
  loading: boolean;
  channelId: string;
  onClose: () => void;
}) {
  const contentTypeIcon: Record<string, string> = { book: "B", comic: "C", magazine: "M", other: "?" };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(5,10,48,0.92)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0D1B3E 0%, #050A30 100%)", border: "1px solid rgba(245,193,108,0.3)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-52 overflow-hidden">
          {item.coverAssetUrl ? (
            <img src={item.coverAssetUrl} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: "linear-gradient(135deg, #0D1B3E, #050A30)" }}>
              {contentTypeIcon[item.contentType] ?? "??"}
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #050A30 0%, transparent 60%)" }} />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <IcoClose />
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-2 mb-1">
            <h3 className="text-white font-bold text-base flex-1 leading-tight">{item.title}</h3>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
              style={{ background: "rgba(244,150,23,0.2)", color: "#F49617", border: "1px solid rgba(244,150,23,0.3)" }}>
              {item.contentType}
            </span>
          </div>
          {item.subtitle && <p className="text-white/50 text-xs mb-1">{item.subtitle}</p>}
          <p className="text-white/40 text-xs mb-3">by {item.author}</p>
          {item.description && <p className="text-white/70 text-xs leading-relaxed mb-3 line-clamp-3">{item.description}</p>}
          <div className="flex gap-4 mb-4">
            <div className="text-center">
              <p className="text-white font-semibold text-sm">{item.totalPages}</p>
              <p className="text-white/40 text-[9px] uppercase">Pages</p>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-sm">{item.estimatedReadMinutes}m</p>
              <p className="text-white/40 text-[9px] uppercase">Read time</p>
            </div>
            {detail?.progress && (
              <div className="text-center">
                <p className="text-white font-semibold text-sm">
                  {detail.progress.isCompleted ? <IcoCheck /> : `${item.totalPages > 0 ? Math.round(((detail.progress.currentSpreadIndex ?? 0) / item.totalPages) * 100) : 0}%`}
                </p>
                <p className="text-white/40 text-[9px] uppercase">Progress</p>
              </div>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-2">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Link
              href={`/channel/${channelId}/library/${item.id}`}
              className="block w-full py-2.5 text-center rounded-xl text-sm font-bold transition-all hover:brightness-110"
              style={{ background: "linear-gradient(90deg, #F49617, #F5C16C)", color: "#050A30" }}
            >
              {detail?.progress && !detail.progress.isCompleted ? "Continue Reading" : "Read Now"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// -- Library Section --------------------------------------------------------

function LibrarySection({
  items,
  channelId,
  isExclusive,
  hasAccess,
}: {
  items: LibraryItem[];
  channelId: string;
  isExclusive: boolean;
  hasAccess: boolean;
}) {
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [detail, setDetail] = useState<LibraryItemDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const openDetail = async (item: LibraryItem) => {
    setSelectedItem(item);
    setDetail(null);
    setLoadingDetail(true);
    const res = await getChannelLibraryItemDetailApi(channelId, item.id);
    if (res.ok && "data" in res.data) setDetail(res.data.data);
    setLoadingDetail(false);
  };

  if (isExclusive && !hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-3 text-center">
        <span className="text-2xl mb-2"><IcoLock /></span>
        <p className="text-white/50 text-xs">Library requires exclusive access</p>
        <Link href={`/channel/${channelId}/exclusive-access`} className="mt-2 text-[11px] font-semibold" style={{ color: "#F49617" }}>
          Get Access &rarr;
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-white/30 text-xs">No library items yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 px-3 py-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => openDetail(item)}
            className="w-full flex items-center gap-2.5 rounded-xl p-2 transition-all hover:brightness-110 text-left"
            style={{ background: "rgba(13,27,62,0.7)", border: "1px solid rgba(245,193,108,0.18)" }}
          >
            <div className="w-9 h-12 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "#0A1040" }}>
              {item.coverAssetUrl ? (
                <img src={item.coverAssetUrl} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-base">{item.contentType === "book" ? "B" : item.contentType === "comic" ? "C" : "M"}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold line-clamp-1">{item.title}</p>
              <p className="text-white/40 text-[10px] mt-0.5">{item.totalPages} pages &middot; {item.estimatedReadMinutes}m</p>
              <span className="inline-block text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wider mt-1"
                style={{ background: "rgba(244,150,23,0.15)", color: "#F49617" }}>
                {item.contentType}
              </span>
            </div>
            <span className="text-white/30 text-xs flex-shrink-0">&rsaquo;</span>
          </button>
        ))}
      </div>
      {selectedItem && (
        <LibraryItemModal
          item={selectedItem}
          detail={detail}
          loading={loadingDetail}
          channelId={channelId}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}

// -- Left Panel -------------------------------------------------------------

function LeftPanel({
  channelWaves,
  channelData,
  channelFollowersCount,
  totalReactions,
  libraryItems,
  libraryAccess,
  activeWaveId,
  nextWaveId,
  onSelectWave,
  onViewChannel,
}: {
  channelWaves: Wave[];
  channelData: Channel | null;
  channelFollowersCount: number;
  totalReactions: number;
  libraryItems: LibraryItem[];
  libraryAccess: boolean;
  activeWaveId: string;
  nextWaveId: string | null;
  onSelectWave: (waveId: string) => void;
  onViewChannel: () => void;
}) {
  return (
    <div
      className="hidden lg:flex flex-col w-[560px] xl:w-[640px] h-full flex-shrink-0 border-r"
      style={{ background: "linear-gradient(180deg, #0D1B3E 0%, #050A30 100%)", borderColor: "rgba(245,193,108,0.12)" }}
    >
      {/* Section 1: Channel waves grid � scrollable top */}
      <div className="flex-[2] overflow-y-auto min-h-0 px-3 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Channel Waves</h4>
          <span className="text-white/30 text-[10px]">{channelWaves.length} waves</span>
        </div>
        {channelWaves.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pb-2">
            {channelWaves.map((w) => (
              <WaveGridTile
                key={w.id}
                wave={w}
                isActive={w.id === activeWaveId}
                isNext={w.id === nextWaveId}
                onClick={() => onSelectWave(w.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Channel info � fixed */}
      {channelData && (
        <div className="flex-shrink-0 px-3 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Channel</h4>
          </div>
          <ChannelInfoSection
            channel={channelData}
            followersCount={channelFollowersCount}
            totalReactions={totalReactions}
            onViewChannel={onViewChannel}
          />
        </div>
      )}

      {/* Section 3: Library items � scrollable */}
      <div className="flex-[1] overflow-y-auto min-h-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between px-3 pt-2 mb-1">
          <h4 className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Library</h4>
          {channelData && (
            <Link href={`/channel/${channelData.id}`} className="text-[10px] transition-colors hover:text-orange-300" style={{ color: "#F49617" }}>
              See all
            </Link>
          )}
        </div>
        {channelData ? (
          <LibrarySection
            items={libraryItems}
            channelId={channelData.id}
            isExclusive={channelData.type === "exclusive"}
            hasAccess={libraryAccess}
          />
        ) : (
          <div className="flex items-center justify-center py-6">
            <div className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

    </div>
  );
}

// -- Comments Panel ---------------------------------------------------------

function WaveCommentsPanel({
  waveId,
  commentCount,
  onClose,
}: {
  waveId: string;
  commentCount: number;
  onClose: () => void;
}) {
  const { isAuthenticated } = useAuth();
  const [comments, setComments] = useState<WaveComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const loadComments = async () => {
      setLoading(true);
      const res = await getWaveCommentsApi(waveId);
      if (!cancelled && res.ok && Array.isArray(res.data)) setComments(res.data);
      if (!cancelled) setLoading(false);
    };
    void loadComments();
    return () => {
      cancelled = true;
    };
  }, [waveId]);

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    const res = await postWaveCommentApi(waveId, text.trim());
    if (res.ok && "id" in res.data) {
      setComments((prev) => [...prev, res.data as WaveComment]);
      setText("");
      setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 100);
    }
    setPosting(false);
  };

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col"
      style={{ background: "linear-gradient(to top, rgba(5,10,48,0.98) 70%, transparent)" }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-white font-semibold text-base">Comments &middot; {commentCount}</span>
        <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none"><IcoClose /></button>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-8">No comments yet. Be first!</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {c.display_name[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <span className="text-orange-300 text-xs font-medium">{c.display_name}</span>
                <p className="text-white/90 text-sm leading-snug">{c.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
      {isAuthenticated ? (
        <div className="px-4 pb-6 pt-2 flex gap-2 border-t border-white/10">
          <input
            className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-1 focus:ring-orange-400"
            placeholder="Add a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePost()}
            maxLength={500}
          />
          <button
            onClick={handlePost}
            disabled={posting || !text.trim()}
            className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white rounded-full px-4 py-2 text-sm font-semibold transition-colors"
          >
            {posting ? "..." : "Post"}
          </button>
        </div>
      ) : (
        <p className="text-white/40 text-xs text-center pb-6">Sign in to comment</p>
      )}
    </div>
  );
}
// -- Options Panel ----------------------------------------------------------

function WaveOptionsPanel({
  waveId,
  autoscroll,
  onAutoscroll,
  onFullscreen,
  onClose,
  onActionNotice,
}: {
  waveId: string;
  autoscroll: boolean;
  onAutoscroll: () => void;
  onFullscreen: () => void;
  onClose: () => void;
  onActionNotice: (message: string) => void;
}) {
  const { isAuthenticated } = useAuth();
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  const handleInterest = async (signal: "interested" | "not_interested") => {
    if (!isAuthenticated) return;
    await setWaveInterestApi(waveId, signal);
    onActionNotice(signal === "interested" ? "Marked as interested" : "Marked as not interested");
    onClose();
  };

  const handleReport = async () => {
    if (!isAuthenticated || reported) return;
    setReporting(true);
    await reportWaveApi(waveId, "inappropriate content");
    setReported(true);
    setReporting(false);
  };

  const items: { icon: React.ReactNode; label: string; action: () => void; danger?: boolean }[] = [
    { icon: <IcoExpand />, label: "View Fullscreen", action: () => { onFullscreen(); onClose(); } },
    { icon: autoscroll ? <IcoPause /> : <IcoRepeat />, label: autoscroll ? "Pause Autoscroll" : "Enable Autoscroll", action: () => { onAutoscroll(); onClose(); } },
    ...(isAuthenticated
      ? [
          { icon: <IcoThumbUp />, label: "Interested", action: () => handleInterest("interested") },
          { icon: <IcoThumbDown />, label: "Not Interested", action: () => handleInterest("not_interested") },
          { icon: reported ? <IcoCheck /> : <IcoFlag />, label: reported ? "Reported" : reporting ? "Reporting..." : "Report", action: handleReport, danger: !reported },
        ]
      : []),
  ]

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl overflow-hidden"
        style={{ background: "rgba(5,10,48,0.97)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2" />
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-white/5 ${item.danger ? "text-red-400" : "text-white"}`}
          >
            <span className="text-lg w-6 text-center">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
        <div className="pb-4" />
      </div>
    </div>
  );
}

// -- Pulse Button -----------------------------------------------------------

function PulseButton({
  count,
  onPulse,
  compact = false,
}: {
  count: number;
  onPulse: (intensity: 1 | 2 | 3) => void;
  compact?: boolean;
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intensityRef = useRef<1 | 2 | 3>(1);
  const [intensityLevel, setIntensityLevel] = useState<1 | 2 | 3>(1);
  const [pressing, setPressing] = useState(false);
  const [burst, setBurst] = useState<1 | 2 | 3 | null>(null);

  const startPress = () => {
    setPressing(true);
    intensityRef.current = 1;
    setIntensityLevel(1);
    holdTimer.current = setTimeout(() => {
      intensityRef.current = 2;
      setIntensityLevel(2);
      holdTimer.current = setTimeout(() => {
        intensityRef.current = 3;
        setIntensityLevel(3);
      }, 1200);
    }, 800);
  };

  const endPress = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPressing(false);
    const intensity = intensityRef.current;
    setBurst(intensity);
    setTimeout(() => setBurst(null), 800);
    onPulse(intensity);
  };

  const intensityLabel = pressing
    ? intensityLevel === 3 ? "\u26A1\u26A1\u26A1" : intensityLevel === 2 ? "\u26A1\u26A1" : "\u26A1"
    : null;

  return (
    <div className={`flex flex-col items-center ${compact ? "gap-0.5" : "gap-1"}`}>
      {intensityLabel && (
        <div className="text-orange-400 text-[9px] font-bold animate-pulse">{intensityLabel}</div>
      )}
      <button
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={() => pressing && endPress()}
        onTouchStart={(e) => { e.preventDefault(); startPress(); }}
        onTouchEnd={(e) => { e.preventDefault(); endPress(); }}
        className={`relative flex flex-col items-center gap-0.5 select-none touch-none transition-transform ${pressing ? "scale-125" : "scale-100"}`}
      >
        {burst && (
          <>
            <span className="absolute inset-0 rounded-full animate-ping"
              style={{ background: burst === 3 ? "rgba(249,115,22,0.6)" : burst === 2 ? "rgba(249,115,22,0.4)" : "rgba(249,115,22,0.2)" }} />
            {burst >= 2 && (
              <span className="absolute -inset-2 rounded-full animate-ping"
                style={{ background: "rgba(249,115,22,0.2)", animationDelay: "0.1s" }} />
            )}
          </>
        )}
                <span
          className={`drop-shadow transition-colors ${compact ? "text-xl" : "text-2xl"}`}
          style={{ color: burst ? "#F49617" : "rgba(255,255,255,0.9)", filter: burst ? "drop-shadow(0 0 8px #F49617)" : "none" }}
        >
          <IcoPulse />
        </span>
        <span className={`text-white/80 font-medium ${compact ? "text-[10px]" : "text-xs"}`}>
          {formatCount(count)}
        </span>
      </button>
    </div>
  );
}

function WaveMiniToast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 bottom-[105px] z-50 -translate-x-1/2 rounded-full border border-white/10 bg-black/65 px-4 py-2 text-[11px] font-medium text-white shadow-2xl backdrop-blur-md">
      {message}
    </div>
  );
}

// -- Wave Card --------------------------------------------------------------

function WaveCard({
  wave,
  isActive,
  autoscroll,
  forceAdvanceOnEnd = false,
  onAutoscrollChange,
  onAdvanceWave,
  onPrevWave,
  phoneMode = false,
}: {
  wave: Wave;
  isActive: boolean;
  autoscroll: boolean;
  forceAdvanceOnEnd?: boolean;
  onAutoscrollChange: (v: boolean) => void;
  onAdvanceWave?: () => void;
  onPrevWave?: () => void;
  phoneMode?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [pulseCount, setPulseCount] = useState(wave.pulse_count);
  const commentCount = wave.comment_count;
  const [bookmarkCount, setBookmarkCount] = useState(wave.bookmark_count);
  const [bookmarked, setBookmarked] = useState(wave.is_bookmarked ?? false);
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [moments, setMoments] = useState<WavePulseMoment[]>([]);
  const [duration, setDuration] = useState(wave.duration || 0);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uniqueViewCount] = useState(wave.views_count ?? wave.views ?? wave.total_views ?? 0);
  const [repeatPlayCount, setRepeatPlayCount] = useState(wave.repeat_play_count ?? 0);

  useEffect(() => {
    getWavePulseMomentsApi(wave.id).then((res) => {
      if (res.ok && "moments" in res.data) {
        setMoments(res.data.moments);
        if (res.data.duration) setDuration(res.data.duration);
      }
    });
  }, [wave.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive]);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!actionNotice) return;
    const t = setTimeout(() => setActionNotice(null), 2500);
    return () => clearTimeout(t);
  }, [actionNotice]);

  useEffect(() => {
    if (!isActive) return;
    void trackWaveViewApi(wave.id).then((res) => {
      if (res.ok) setRepeatPlayCount((c) => c + 1);
    });
  }, [isActive, wave.id]);

  const handleVideoEnded = () => {
    if (forceAdvanceOnEnd || autoscroll) {
      onAdvanceWave?.();
      return;
    }

    const video = videoRef.current;
    if (!video || !isActive) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
    }
  }, []);

  const handlePulse = async (intensity: 1 | 2 | 3) => {
    if (!isAuthenticated) return;
    const momentSeconds = videoRef.current?.currentTime ?? 0;
    setPulseCount((c) => c + 1);
    await addWavePulseApi(wave.id, intensity, momentSeconds);
    getWavePulseMomentsApi(wave.id).then((res) => {
      if (res.ok && "moments" in res.data) setMoments(res.data.moments);
    });
  };

  const handleBookmark = async () => {
    if (!isAuthenticated) return;
    const next = !bookmarked;
    setBookmarked(next);
    setBookmarkCount((c) => c + (next ? 1 : -1));
    await toggleWaveBookmarkApi(wave.id);
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    if (el.requestFullscreen) void el.requestFullscreen();
  };

  const handleSeek = (t: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = t;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black"
      style={{ scrollSnapAlign: phoneMode ? undefined : "start" }}
    >
      <video
        ref={videoRef}
        src={wave.video_url}
        poster={wave.thumbnail_url ?? undefined}
        loop={!autoscroll}
        playsInline
        muted={false}
        autoPlay
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onCanPlay={() => {
          if (isActive) videoRef.current?.play().catch(() => {});
        }}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
        onEnded={handleVideoEnded}
      />

      {/* Tap to play/pause */}
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={(e) => { if ((e.target as HTMLElement) === e.currentTarget) togglePlay(); }}
      />

      {/* Play indicator */}
      {!playing && isActive && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
            <span className="text-white text-3xl ml-1"><IcoPlay /></span>
          </div>
        </div>
      )}

      {isFullscreen && (
        <>
          <button
            onClick={handleFullscreen}
            className="absolute top-3 right-3 z-40 rounded-full p-2 text-white/80 hover:text-white"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
            aria-label="Exit fullscreen"
          >
            <IcoCompress />
          </button>
          {onPrevWave && (
            <button
              onClick={onPrevWave}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-40 rounded-full p-2 text-white/80 hover:text-white"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
              aria-label="Previous wave"
            >
              <IcoChevronUp />
            </button>
          )}
          {onAdvanceWave && (
            <button
              onClick={onAdvanceWave}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-40 rounded-full p-2 text-white/80 hover:text-white"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
              aria-label="Next wave"
            >
              <IcoChevronDown />
            </button>
          )}
        </>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(5,10,48,0.92) 0%, rgba(5,10,48,0.25) 40%, transparent 70%)" }} />
      <div className="absolute top-0 left-0 right-0 h-20 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(5,10,48,0.65) 0%, transparent 100%)" }} />

      {/* Bottom ECG timeline */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-4 px-3">
        <WavePulseTimeline duration={duration} moments={moments} currentTime={currentTime} onSeek={handleSeek} />
      </div>

      {/* Right icon strip */}
      <div className="absolute right-0 top-0 bottom-0 z-30 flex flex-col items-center justify-end pb-24 gap-5 w-16">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xl" style={{ color: "rgba(255,255,255,0.9)" }}><IcoEye /></span>
          <span className="text-white/80 text-[10px] font-medium">
            {formatCount(uniqueViewCount)}
          </span>
          <span className="text-white/50 text-[10px] font-medium">
            {formatCount(repeatPlayCount)}
          </span>
        </div>
        <PulseButton count={pulseCount} onPulse={handlePulse} compact />
        <button className="flex flex-col items-center gap-0.5" onClick={() => setShowComments(true)}>
          <span className="text-xl" style={{ color: "rgba(255,255,255,0.9)" }}><IcoComment /></span>
          <span className="text-white/80 text-[10px] font-medium">{formatCount(commentCount)}</span>
        </button>
        <button className="flex flex-col items-center gap-0.5" onClick={handleBookmark}>
          <span className="text-xl transition-all"
            style={{ color: bookmarked ? "#F49617" : "rgba(255,255,255,0.9)", filter: bookmarked ? "drop-shadow(0 0 6px #F49617)" : "none" }}>
            <IcoBookmark filled={bookmarked} />
          </span>
          <span className="text-white/80 text-[10px] font-medium">{formatCount(bookmarkCount)}</span>
        </button>
        <button className="flex flex-col items-center gap-0.5" onClick={() => setShowOptions(true)}>
          <span className="text-xl" style={{ color: "rgba(255,255,255,0.9)" }}><IcoDots /></span>
        </button>
      </div>

      {showComments && (
        <WaveCommentsPanel waveId={wave.id} commentCount={commentCount} onClose={() => setShowComments(false)} />
      )}
      {showOptions && (
        <WaveOptionsPanel
          waveId={wave.id}
          autoscroll={autoscroll}
          onAutoscroll={() => onAutoscrollChange(!autoscroll)}
          onFullscreen={handleFullscreen}
          onActionNotice={(message) => setActionNotice(message)}
          onClose={() => setShowOptions(false)}
        />
      )}
      {actionNotice && <WaveMiniToast message={actionNotice} />}
    </div>
  );
}

// -- Wave Feed Page ---------------------------------------------------------

export default function WavePage() {
  const { isAuthenticated } = useAuth();

  // Feed state
  const [waves, setWaves] = useState<Wave[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoscroll, setAutoscroll] = useState(false);

  // Channel panel state
  const [channelWaves, setChannelWaves] = useState<Wave[]>([]);
  const [channelData, setChannelData] = useState<Channel | null>(null);
  const [channelFollowersCount, setChannelFollowersCount] = useState(0);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryAccess, setLibraryAccess] = useState(true);
  const [loadedChannelId, setLoadedChannelId] = useState<string | null>(null);
  const [desktopChannelOrder, setDesktopChannelOrder] = useState<string[]>([]);
  const [desktopOrderChannelId, setDesktopOrderChannelId] = useState<string | null>(null);

  // Layout detection
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Detect desktop breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Load initial feed
  useEffect(() => {
    let cancelled = false;
    const loadFeed = async () => {
      const res = await getWaveFeedApi(10);
      if (cancelled) return;
      if (res.ok && "waves" in res.data) {
        setWaves(res.data.waves);
        setNextCursor(res.data.next_cursor);
      } else {
        setError("Failed to load Wave feed");
      }
      setLoading(false);
    };
    void loadFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  // Intersection observer � only for mobile scroll snap
  useEffect(() => {
    if (isDesktop) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.6 }
    );
    cardRefs.current.forEach((el) => el && observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, [waves, isDesktop]);

  const loadMoreWaves = useCallback(async (cursor: string) => {
    setLoadingMore(true);
    const res = await getWaveFeedApi(10, cursor);
    if (res.ok && "waves" in res.data) {
      setWaves((prev) => [...prev, ...res.data.waves]);
      setNextCursor(res.data.next_cursor);
    }
    setLoadingMore(false);
  }, []);

  const rotateDesktopQueueAndAdvance = useCallback(() => {
    if (!isDesktop || channelWaves.length < 2) return false;

    const byId = new Map(channelWaves.map((w) => [w.id, w]));
    const normalized = desktopChannelOrder.filter((id) => byId.has(id));
    const withMissing = [...normalized, ...channelWaves.map((w) => w.id).filter((id) => !normalized.includes(id))];

    if (withMissing.length < 2) return false;

    const currentId = withMissing[0];
    const nextId = withMissing[1];

    // Rotate: current -> tail, up-next -> current.
    setDesktopChannelOrder([...withMissing.slice(1), withMissing[0]]);

    const nextFeedIdx = waves.findIndex((w) => w.id === nextId);
    if (nextFeedIdx >= 0) {
      setActiveIndex(nextFeedIdx);
      return true;
    }

    const nextWave = byId.get(nextId);
    if (nextWave) {
      const appendIndex = waves.length;
      setWaves((prev) => [...prev, nextWave]);
      setActiveIndex(appendIndex);
      return true;
    }

    // Fallback: restore current to head if next can't be resolved.
    setDesktopChannelOrder((prev) => [currentId, ...prev.filter((id) => id !== currentId)]);
    return false;
  }, [isDesktop, channelWaves, desktopChannelOrder, waves]);

  const advanceWave = useCallback(() => {
    if (rotateDesktopQueueAndAdvance()) {
      return;
    }

    if (activeIndex < waves.length - 1) {
      setActiveIndex((index) => Math.min(index + 1, waves.length - 1));
      if (!isDesktop) {
        const nextCard = cardRefs.current[activeIndex + 1];
        nextCard?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    if (nextCursor && !loadingMore) {
      void loadMoreWaves(nextCursor);
    }
  }, [activeIndex, waves.length, isDesktop, nextCursor, loadingMore, loadMoreWaves, rotateDesktopQueueAndAdvance]);

  // Load more near end
  useEffect(() => {
    if (activeIndex >= waves.length - 3 && nextCursor && !loadingMore) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadMoreWaves(nextCursor);
    }
  }, [activeIndex, waves.length, nextCursor, loadingMore, loadMoreWaves]);

  const loadChannelPanelData = useCallback(async (channelId: string) => {
    setLoadedChannelId(channelId);
    setChannelData(null);
    setChannelWaves([]);
    setLibraryItems([]);
    setLibraryAccess(true);

    const [channelRes, wavesRes, libraryRes, followRes] = await Promise.all([
      getChannelApi(channelId),
      getChannelWavesApi(channelId),
      getChannelLibraryApi(channelId, { limit: 20 }),
      isAuthenticated ? getChannelFollowStatusApi(channelId) : Promise.resolve(null),
    ]);

    if (channelRes.ok && "channel" in channelRes.data) {
      const ch = channelRes.data.channel;
      setChannelData(ch);
      setChannelFollowersCount(ch.followers_count ?? 0);
      if (ch.type === "exclusive" && !isAuthenticated) setLibraryAccess(false);
    }

    if (wavesRes.ok && Array.isArray(wavesRes.data)) {
      setChannelWaves(wavesRes.data as Wave[]);
    }

    if (libraryRes.ok && "data" in libraryRes.data) {
      const d = libraryRes.data.data;
      if (d && Array.isArray(d.items)) {
        setLibraryItems(d.items.filter((i: LibraryItem) => i.status === "published"));
      }
    }

    if (followRes && followRes.ok && "followers_count" in followRes.data) {
      setChannelFollowersCount(followRes.data.followers_count);
    }
  }, [isAuthenticated]);

  // Load channel data when active wave's channel changes
  const activeWave = waves[activeIndex];
  useEffect(() => {
    const channelId = activeWave?.channel_id;
    if (!channelId || channelId === loadedChannelId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadChannelPanelData(channelId);
  }, [activeWave?.channel_id, loadedChannelId, loadChannelPanelData]);

  // Desktop queue contract:
  // index 0 = currently playing, index 1 = up next, then the remaining waves.
  useEffect(() => {
    if (!isDesktop) return;
    if (!activeWave || !activeWave.channel_id) return;

    const activeChannelId = activeWave.channel_id;
    const baseIds = channelWaves.map((w) => w.id);
    const baseSet = new Set(baseIds);
    const activeId = activeWave.id;

    if (baseIds.length === 0) {
      setDesktopChannelOrder([]);
      setDesktopOrderChannelId(activeChannelId);
      return;
    }

    setDesktopChannelOrder((prev) => {
      // New channel: initialize from channel order, but pin active first.
      if (desktopOrderChannelId !== activeChannelId || prev.length === 0) {
        if (!baseSet.has(activeId)) return baseIds;
        return [activeId, ...baseIds.filter((id) => id !== activeId)];
      }

      // Keep previous queue order where possible.
      const normalized = prev.filter((id) => baseSet.has(id));
      const withNew = [...normalized, ...baseIds.filter((id) => !normalized.includes(id))];

      // Always pin active at top.
      if (!withNew.includes(activeId)) return [activeId, ...withNew];
      return [activeId, ...withNew.filter((id) => id !== activeId)];
    });

    if (desktopOrderChannelId !== activeChannelId) {
      setDesktopOrderChannelId(activeChannelId);
    }
  }, [isDesktop, activeWave, channelWaves, desktopOrderChannelId]);

  const orderedChannelWaves = (() => {
    if (!isDesktop || channelWaves.length === 0) return channelWaves;
    const byId = new Map(channelWaves.map((w) => [w.id, w]));
    const ordered = desktopChannelOrder
      .map((id) => byId.get(id))
      .filter((w): w is Wave => Boolean(w));
    const missing = channelWaves.filter((w) => !desktopChannelOrder.includes(w.id));
    return [...ordered, ...missing];
  })();

  // Derived: total reactions from channel waves
  const totalReactions = channelWaves.reduce((s, w) => s + w.pulse_count, 0);

  // Derived: "next" wave in channel context
  const nextChannelWaveId = (() => {
    if (orderedChannelWaves.length < 2) return null;
    return orderedChannelWaves[1]?.id ?? null;
  })();

  const jumpToWave = (waveId: string) => {
    const feedIdx = waves.findIndex((w) => w.id === waveId);
    if (feedIdx !== -1) {
      setActiveIndex(feedIdx);
      if (isDesktop) {
        setDesktopChannelOrder((prev) => [waveId, ...prev.filter((id) => id !== waveId)]);
      }
      if (!isDesktop) cardRefs.current[feedIdx]?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const channelWave = channelWaves.find((w) => w.id === waveId);
    if (channelWave) {
      setWaves((prev) => {
        setActiveIndex(0);
        return [channelWave, ...prev];
      });
      if (isDesktop) {
        setDesktopChannelOrder((prev) => [waveId, ...prev.filter((id) => id !== waveId)]);
      }
    }
  };

  const handleViewChannel = () => {
    if (channelData) window.location.href = `/channel/${channelData.id}`;
  };

  // -- Loading / error / empty states --------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: "linear-gradient(180deg, #173A6D 0%, #050A30 100%)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading Waves...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: "linear-gradient(180deg, #173A6D 0%, #050A30 100%)" }}>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (waves.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: "linear-gradient(180deg, #173A6D 0%, #050A30 100%)" }}>
        <div className="text-center">
          <div className="mb-4 flex justify-center text-white/80"><IcoWave /></div>
          <h2 className="text-white font-bold text-xl mb-2">No Waves yet</h2>
          <p className="text-white/50 text-sm">Check back soon for short videos from creators.</p>
        </div>
      </div>
    );
  }

  // -- Desktop layout -------------------------------------------------------

  if (isDesktop) {
    return (
      <div
        className="flex"
        style={{ height: "calc(100dvh - 64px)", background: "linear-gradient(180deg, #0D1B3E 0%, #050A30 100%)" }}
      >
        {/* Left panel */}
        <LeftPanel
          channelWaves={orderedChannelWaves}
          channelData={channelData}
          channelFollowersCount={channelFollowersCount}
          totalReactions={totalReactions}
          libraryItems={libraryItems}
          libraryAccess={libraryAccess}
          activeWaveId={activeWave?.id ?? ""}
          nextWaveId={nextChannelWaveId}
          onSelectWave={jumpToWave}
          onViewChannel={handleViewChannel}
        />

        {/* Center: phone-width video */}
        <div className="flex-1 flex items-center justify-center overflow-hidden" style={{ background: "#000" }}>
          <div
            className="relative flex flex-col"
            style={{
              width: "min(390px, 100%)",
              height: "calc(100dvh - 64px)",
              maxHeight: "844px",
              overflow: "hidden",
              boxShadow: "0 0 0 1px rgba(245,193,108,0.15), 0 32px 80px rgba(0,0,0,0.8)",
            }}
          >
            {/* Prev wave nav */}
            {activeIndex > 0 && (
              <button
                onClick={() => setActiveIndex((i) => i - 1)}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105"
                style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.7)", backdropFilter: "blur(6px)" }}
              >
                <IcoChevronUp /> Previous
              </button>
            )}

            {activeWave && (
              <WaveCard
                key={activeWave.id}
                wave={activeWave}
                isActive={true}
                autoscroll={autoscroll}
                forceAdvanceOnEnd={true}
                onAutoscrollChange={setAutoscroll}
                onPrevWave={activeIndex > 0 ? () => setActiveIndex((i) => i - 1) : undefined}
                onAdvanceWave={advanceWave}
                phoneMode
              />
            )}

            {/* Next wave nav */}
            {activeIndex < waves.length - 1 && (
              <button
                onClick={() => setActiveIndex((i) => i + 1)}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105"
                style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.7)", backdropFilter: "blur(6px)" }}
              >
                Next <IcoChevronDown />
              </button>
            )}
          </div>
        </div>

        {/* Right: counter strip */}
        <div
          className="hidden xl:flex flex-col items-center justify-center w-16"
          style={{ background: "rgba(5,10,48,0.6)", borderLeft: "1px solid rgba(245,193,108,0.08)" }}
        >
          <span
            className="text-white/20 text-[10px] font-bold uppercase tracking-widest select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {activeIndex + 1} / {waves.length}
          </span>
        </div>
      </div>
    );
  }

  // -- Mobile layout (scroll snap) ------------------------------------------

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-y-scroll"
      style={{ height: "calc(100dvh - 64px)", scrollSnapType: "y mandatory", scrollBehavior: "smooth", background: "#000" }}
    >
      {waves.map((wave, i) => (
        <div
          key={wave.id}
          ref={(el) => { cardRefs.current[i] = el; }}
          style={{ height: "calc(100dvh - 64px)", scrollSnapAlign: "start" }}
        >
          <WaveCard
            key={wave.id}
            wave={wave}
            isActive={i === activeIndex}
            autoscroll={autoscroll}
            onAutoscrollChange={setAutoscroll}
            onAdvanceWave={advanceWave}
          />
        </div>
      ))}
      {loadingMore && (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
