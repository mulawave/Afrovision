"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Advertisement } from "@/lib/api";
import { resolveWebsiteMediaUrl } from "@/lib/media";

interface AdBreakProps {
  ads: Advertisement[];
  channelName: string;
  channelId?: string;
  onImpression: (ad: Advertisement) => void;
  onComplete: () => void;
}

type Phase = "intro" | "playing" | "outro";

export function AdBreak({ ads, channelName, onImpression, onComplete }: AdBreakProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [countdown, setCountdown] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const impressionRecorded = useRef<Set<string>>(new Set());

  const currentAd = ads[currentIndex] ?? null;
  const totalAds = ads.length;
  const introDelayMs = currentIndex === 0 ? 2000 : 800;

  // Phase: intro → playing → (next ad or outro) → complete
  useEffect(() => {
    if (phase === "intro") {
      const timer = setTimeout(() => {
        setCountdown(Math.ceil(currentAd?.duration || 15));
        setPhase("playing");
      }, introDelayMs);
      return () => clearTimeout(timer);
    }
    if (phase === "outro") {
      const timer = setTimeout(() => onComplete(), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentAd, introDelayMs, onComplete, phase]);

  // When phase becomes "playing", start the video
  useEffect(() => {
    if (phase !== "playing" || !videoRef.current || !currentAd) return;
    const vid = videoRef.current;
    vid.currentTime = 0;
    vid.play().catch(() => {});
  }, [phase, currentIndex, currentAd]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "playing" || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, countdown]);

  // Record impression when ad starts playing
  useEffect(() => {
    if (phase !== "playing" || !currentAd) return;
    if (impressionRecorded.current.has(currentAd.id)) return;
    impressionRecorded.current.add(currentAd.id);
    onImpression(currentAd);
  }, [phase, currentAd, onImpression]);

  const handleVideoEnded = useCallback(() => {
    // Move to next ad or outro
    if (currentIndex < totalAds - 1) {
      setCurrentIndex((i) => i + 1);
      setPhase("intro");
    } else {
      setPhase("outro");
    }
  }, [currentIndex, totalAds]);

  // Fallback: if video stalls or errors, skip after duration
  useEffect(() => {
    if (phase !== "playing" || !currentAd) return;
    const maxDuration = (currentAd.duration || 15) + 3; // 3s grace
    const timer = setTimeout(() => {
      handleVideoEnded();
    }, maxDuration * 1000);
    return () => clearTimeout(timer);
  }, [phase, currentAd, currentIndex, handleVideoEnded]);

  const getCategoryLabel = (cat: string) => {
    if (cat === "in_stream_pre") return "Pre-Roll";
    if (cat === "in_stream_mid") return "Mid-Roll";
    if (cat === "in_stream_brief") return "Brief";
    return "Ad";
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
      {/* ── INTRO PHASE ── */}
      {phase === "intro" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#050A30] via-[#0a1545] to-[#050A30]" />

          {/* Animated lines */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F49617]/40 to-transparent animate-pulse" />
            <div className="absolute top-[45%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F5C16C]/20 to-transparent" />
            <div className="absolute top-[55%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F5C16C]/20 to-transparent" />
          </div>

          <div className="relative z-10 text-center">
            {/* AfroVision logo text */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F49617] to-[#F5C16C] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#050A30">
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-av-light-orange tracking-wide">AfroVision</span>
            </div>

            {/* Ad break text */}
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              Ad Break
            </h2>
            <p className="text-sm text-av-light-orange">
              {totalAds} ad{totalAds !== 1 ? "s" : ""} · Returning to{" "}
              <span className="text-[#F5C16C]">{channelName}</span> shortly
            </p>

            {/* Loading spinner */}
            <div className="mt-8 flex justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-[#F49617]/30 border-t-[#F49617] animate-spin" />
            </div>
          </div>
        </div>
      )}

      {/* ── PLAYING PHASE ── */}
      {phase === "playing" && currentAd && (
        <>
          {/* Ad video */}
          <video
            ref={videoRef}
            src={resolveWebsiteMediaUrl(currentAd.media_url)}
            className="w-full h-full object-contain bg-black"
            playsInline
            onEnded={handleVideoEnded}
            onError={handleVideoEnded}
          />

          {/* Top bar: Ad indicator */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F49617]/90 text-[10px] font-bold uppercase tracking-wider text-[#050A30]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
                </svg>
                Ad {currentIndex + 1} of {totalAds}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-medium text-av-light-orange">
                {getCategoryLabel(currentAd.category)}
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-mono text-av-light-orange">
              {countdown > 0 ? `${countdown}s` : "Ending..."}
            </span>
          </div>

          {/* Bottom bar: Ad title + click URL */}
          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent">
            {/* Progress bar */}
            <div className="w-full h-1 rounded-full bg-white/10 mb-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F49617] to-[#F5C16C] transition-all duration-1000 ease-linear"
                style={{
                  width: `${currentAd.duration ? ((currentAd.duration - countdown) / currentAd.duration) * 100 : 50}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-av-light-orange truncate">{currentAd.title}</p>
                {currentAd.description && (
                  <p className="text-[10px] text-av-light-orange truncate mt-0.5">{currentAd.description}</p>
                )}
              </div>
              {currentAd.click_url && (
                <a
                  href={currentAd.click_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-[10px] font-semibold text-white hover:bg-white/20 transition-all pointer-events-auto"
                >
                  Learn More
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── OUTRO PHASE ── */}
      {phase === "outro" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-b from-[#050A30] via-[#0a1545] to-[#050A30]" />

          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F49617]/40 to-transparent animate-pulse" />
          </div>

          <div className="relative z-10 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F49617] to-[#F5C16C] flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#050A30">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Returning to <span className="text-[#F5C16C]">{channelName}</span>
            </h2>
            <p className="text-sm text-av-light-orange">Your program continues now</p>

            <div className="mt-6 flex justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-[#F5C16C]/30 border-t-[#F5C16C] animate-spin" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
