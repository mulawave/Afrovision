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
  checkChannelSubApi,
  subscribeToChannelApi,
  cancelChannelSubApi,
  getChannelLibraryItemDetailApi,
  trackWaveViewApi,
  checkWaveAccessApi,
  acknowledgeWaveAdultConsentApi,
  getCreatorWaveLockStatusApi,
  payCreatorWaveLockApi,
  serveBannerAdApi,
  recordAdImpressionApi,
  recordAdClickApi,
  type Advertisement,
  type Wave,
  type WaveAgeClassification,
  type WaveAccessDecision,
  type CreatorLockStatus,
  type WaveComment,
  type WavePulseMoment,
  type Channel,
  type LibraryItem,
  type LibraryItemDetail,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { resolveWebsiteMediaUrl } from "@/lib/media";

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

function getAdSessionId() {
  if (typeof window === "undefined") return undefined;
  const key = "afrovision_ad_session_id";
  let existing = window.sessionStorage.getItem(key);
  if (!existing) {
    existing = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, existing);
  }
  return existing;
}

function getWaveContentLabels(wave: Wave): string[] {
  const codes: string[] = [];
  if (wave.has_sex) codes.push('S');
  if (wave.has_sexual_nature) codes.push('SN');
  if (wave.has_nudity) codes.push('N');
  if (wave.has_explicit_language) codes.push('L');
  if (wave.has_violence) codes.push('V');
  if (wave.has_revealing_clothes) codes.push('RC');
  if (wave.has_partial_nudity) codes.push('PN');
  if (wave.has_explicit_content) codes.push('XC');
  if (wave.has_parental_guidance) codes.push('PG');
  if (wave.has_erotic_dancing) codes.push('ED');
  return codes;
}

function getWaveClassificationMeta(ageClassification?: WaveAgeClassification): {
  label: string;
  bg: string;
  border: string;
  color: string;
} {
  if (ageClassification === "minor_safe") {
    return {
      label: "MINOR SAFE",
      bg: "rgba(34,197,94,0.2)",
      border: "1px solid rgba(34,197,94,0.6)",
      color: "#bbf7d0",
    };
  }
  if (ageClassification === "adult") {
    return {
      label: "18+",
      bg: "rgba(239,68,68,0.2)",
      border: "1px solid rgba(239,68,68,0.6)",
      color: "#fecaca",
    };
  }
  return {
    label: "TEEN",
    bg: "rgba(245,150,23,0.24)",
    border: "1px solid rgba(245,150,23,0.65)",
    color: "#fde68a",
  };
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
  const classification = getWaveClassificationMeta(wave.age_classification);
  const contentLabels = getWaveContentLabels(wave);

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
        className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider flex items-center gap-1"
        style={{
          background: classification.bg,
          border: classification.border,
          color: classification.color,
          backdropFilter: "blur(4px)",
        }}
      >
        {classification.label}
        {contentLabels.length > 0 && (
          <span className="opacity-80 border-l border-current/30 pl-1">
            {contentLabels.join(".")}
          </span>
        )}
      </div>

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
  subscriberCount,
  totalReactions,
  onViewChannel,
}: {
  channel: Channel;
  subscriberCount: number;
  totalReactions: number;
  onViewChannel: () => void;
}) {
  const badge = channelTypeBadge(channel);
  const displaySubscribers = subscriberCount || channel.subscriber_count || channel.followers_count || 0;

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
            <p className="text-white font-bold text-sm">{formatCount(displaySubscribers)}</p>
            <p className="text-white/40 text-[9px] uppercase tracking-wider">Subscribers</p>
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
  channelSubscriberCount,
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
  channelSubscriberCount: number;
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
            subscriberCount={channelSubscriberCount}
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
      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.98) 70%, transparent)" }}
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
                <Link href={`/u/${c.user_id}`} className="text-orange-300 text-xs font-medium hover:underline transition-colors">
                  {c.display_name}
                </Link>
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
        style={{ background: "rgba(0,0,0,0.95)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
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

// -- Floating Bolt Overlay -------------------------------------------------

type FloatingItem = {
  id: number;
  icon: "bolt" | "bookmark" | "comment" | "replay";
  leftOffset: number;
};

let _floatingIdCounter = 0;

function FloatingBoltOverlay({ items, onRemove }: {
  items: FloatingItem[];
  onRemove: (id: number) => void;
}) {
  useEffect(() => {
    if (items.length === 0) return;
    const timers = items.map((item) =>
      setTimeout(() => onRemove(item.id), 2400)
    );
    return () => timers.forEach(clearTimeout);
  }, [items, onRemove]);

  return (
    <div className="absolute inset-0 z-25 pointer-events-none overflow-hidden">
      {items.map((item) => (
        <FloatingBoltItem key={item.id} item={item} />
      ))}
    </div>
  );
}

function FloatingBoltItem({ item }: { item: FloatingItem }) {
  const iconMap = {
    bolt: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    ),
    bookmark: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
      </svg>
    ),
    comment: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z" />
      </svg>
    ),
    replay: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
      </svg>
    ),
  };

  return (
    <div
      className="absolute bottom-24"
      style={{
        left: `${item.leftOffset}px`,
        animation: "floatUp 2.4s ease-out forwards",
        color: "#FFD700",
        filter: "drop-shadow(0 0 6px rgba(255,215,0,0.5))",
      }}
    >
      <div style={{ animation: "scaleIn 0.35s ease-out forwards", transform: "scale(0.6)" }}>
        {iconMap[item.icon]}
      </div>
    </div>
  );
}

