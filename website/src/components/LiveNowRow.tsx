"use client";

import { useEffect, useRef } from "react";
import { NavLink } from "@/components/NavLink";
import Image from "next/image";
import { resolveWebsiteMediaUrl } from "@/lib/media";
import type { HomepageLiveSection } from "@/lib/homepage";

interface LiveStream {
  id: string;
  title: string;
  channel: string;
  category: string;
  viewers: number;
  thumbnail: string;
  href?: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
}

const LIVE_STREAMS: LiveStream[] = [
  {
    id: "1",
    title: "AfroBeats Friday Night Party",
    channel: "AfroBeats Live",
    category: "Music",
    viewers: 12400,
    thumbnail: "🎵",
    href: "/live/1",
  },
  {
    id: "2",
    title: "AI in Africa: Tech Talk",
    channel: "Tech Africa",
    category: "Technology",
    viewers: 3200,
    thumbnail: "💻",
    href: "/live/2",
  },
  {
    id: "3",
    title: "Lagos Night Comedy Show",
    channel: "Lagos Comedy Club",
    category: "Comedy",
    viewers: 980,
    thumbnail: "😂",
    href: "/live/3",
  },
  {
    id: "4",
    title: "Safari Wildlife Stream",
    channel: "Safari Streams",
    category: "Nature",
    viewers: 1450,
    thumbnail: "🦁",
    href: "/live/4",
  },
  {
    id: "5",
    title: "Amapiano Bass Session",
    channel: "Amapiano Radio",
    category: "Music",
    viewers: 7800,
    thumbnail: "🎧",
    href: "/live/5",
  },
  {
    id: "6",
    title: "Late Night Talk Show",
    channel: "Naija TV",
    category: "Entertainment",
    viewers: 2100,
    thumbnail: "🎤",
    href: "/live/6",
  },
];

function formatViewers(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function LiveCard({ stream }: { stream: LiveStream }) {
  return (
    <NavLink
      href={stream.href || `/live/${stream.id}`}
      className="group flex-shrink-0 w-[220px] sm:w-[260px] rounded-xl overflow-hidden bg-av-card border border-av-input-border/30 transition-all duration-300 hover:border-av-error/50 hover:shadow-lg hover:shadow-av-error/10 hover:-translate-y-1"
    >
      {/* Thumbnail area */}
      <div
        className="relative h-32 bg-gradient-to-br from-av-light-blue/40 to-av-dark-blue flex items-center justify-center overflow-hidden bg-cover bg-center"
        style={stream.bannerUrl ? { backgroundImage: `linear-gradient(180deg,rgba(5,10,48,0.2),rgba(5,10,48,0.82)), url(${resolveWebsiteMediaUrl(stream.bannerUrl)})` } : undefined}
      >
        <span className="text-4xl group-hover:scale-110 transition-transform duration-300">
          {stream.thumbnail}
        </span>

        {/* LIVE badge overlay */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-av-error/90 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Viewer count overlay */}
        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-medium text-av-white/80">
          👁 {formatViewers(stream.viewers)}
        </div>
        {stream.logoUrl ? (
          <div className="absolute bottom-2.5 left-2.5 h-10 w-10 overflow-hidden rounded-lg border border-av-white/15 bg-av-card/85 shadow-lg">
            <Image
              src={resolveWebsiteMediaUrl(stream.logoUrl)}
              alt={stream.channel}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        ) : null}

        {/* Play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
          <div className="w-12 h-12 rounded-full bg-av-error/90 flex items-center justify-center shadow-lg">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="white"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="text-xs font-semibold text-av-white truncate group-hover:text-av-error transition-colors">
          {stream.title}
        </h4>
        <p className="text-[11px] text-av-hint mt-0.5 truncate">
          {stream.channel} · {stream.category}
        </p>
      </div>
    </NavLink>
  );
}

export function LiveNowRow({ section }: { section?: HomepageLiveSection }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const streams = (section?.items?.length
    ? section.items.map((item) => ({
        id: item.channel_id,
        title: item.title,
        channel: item.channel,
        category: item.category,
        viewers: item.viewers,
        thumbnail: item.emoji,
        href: item.href,
        bannerUrl: item.banner_url,
        logoUrl: item.logo_url,
      }))
    : LIVE_STREAMS).sort((a, b) => b.viewers - a.viewers);

  useEffect(() => {
    if (!section?.auto_slide || streams.length < 2 || !scrollRef.current) return;
    const node = scrollRef.current;
    const amount = 280;
    const interval = window.setInterval(() => {
      const maxScroll = node.scrollWidth - node.clientWidth;
      const target = node.scrollLeft + amount >= maxScroll - 10 ? 0 : node.scrollLeft + amount;
      node.scrollTo({ left: target, behavior: "smooth" });
    }, 3800);
    return () => window.clearInterval(interval);
  }, [section?.auto_slide, streams.length]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -280 : 280,
      behavior: "smooth",
    });
  };

  if (streams.length === 0) return null;

  return (
    <section className="py-10 lg:py-14">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="flex items-end justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-av-error/15 border border-av-error/30">
              <span className="w-2 h-2 rounded-full bg-av-error animate-pulse" />
              <span className="text-xs font-bold text-av-error uppercase tracking-wider">
                {section?.badge_text || "Live Now"}
              </span>
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-av-white tracking-tight">
                {section?.title || "Streams Happening Now"}
              </h2>
              <p className="text-xs text-av-hint mt-0.5">
                {streams.length} live streams · {section?.subtitle || "Jump in before you miss out"}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => scroll("left")}
              className="w-8 h-8 rounded-lg bg-av-card border border-av-input-border/30 flex items-center justify-center text-av-hint hover:text-av-white hover:border-av-error/40 transition-all"
              aria-label="Scroll left"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 3l-4 4 4 4" />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-8 h-8 rounded-lg bg-av-card border border-av-input-border/30 flex items-center justify-center text-av-hint hover:text-av-white hover:border-av-error/40 transition-all"
              aria-label="Scroll right"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 3l4 4-4 4" />
              </svg>
            </button>
            <NavLink
              href={section?.cta_href || "/live"}
              className="ml-2 text-xs font-semibold text-av-error hover:text-av-error/80 transition-colors"
            >
              {section?.cta_label || "View All Live →"}
            </NavLink>
          </div>
        </div>

        {/* Live streams row */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 -mx-6 px-6 lg:-mx-8 lg:px-8"
        >
          {streams.map((stream) => (
            <LiveCard key={stream.id} stream={stream} />
          ))}
        </div>

        {/* Mobile "View All" */}
        <div className="sm:hidden mt-4 text-center">
          <NavLink
            href={section?.cta_href || "/live"}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-av-error border border-av-error/30 rounded-full hover:bg-av-error/10 transition-all"
          >
            {section?.cta_label || "View All Live Streams →"}
          </NavLink>
        </div>
      </div>
    </section>
  );
}
