"use client";

import { useEffect, useRef } from "react";
import { NavLink } from "@/components/NavLink";
import Image from "next/image";
import { resolveWebsiteMediaUrl } from "@/lib/media";
import type { HomepageFeaturedSection } from "@/lib/homepage";

interface Channel {
  id: string;
  name: string;
  category: string;
  viewers: number;
  isLive: boolean;
  href?: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
}

const DEMO_CHANNELS: Channel[] = [
  { id: "1", name: "AfroBeats Live", category: "Music", viewers: 2400, isLive: true, href: "/channel/1" },
  { id: "2", name: "Tech Africa", category: "Technology", viewers: 1800, isLive: true, href: "/channel/2" },
  { id: "3", name: "Nollywood Now", category: "Entertainment", viewers: 5200, isLive: false, href: "/channel/3" },
  { id: "4", name: "Lagos Comedy Club", category: "Comedy", viewers: 980, isLive: true, href: "/channel/4" },
  { id: "5", name: "African Kitchen", category: "Lifestyle", viewers: 3100, isLive: false, href: "/channel/5" },
  { id: "6", name: "Safari Streams", category: "Nature", viewers: 1450, isLive: true, href: "/channel/6" },
  { id: "7", name: "Amapiano Radio", category: "Music", viewers: 7800, isLive: true, href: "/channel/7" },
  { id: "8", name: "Startup Hub", category: "Business", viewers: 620, isLive: false, href: "/channel/8" },
];

function formatViewers(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function ChannelCard({ channel }: { channel: Channel }) {
  const initials = channel.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  return (
    <NavLink
      href={channel.href || `/live/${channel.id}`}
      className="group flex-shrink-0 w-[280px] sm:w-[320px] rounded-2xl bg-av-card border border-av-input-border/30 overflow-hidden transition-all duration-300 hover:border-av-orange/40 hover:shadow-lg hover:shadow-av-orange/10 hover:-translate-y-1"
    >
      {/* Background visual */}
      <div
        className="relative h-36 bg-gradient-to-br from-av-light-blue/60 to-av-dark-blue overflow-hidden bg-cover bg-center"
        style={channel.bannerUrl ? { backgroundImage: `linear-gradient(180deg,rgba(5,10,48,0.18),rgba(5,10,48,0.82)), url(${resolveWebsiteMediaUrl(channel.bannerUrl)})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-av-card to-transparent" />

        {/* Live badge */}
        {channel.isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-av-error/90 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}

        {/* Viewer count */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-[10px] font-medium text-av-light-orange">
          👁 {formatViewers(channel.viewers)}
        </div>

        {/* Channel avatar */}
        <div className="absolute bottom-3 left-4 w-14 h-14 rounded-xl bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-lg font-bold text-av-dark-blue shadow-lg ring-2 ring-av-card transition-transform group-hover:scale-110">
          {channel.logoUrl ? (
            <Image
              src={resolveWebsiteMediaUrl(channel.logoUrl)}
              alt={channel.name}
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            initials
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 pt-3">
        <h3 className="text-sm font-semibold text-av-white truncate group-hover:text-av-orange transition-colors">
          {channel.name}
        </h3>
        <p className="text-xs text-av-light-orange mt-0.5">{channel.category}</p>
      </div>
    </NavLink>
  );
}

function ChannelSkeleton() {
  return (
    <div className="flex-shrink-0 w-[280px] sm:w-[320px] rounded-2xl overflow-hidden">
      <div className="h-36 animate-shimmer" />
      <div className="p-4 bg-av-card">
        <div className="h-4 w-3/4 rounded animate-shimmer mb-2" />
        <div className="h-3 w-1/2 rounded animate-shimmer" />
      </div>
    </div>
  );
}

export function FeaturedChannels({ section, loading: externalLoading }: { section?: HomepageFeaturedSection; loading?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const channels = (section?.items?.length
    ? section.items.map((item) => ({
        id: item.channel_id,
        name: item.name,
        category: item.category,
        viewers: item.viewers,
        isLive: item.is_live,
        href: item.href,
        bannerUrl: item.banner_url,
        logoUrl: item.logo_url,
      }))
    : DEMO_CHANNELS).sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    return b.viewers - a.viewers;
  });

  useEffect(() => {
    if (!section?.auto_slide || channels.length < 2 || !scrollRef.current) return;
    const node = scrollRef.current;
    const amount = 340;
    const interval = window.setInterval(() => {
      const maxScroll = node.scrollWidth - node.clientWidth;
      const target = node.scrollLeft + amount >= maxScroll - 10 ? 0 : node.scrollLeft + amount;
      node.scrollTo({ left: target, behavior: "smooth" });
    }, 4200);
    return () => window.clearInterval(interval);
  }, [section?.auto_slide, channels.length]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 340;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const isEmpty = channels.length === 0;
  const isLoading = externalLoading ?? false;

  return (
    <section className="py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-av-white tracking-tight">
              {section?.title || "🔥 Featured Channels"}
            </h2>
            <p className="text-sm text-av-light-orange mt-1">
              {section?.subtitle || "Trending live and popular channels right now"}
            </p>
          </div>

          {!isEmpty && (
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => scroll("left")}
                className="w-9 h-9 rounded-lg bg-av-card border border-av-input-border/30 flex items-center justify-center text-av-light-orange hover:text-av-white hover:border-av-orange/40 transition-all"
                aria-label="Scroll left"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M10 4l-4 4 4 4" />
                </svg>
              </button>
              <button
                onClick={() => scroll("right")}
                className="w-9 h-9 rounded-lg bg-av-card border border-av-input-border/30 flex items-center justify-center text-av-light-orange hover:text-av-white hover:border-av-orange/40 transition-all"
                aria-label="Scroll right"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </button>
              <NavLink
                href={section?.cta_href || "/channels"}
                className="ml-2 text-xs font-semibold text-av-orange hover:text-av-light-orange transition-colors"
              >
                {section?.cta_label || "View All →"}
              </NavLink>
            </div>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex gap-5 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <ChannelSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && isEmpty && (
          <div className="text-center py-16 rounded-2xl bg-av-card/50 border border-av-input-border/20">
            <p className="text-4xl mb-3">📡</p>
            <p className="text-av-light-orange text-sm">
              No featured channels right now. Check back soon!
            </p>
          </div>
        )}

        {/* Channel marquee */}
        {!isLoading && !isEmpty && (
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto hide-scrollbar pb-2 -mx-6 px-6 lg:-mx-8 lg:px-8"
          >
            {channels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