// -- Channel Card Overlay ---------------------------------------------------

function ChannelCardOverlay({
  visible,
  channel,
  channelSubscriberCount,
  totalReactions,
  onClose,
  onViewChannel,
}: {
  visible: boolean;
  channel: Channel | null;
  channelSubscriberCount: number;
  totalReactions: number;
  onClose: () => void;
  onViewChannel: () => void;
}) {
  const kGold = "#FFD700";
  const isExclusive = channel?.type === "exclusive";

  return (
    <div
      className={`absolute left-0 right-0 bottom-0 z-40 transition-all duration-300 ${visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}
      style={{ paddingBottom: "76px" }}
    >
      <div
        className="mx-2.5 rounded-2xl p-4"
        style={{
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(18px)",
          border: `1px solid ${kGold}80`,
          boxShadow: "0 6px 28px rgba(0,0,0,0.25), 0 2px 24px rgba(255,215,0,0.08)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ border: `2px solid ${kGold}cc` }}
          >
            {channel?.logo_url ? (
              <img src={channel.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span style={{ color: kGold, fontSize: 18, fontWeight: 800 }}>
                {(channel?.name ?? "C")[0].toUpperCase()}
              </span>
            )}
          </div>
          {/* Name + number */}
          <div className="flex-1 min-w-0">
            <p className="truncate font-bold text-sm" style={{ color: kGold, textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
              {channel?.name ?? "Channel"}
            </p>
            {channel?.channel_number && (
              <p className="text-[11px] font-medium" style={{ color: `${kGold}8c` }}>
                Channel {channel.channel_number}
              </p>
            )}
          </div>
          {/* Close + badge */}
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: `${kGold}1a`, border: `1px solid ${kGold}59` }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={kGold} strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            {isExclusive && (
              <span
                className="px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider"
                style={{ background: "linear-gradient(90deg, #FFD700, #FF8C00)", color: "#000" }}
              >
                EXCLUSIVE
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 text-[11px]">
          <div className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill={kGold} fillOpacity={0.7}><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            <span style={{ color: `${kGold}aa` }}>{formatCount(channelSubscriberCount)} subscribers</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill={kGold} fillOpacity={0.7}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>
            <span style={{ color: `${kGold}aa` }}>{formatCount(totalReactions)} reactions</span>
          </div>
        </div>

        {/* Gold divider */}
        <div className="my-3 h-px" style={{ background: `linear-gradient(90deg, transparent, ${kGold}a6, transparent)` }} />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onViewChannel}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
            style={{ background: "linear-gradient(90deg, #F49617, #F5C16C)", color: "#050A30" }}
          >
            Visit Channel
          </button>
          <a
            href={channel ? `/channel/${channel.id}` : "#"}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ background: `${kGold}1a`, color: kGold, border: `1px solid ${kGold}40` }}
          >
            Tune In
          </a>
          <a
            href={channel ? `/channel/${channel.id}` : "#"}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ background: `${kGold}1a`, color: kGold, border: `1px solid ${kGold}40` }}
          >
            Library
          </a>
        </div>
      </div>
    </div>
  );
}

// -- Wave Card --------------------------------------------------------------

function WaveCard({
  wave,
  isActive,
  autoscroll,
  forceAdvanceOnEnd = false,
  blockedReason = null,
  requiresAdultConsent = false,
  onConfirmAdultConsent,
  onLeaveRestrictedContent,
  onAutoscrollChange,
  onAdvanceWave,
  onPrevWave,
  phoneMode = false,
  channelData,
  channelSubscriberCount,
  totalReactions,
  onViewChannel,
}: {
  wave: Wave;
  isActive: boolean;
  autoscroll: boolean;
  forceAdvanceOnEnd?: boolean;
  blockedReason?: string | null;
  requiresAdultConsent?: boolean;
  onConfirmAdultConsent?: () => void;
  onLeaveRestrictedContent?: () => void;
  onAutoscrollChange: (v: boolean) => void;
  onAdvanceWave?: () => void;
  onPrevWave?: () => void;
  phoneMode?: boolean;
  channelData?: Channel | null;
  channelSubscriberCount?: number;
  totalReactions?: number;
  onViewChannel?: () => void;
}) {
  const { isAuthenticated, user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [pulseCount, setPulseCount] = useState(wave.pulse_count);
  const [floatingItems, setFloatingItems] = useState<FloatingItem[]>([]);
  const [showChannelCard, setShowChannelCard] = useState(false);

  const addFloatingItem = useCallback((icon: FloatingItem["icon"]) => {
    const id = ++_floatingIdCounter;
    const leftOffset = 8 + Math.random() * 20;
    setFloatingItems((prev) => [...prev, { id, icon, leftOffset }]);
  }, []);

  const removeFloatingItem = useCallback((id: number) => {
    setFloatingItems((prev) => prev.filter((i) => i.id !== id));
  }, []);
  const commentCount = wave.comment_count;
  const [bookmarkCount, setBookmarkCount] = useState(wave.bookmark_count);
  const [bookmarked, setBookmarked] = useState(wave.is_bookmarked ?? false);
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [moments, setMoments] = useState<WavePulseMoment[]>([]);
  const [duration, setDuration] = useState(wave.duration || 0);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uniqueViewCount, setUniqueViewCount] = useState(wave.views_count ?? wave.views ?? wave.total_views ?? 0);
  const [repeatPlayCount, setRepeatPlayCount] = useState(wave.repeat_play_count ?? 0);
  const [muted, setMuted] = useState(false);
  const [showSpeedBar, setShowSpeedBar] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [hideAllUI, setHideAllUI] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [subId, setSubId] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const isChannelOwner = Boolean(user && channelData && channelData.owner_id === user.id);
  const classification = getWaveClassificationMeta(wave.age_classification);
  const contentLabels = getWaveContentLabels(wave);

  useEffect(() => {
    getWavePulseMomentsApi(wave.id).then((res) => {
      if (res.ok && "moments" in res.data) {
        setMoments(res.data.moments);
        if (res.data.duration) setDuration(res.data.duration);
      }
    });
  }, [wave.id]);

  // Load channel subscription status
  useEffect(() => {
    if (!isAuthenticated || !wave.channel_id) return;
    checkChannelSubApi(wave.channel_id).then((res) => {
      if (res.ok && "subscribed" in res.data) {
        setIsSubscribed(res.data.subscribed);
        setSubId(res.data.subscription?.id ?? null);
      }
    });
  }, [wave.channel_id, isAuthenticated]);

  // Apply mute to video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  // Apply playback speed to video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const toggleSpeedBar = useCallback(() => setShowSpeedBar((s) => !s), []);
  const toggleHideUI = useCallback(() => setHideAllUI((h) => !h), []);

  const handleSetSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedBar(false);
  }, []);

  const handleShare = useCallback(() => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/wave?wave_id=${wave.id}` : "";
    const text = `Watch "${wave.title}" on AfroVision:\n${url}`;
    if (navigator.share) {
      navigator.share({ title: wave.title, text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setShareNotice("Link copied to clipboard");
        setTimeout(() => setShareNotice(null), 2000);
      });
    }
  }, [wave.id, wave.title]);

  const handleToggleSubscribe = useCallback(async () => {
    if (!isAuthenticated || subLoading || !wave.channel_id) return;
    setSubLoading(true);
    try {
      if (isSubscribed && subId) {
        const res = await cancelChannelSubApi(subId);
        if (res.ok) {
          setIsSubscribed(false);
          setSubId(null);
          setActionNotice(`Unsubscribed from ${channelData?.name ?? "channel"}`);
          setTimeout(() => setActionNotice(null), 2000);
        }
      } else {
        const res = await subscribeToChannelApi(wave.channel_id);
        if (res.ok && "subscription" in res.data) {
          setIsSubscribed(true);
          setSubId(res.data.subscription.id);
          setActionNotice(`Subscribed to ${channelData?.name ?? "channel"}`);
          setTimeout(() => setActionNotice(null), 2000);
        }
      }
    } catch {
      // ignore
    } finally {
      setSubLoading(false);
    }
  }, [isAuthenticated, subLoading, isSubscribed, subId, wave.channel_id, channelData?.name]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (blockedReason || requiresAdultConsent) {
      video.pause();
      return;
    }

    if (isActive) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive, blockedReason, requiresAdultConsent]);

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
      if (res.ok) {
        setRepeatPlayCount((c) => c + 1);
        if (res.data && 'unique' in res.data && res.data.unique) {
          setUniqueViewCount((c) => c + 1);
        }
      }
    });
  }, [isActive, wave.id]);

  const handleVideoEnded = () => {
    if (blockedReason || requiresAdultConsent) return;
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
    if (blockedReason || requiresAdultConsent) return;
    if (!isAuthenticated) return;
    const momentSeconds = videoRef.current?.currentTime ?? 0;
    setPulseCount((c) => c + 1);
    addFloatingItem("bolt");
    await addWavePulseApi(wave.id, intensity, momentSeconds);
    getWavePulseMomentsApi(wave.id).then((res) => {
      if (res.ok && "moments" in res.data) setMoments(res.data.moments);
    });
  };

  const handleBookmark = async () => {
    if (blockedReason || requiresAdultConsent) return;
    if (!isAuthenticated) return;
    const next = !bookmarked;
    setBookmarked(next);
    setBookmarkCount((c) => c + (next ? 1 : -1));
    if (next) addFloatingItem("bookmark");
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
      style={{
        scrollSnapAlign: phoneMode ? undefined : "start",
      }}
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
        className={`absolute inset-0 w-full h-full object-contain ${blockedReason || requiresAdultConsent ? "blur-lg scale-105 brightness-50" : ""}`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onCanPlay={() => {
          if (isActive && !blockedReason && !requiresAdultConsent) videoRef.current?.play().catch(() => {});
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
      {!playing && isActive && !blockedReason && !requiresAdultConsent && (
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

      {/* Age badge + mini controls (hidden when hideAllUI) */}
      {!hideAllUI && (
        <div className="absolute top-3 right-3 z-30 flex items-start gap-2">
          <div
            className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider pointer-events-none flex items-center gap-1.5"
            style={{
              background: classification.bg,
              border: classification.border,
              color: classification.color,
              backdropFilter: "blur(5px)",
            }}
          >
            {classification.label}
            {contentLabels.length > 0 && (
              <span className="opacity-80 border-l border-current/30 pl-1.5">
                {contentLabels.join(".")}
              </span>
            )}
          </div>
          {/* Mini controls column */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setShowOptions(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 transition-all hover:scale-110"
              style={{
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              aria-label="More options"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
            </button>
            <button
              onClick={() => onAutoscrollChange(!autoscroll)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 transition-all hover:scale-110"
              style={{
                background: autoscroll ? "rgba(244,150,23,0.35)" : "rgba(0,0,0,0.45)",
                backdropFilter: "blur(6px)",
                border: autoscroll ? "1px solid rgba(244,150,23,0.6)" : "1px solid rgba(255,255,255,0.1)",
              }}
              aria-label={autoscroll ? "Pause autoscroll" : "Enable autoscroll"}
            >
              {autoscroll ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleSpeedBar}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 transition-all hover:scale-110"
              style={{
                background: showSpeedBar ? "rgba(244,150,23,0.35)" : "rgba(0,0,0,0.45)",
                backdropFilter: "blur(6px)",
                border: showSpeedBar ? "1px solid rgba(244,150,23,0.6)" : "1px solid rgba(255,255,255,0.1)",
              }}
              aria-label="Playback speed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </button>
            <button
              onClick={toggleMute}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 transition-all hover:scale-110"
              style={{
                background: muted ? "rgba(244,150,23,0.35)" : "rgba(0,0,0,0.45)",
                backdropFilter: "blur(6px)",
                border: muted ? "1px solid rgba(244,150,23,0.6)" : "1px solid rgba(255,255,255,0.1)",
              }}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleHideUI}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 transition-all hover:scale-110"
              style={{
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              aria-label="Hide UI"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* Hide UI restore button */}
      {hideAllUI && (
        <button
          onClick={toggleHideUI}
          className="absolute top-3 right-3 z-40 w-9 h-9 rounded-full flex items-center justify-center text-white/90 transition-all hover:scale-110"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          aria-label="Show UI"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}

      {/* Playback speed bar */}
      {showSpeedBar && !hideAllUI && (
        <div className="absolute top-16 right-3 z-40 flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
            <button
              key={s}
              onClick={() => handleSetSpeed(s)}
              className="px-2 py-1 rounded-md text-xs font-bold transition-all"
              style={{
                background: playbackSpeed === s ? "rgba(244,150,23,0.3)" : "transparent",
                color: playbackSpeed === s ? "#F49617" : "rgba(255,255,255,0.7)",
                border: playbackSpeed === s ? "1px solid rgba(244,150,23,0.5)" : "1px solid transparent",
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      )}

      {/* Bottom ECG timeline (hidden when hideAllUI) */}
      {!hideAllUI && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pb-4 px-3">
          <WavePulseTimeline duration={duration} moments={moments} currentTime={currentTime} onSeek={handleSeek} />
        </div>
      )}

      {/* Right icon strip (hidden when hideAllUI) */}
      <div className={`absolute right-0 top-0 bottom-0 z-30 flex flex-col items-center justify-end pb-24 gap-5 w-16 transition-opacity duration-200 ${hideAllUI ? "pointer-events-none opacity-0" : ""} ${blockedReason || requiresAdultConsent ? "pointer-events-none opacity-50" : ""}`}>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xl" style={{ color: "rgba(255,255,255,0.9)" }}><IcoEye /></span>
          <span className="text-white/80 text-[10px] font-medium">
            {formatCount(uniqueViewCount)}
          </span>
        </div>
        <PulseButton count={pulseCount} onPulse={handlePulse} compact />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xl" style={{ color: "rgba(255,255,255,0.9)" }}><IcoRepeat /></span>
          <span className="text-white/80 text-[10px] font-medium">
            {formatCount(repeatPlayCount)}
          </span>
        </div>
        <button className="flex flex-col items-center gap-0.5" onClick={() => setShowComments(true)}>
          <span className="text-xl" style={{ color: "rgba(255,255,255,0.9)" }}><IcoComment /></span>
          <span className="text-white/80 text-[10px] font-medium">{formatCount(commentCount)}</span>
        </button>
        {/* Share button */}
        <button className="flex flex-col items-center gap-0.5" onClick={handleShare}>
          <span className="text-xl" style={{ color: "rgba(255,255,255,0.9)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </span>
          <span className="text-white/80 text-[10px] font-medium">Share</span>
        </button>
        <button className="flex flex-col items-center gap-0.5" onClick={handleBookmark}>
          <span className="text-xl transition-all"
            style={{ color: bookmarked ? "#F49617" : "rgba(255,255,255,0.9)", filter: bookmarked ? "drop-shadow(0 0 6px #F49617)" : "none" }}>
            <IcoBookmark filled={bookmarked} />
          </span>
          <span className="text-white/80 text-[10px] font-medium">{formatCount(bookmarkCount)}</span>
        </button>
        {/* Subscribe to channel button (hidden for channel owner) */}
        {!isChannelOwner && (
          <button
            className="flex flex-col items-center gap-0.5"
            onClick={handleToggleSubscribe}
            disabled={subLoading}
          >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{
              border: `2px solid ${isSubscribed ? "rgba(244,150,23,0.7)" : "rgba(255,255,255,0.7)"}`,
              background: isSubscribed ? "rgba(244,150,23,0.15)" : "rgba(0,0,0,0.65)",
            }}
          >
            {isSubscribed ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#F49617" stroke="#F49617" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            )}
          </div>
          </button>
        )}
        {/* Channel logo button (toggles channel card) */}
        {channelData !== undefined && (
          <button
            className="flex flex-col items-center gap-0.5"
            onClick={() => setShowChannelCard((v) => !v)}
          >
            <div
              className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                border: `2px solid ${showChannelCard ? "#F49617" : "rgba(255,255,255,0.7)"}`,
              }}
            >
              {channelData?.logo_url ? (
                <img src={channelData.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xs font-bold">
                  {(channelData?.name ?? wave.channel_id ?? "C")[0].toUpperCase()}
                </span>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Floating bolt overlay */}
      <FloatingBoltOverlay items={floatingItems} onRemove={removeFloatingItem} />

      {/* Channel card overlay */}
      {channelData !== undefined && (
        <ChannelCardOverlay
          visible={showChannelCard}
          channel={channelData ?? null}
          channelSubscriberCount={channelSubscriberCount ?? 0}
          totalReactions={totalReactions ?? 0}
          onClose={() => setShowChannelCard(false)}
          onViewChannel={() => {
            setShowChannelCard(false);
            onViewChannel?.();
          }}
        />
      )}

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
      {(blockedReason || requiresAdultConsent) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0"
            style={{
              backdropFilter: "blur(18px)",
              background: "rgba(0, 0, 0, 0.62)",
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-black/80 p-5 text-white shadow-2xl backdrop-blur-md">
            <p className="text-sm font-semibold tracking-wide text-orange-300 uppercase mb-2">
              Content Access Check
            </p>
            <h3 className="text-white text-lg font-bold mb-2">
              {requiresAdultConsent ? "Adults Only Warning" : "Restricted Content"}
            </h3>
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              {requiresAdultConsent
                ? "This content is intended for adults only. By continuing, you confirm you are 18+ and understand viewer discretion is advised."
                : (blockedReason || "You do not currently meet the access requirements for this content.")}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onLeaveRestrictedContent}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors"
              >
                Leave
              </button>
              {requiresAdultConsent && (
                <button
                  onClick={onConfirmAdultConsent}
                  className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
                  style={{ background: "#F49617", color: "#050A30" }}
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {actionNotice && <WaveMiniToast message={actionNotice} />}
      {shareNotice && <WaveMiniToast message={shareNotice} />}
    </div>
  );
}

function WaveSponsoredCard({ ad }: { ad: Advertisement }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const recordedRef = useRef(false);
  const mediaUrl = resolveWebsiteMediaUrl(ad.media_url || "");
  const isVideo = /\.(mp4|webm|mov)$/i.test(ad.media_url || "");

  useEffect(() => {
    if (!ad.id || recordedRef.current || !rootRef.current) return;
    let viewTimer: number | null = null;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && entry.intersectionRatio >= 0.6) {
        if (!viewTimer) {
          viewTimer = window.setTimeout(() => {
            if (recordedRef.current) return;
            recordedRef.current = true;
            recordAdImpressionApi(ad.id, undefined, 1, {
              sessionId: getAdSessionId(),
              placement: "wave_feed",
            }).catch(() => {});
            observer.disconnect();
          }, 1200);
        }
      } else if (viewTimer) {
        window.clearTimeout(viewTimer);
        viewTimer = null;
      }
    }, { threshold: [0, 0.6, 1] });

    observer.observe(rootRef.current);
    return () => {
      if (viewTimer) window.clearTimeout(viewTimer);
      observer.disconnect();
    };
  }, [ad.id]);

  const handleClick = useCallback(() => {
    if (!ad.id) return;
    recordAdClickApi(ad.id, undefined, {
      sessionId: getAdSessionId(),
      placement: "wave_feed",
    }).catch(() => {});
  }, [ad.id]);

  return (
    <div ref={rootRef} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black text-white">
      <div className="absolute left-4 top-4 z-20 rounded-full bg-[#F49617] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#050A30]">
        Sponsored
      </div>
      <a
        href={ad.click_url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="relative flex h-full w-full items-center justify-center"
      >
        {isVideo ? (
          <video src={mediaUrl} className="h-full w-full object-contain" autoPlay muted loop playsInline={true} />
        ) : (
          <img src={mediaUrl} alt={ad.title || "Sponsored"} className="h-full w-full object-contain" />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5">
          <h3 className="text-lg font-bold">{ad.title}</h3>
          {ad.description && <p className="mt-1 text-sm text-white/75">{ad.description}</p>}
          {ad.click_url && <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-[#F5C16C]">Learn more</p>}
        </div>
      </a>
    </div>
  );
}

// -- Wave Feed Page ---------------------------------------------------------

export default function WavePage() {
  const { isAuthenticated, user } = useAuth();

  // Feed state
  const [waves, setWaves] = useState<Wave[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waveAd, setWaveAd] = useState<Advertisement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoscroll, setAutoscroll] = useState(false);
  const [accessDecision, setAccessDecision] = useState<WaveAccessDecision | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [adultConsentSessionAccepted, setAdultConsentSessionAccepted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("av_adult_consent_ack") === "1";
  });
  const [viewerSessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const existingSessionId = window.sessionStorage.getItem("av_session_id");
    if (existingSessionId) return existingSessionId;
    const generated = crypto.randomUUID();
    window.sessionStorage.setItem("av_session_id", generated);
    return generated;
  });
  const [creatorLockStatus, setCreatorLockStatus] = useState<CreatorLockStatus | null>(null);
  const [loadingCreatorLock, setLoadingCreatorLock] = useState(false);
  const [payingCreatorLock, setPayingCreatorLock] = useState(false);
  const [creatorLockError, setCreatorLockError] = useState<string | null>(null);

  // Channel panel state
  const [channelWaves, setChannelWaves] = useState<Wave[]>([]);
  const [channelData, setChannelData] = useState<Channel | null>(null);
  const [channelSubscriberCount, setChannelSubscriberCount] = useState(0);
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

  const refreshCreatorLockStatus = useCallback(async () => {
    if (!isAuthenticated || !user || (user.role !== "creator" && user.role !== "admin")) {
      setCreatorLockStatus(null);
      return;
    }

    setLoadingCreatorLock(true);
    const res = await getCreatorWaveLockStatusApi();
    if (res.ok && "locked" in res.data) {
      setCreatorLockStatus(res.data as CreatorLockStatus);
      setCreatorLockError(null);
    } else {
      setCreatorLockStatus({ locked: false, lock: null });
      if (res.status !== 401) {
        setCreatorLockError("Unable to check creator lock status right now.");
      }
    }
    setLoadingCreatorLock(false);
  }, [isAuthenticated, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCreatorLockStatus();
  }, [refreshCreatorLockStatus]);

  const handlePayCreatorLock = useCallback(async () => {
    setCreatorLockError(null);
    setPayingCreatorLock(true);
    const res = await payCreatorWaveLockApi();
    if (!res.ok) {
      const err = res.data && "error" in res.data ? String(res.data.error) : "Payment failed";
      const required = (res.data && "required_amount_ngn" in res.data)
        ? Number((res.data as { required_amount_ngn?: number }).required_amount_ngn || 0)
        : null;
      const available = (res.data && "available_cash_ngn" in res.data)
        ? Number((res.data as { available_cash_ngn?: number }).available_cash_ngn || 0)
        : null;
      if (required != null && available != null) {
        setCreatorLockError(`${err}. Required: NGN ${required.toLocaleString()} | Available: NGN ${available.toLocaleString()}`);
      } else {
        setCreatorLockError(err);
      }
      setPayingCreatorLock(false);
      return;
    }

    await refreshCreatorLockStatus();
    setPayingCreatorLock(false);
  }, [refreshCreatorLockStatus]);

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

  useEffect(() => {
    serveBannerAdApi("page").then((res) => {
      if (res.ok && "ad" in res.data) setWaveAd(res.data.ad);
    }).catch(() => {});
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
      isAuthenticated ? checkChannelSubApi(channelId) : Promise.resolve(null),
    ]);

    if (channelRes.ok && "channel" in channelRes.data) {
      const ch = channelRes.data.channel;
      setChannelData(ch);
      setChannelSubscriberCount(ch.subscriber_count ?? ch.followers_count ?? 0);
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

    if (followRes && followRes.ok && "subscribed" in followRes.data) {
      // subscription check doesn't return count, use channel data
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

  useEffect(() => {
    if (!activeWave || !viewerSessionId) return;

    let cancelled = false;
    const run = async () => {
      setCheckingAccess(true);
      const res = await checkWaveAccessApi(activeWave.id, viewerSessionId);
      if (cancelled) return;

      if (res.ok && "allowed" in res.data) {
        const decision = res.data as WaveAccessDecision;
        if (decision.requires_consent && adultConsentSessionAccepted) {
          setAccessDecision({ ...decision, allowed: true, requires_consent: false, reason: null });
        } else {
          setAccessDecision(decision);
        }
      } else {
        setAccessDecision({
          allowed: false,
          requires_consent: false,
          reason: "Unable to verify content access right now",
          code: "ACCESS_CHECK_FAILED",
        });
      }

      setCheckingAccess(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeWave, viewerSessionId, adultConsentSessionAccepted]);

  const confirmAdultConsent = useCallback(async () => {
    if (!activeWave || !viewerSessionId) return;

    window.sessionStorage.setItem("av_adult_consent_ack", "1");
    setAdultConsentSessionAccepted(true);

    if (isAuthenticated) {
      await acknowledgeWaveAdultConsentApi(activeWave.id, viewerSessionId);
    }

    setAccessDecision({ allowed: true, requires_consent: false, reason: null });
  }, [activeWave, viewerSessionId, isAuthenticated]);

  const leaveAdultContent = useCallback(() => {
    if (activeIndex < waves.length - 1) {
      setActiveIndex((index) => Math.min(index + 1, waves.length - 1));
      if (!isDesktop) {
        const nextCard = cardRefs.current[activeIndex + 1];
        nextCard?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    if (activeIndex > 0) {
      setActiveIndex((index) => Math.max(index - 1, 0));
      if (!isDesktop) {
        const prevCard = cardRefs.current[activeIndex - 1];
        prevCard?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [activeIndex, waves.length, isDesktop]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  if (creatorLockStatus?.locked) {
    const fineAmount = Number(creatorLockStatus.lock?.fine_amount_ngn || 0);
    return (
      <div
        className="flex items-center justify-center min-h-screen px-4"
        style={{ background: "linear-gradient(180deg, #173A6D 0%, #050A30 100%)" }}
      >
        <div
          className="w-full max-w-xl rounded-2xl p-6 md:p-8"
          style={{
            background: "rgba(5,10,48,0.88)",
            border: "1px solid rgba(244,150,23,0.35)",
            boxShadow: "0 18px 70px rgba(0,0,0,0.45)",
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(244,150,23,0.2)", color: "#F5C16C" }}>
              <IcoLock />
            </div>
            <div>
              <h2 className="text-white text-lg font-semibold">Creator Access Locked</h2>
              <p className="text-white/60 text-sm">Community Standards fine settlement is required before creator actions resume.</p>
            </div>
          </div>

          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: "rgba(244,150,23,0.12)", border: "1px solid rgba(244,150,23,0.3)" }}
          >
            <p className="text-white/70 text-xs uppercase tracking-widest mb-1">Payable Fine</p>
            <p className="text-[#F5C16C] text-2xl font-bold">NGN {fineAmount.toLocaleString()}</p>
            <p className="text-white/50 text-xs mt-1">Reason: Community Standards Fine</p>
          </div>

          {creatorLockError && (
            <p className="text-red-300 text-sm mb-4">{creatorLockError}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handlePayCreatorLock}
              disabled={payingCreatorLock || loadingCreatorLock}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-opacity disabled:opacity-60"
              style={{ background: "linear-gradient(90deg, #F49617, #F5C16C)", color: "#050A30" }}
            >
              {payingCreatorLock ? "Processing..." : "Pay Fine & Unlock"}
            </button>
            <button
              onClick={() => void refreshCreatorLockStatus()}
              disabled={payingCreatorLock || loadingCreatorLock}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.16)" }}
            >
              Refresh Status
            </button>
          </div>
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
          channelSubscriberCount={channelSubscriberCount}
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
              width: "min(440px, 100%)",
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
                blockedReason={!checkingAccess && accessDecision && !accessDecision.allowed && !accessDecision.requires_consent ? accessDecision.reason || "This content is not available for your account." : null}
                requiresAdultConsent={Boolean(!checkingAccess && accessDecision?.requires_consent && !adultConsentSessionAccepted)}
                onConfirmAdultConsent={confirmAdultConsent}
                onLeaveRestrictedContent={leaveAdultContent}
                onAutoscrollChange={setAutoscroll}
                onPrevWave={activeIndex > 0 ? () => setActiveIndex((i) => i - 1) : undefined}
                onAdvanceWave={advanceWave}
                phoneMode
                channelData={channelData}
                channelSubscriberCount={channelSubscriberCount}
                totalReactions={totalReactions}
                onViewChannel={handleViewChannel}
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
        <div key={`wrap-${wave.id}`}>
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
              blockedReason={
                i === activeIndex && !checkingAccess && accessDecision && !accessDecision.allowed && !accessDecision.requires_consent
                  ? accessDecision.reason || "This content is not available for your account."
                  : null
              }
              requiresAdultConsent={Boolean(i === activeIndex && !checkingAccess && accessDecision?.requires_consent && !adultConsentSessionAccepted)}
              onConfirmAdultConsent={confirmAdultConsent}
              onLeaveRestrictedContent={leaveAdultContent}
              onAutoscrollChange={setAutoscroll}
              onAdvanceWave={advanceWave}
              channelData={i === activeIndex ? channelData : undefined}
              channelSubscriberCount={i === activeIndex ? channelSubscriberCount : undefined}
              totalReactions={i === activeIndex ? totalReactions : undefined}
              onViewChannel={handleViewChannel}
            />
          </div>
          {waveAd && (i + 1) % 8 === 0 && (
            <div
              key={`ad-${wave.id}`}
              style={{ height: "calc(100dvh - 64px)", scrollSnapAlign: "start" }}
            >
              <WaveSponsoredCard ad={waveAd} />
            </div>
          )}
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
