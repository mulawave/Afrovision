"use client";

import { useState, useEffect, useCallback } from "react";
import { NavLink } from "@/components/NavLink";
import { resolveWebsiteMediaUrl } from "@/lib/media";
import type { HomepageHeroSlide } from "@/lib/homepage";

interface Slide {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  cta: { label: string; href: string };
  secondaryCta?: { label: string; href: string } | null;
  icon: string;
  isLive?: boolean;
  viewers?: number | null;
  channel?: string;
  imageUrl?: string | null;
}

function formatViewers(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

const SLIDES: Slide[] = [
  {
    id: "1",
    type: "live",
    title: "AfroBeats Friday Night",
    subtitle: "LIVE NOW",
    description:
      "The biggest Afrobeats DJs are live right now. Join the party, send gifts, and earn VPT while vibing with thousands of fans.",
    cta: { label: "Watch Live Now", href: "/live/1" },
    secondaryCta: { label: "Browse All Live", href: "/live" },
    icon: "🔴",
    isLive: true,
    viewers: 12400,
    channel: "AfroBeats Live",
  },
  {
    id: "2",
    type: "promo",
    title: "Watch. Earn. Connect.",
    subtitle: "Africa's Premier Streaming Platform",
    description:
      "Join thousands of creators and viewers on the continent's most vibrant live streaming community. Earn VPT rewards while you watch.",
    cta: { label: "Explore Channels", href: "/channels" },
    secondaryCta: { label: "Download App", href: "/download" },
    icon: "🎬",
  },
  {
    id: "3",
    type: "challenge",
    title: "AfroVision Challenge",
    subtitle: "Season 1 — ₦5M+ Prize Pool",
    description:
      "Compete, stream, and win big. The continent's biggest creator challenge is live. 200+ contestants, 10 categories, real prizes.",
    cta: { label: "Join the Challenge", href: "#challenge" },
    secondaryCta: { label: "Watch Auditions", href: "/challenge/auditions" },
    icon: "🏆",
  },
  {
    id: "4",
    type: "live",
    title: "Tech Talk: AI in Africa",
    subtitle: "LIVE NOW",
    description:
      "Join the conversation about artificial intelligence and its impact on African tech ecosystems. Top speakers, real insights.",
    cta: { label: "Watch Live Now", href: "/live/2" },
    secondaryCta: { label: "Set Reminder", href: "/schedule" },
    icon: "🔴",
    isLive: true,
    viewers: 3200,
    channel: "Tech Africa",
  },
];

const AUTO_PLAY_MS = 6000;

function slideGradient(type: string): string {
  if (type === "live") return "from-av-error/20 via-av-dark-blue to-av-dark-blue";
  if (type === "challenge") return "from-av-orange/20 via-av-dark-blue to-av-dark-blue";
  if (type === "sponsor") return "from-av-light-orange/18 via-av-dark-blue to-av-dark-blue";
  return "from-av-light-blue/20 via-av-dark-blue to-av-dark-blue";
}

function mapSlide(slide: HomepageHeroSlide): Slide {
  return {
    id: slide.id,
    type: slide.type,
    title: slide.title,
    subtitle: slide.subtitle,
    description: slide.description,
    cta: slide.cta,
    secondaryCta: slide.secondary_cta,
    icon: slide.icon,
    isLive: slide.is_live,
    viewers: slide.viewers,
    channel: slide.channel_name,
    imageUrl: slide.image_url,
  };
}

export function HeroSlider({ slides, autoRotateMs = AUTO_PLAY_MS }: { slides?: HomepageHeroSlide[]; autoRotateMs?: number }) {
  const items = slides?.length ? slides.map(mapSlide) : SLIDES;
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning || index === current) return;
      setIsTransitioning(true);
      setCurrent(index);
      setTimeout(() => setIsTransitioning(false), 700);
    },
    [current, isTransitioning]
  );

  const next = useCallback(() => {
    goTo((current + 1) % items.length);
  }, [current, goTo, items.length]);

  useEffect(() => {
    const timer = setInterval(next, autoRotateMs);
    return () => clearInterval(timer);
  }, [next, autoRotateMs]);

  const slide = items[current] || items[0];
  const imageUrl = resolveWebsiteMediaUrl(slide?.imageUrl);

  if (!slide) return null;

  return (
    <section className="relative min-h-[600px] lg:min-h-[700px] flex items-center overflow-hidden">
      {/* Background gradient layer */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${slideGradient(slide.type)} transition-all duration-700`}
      />
      {imageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-75 transition-all duration-700"
          style={{
            backgroundImage: `linear-gradient(110deg, rgba(5,10,48,0.84) 10%, rgba(5,10,48,0.55) 46%, rgba(5,10,48,0.9) 100%), url(${imageUrl})`,
          }}
        />
      ) : null}

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-av-orange/5 blur-3xl" />
        <div className="absolute -bottom-60 -left-40 w-[500px] h-[500px] rounded-full bg-av-light-blue/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-av-input-border/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-av-input-border/5" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full pt-24 lg:pt-32 pb-16">
        <div className="max-w-2xl">
          {/* LIVE + Viewer badge row */}
          {slide.isLive && (
            <div
              key={`live-${slide.id}`}
              className="animate-fade-in-up flex items-center gap-3 mb-4"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-av-error/90 text-[11px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              {slide.viewers && (
                <span className="px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm text-[11px] font-medium text-av-white/80">
                  👁 {formatViewers(slide.viewers)} watching
                </span>
              )}
              {slide.channel && (
                <span className="hidden sm:inline-flex px-3 py-1 rounded-full bg-av-card/60 border border-av-input-border/30 text-[11px] font-medium text-av-light-orange">
                  📺 {slide.channel}
                </span>
              )}
            </div>
          )}

          {/* Badge */}
          <div
            key={`badge-${slide.id}`}
            className="animate-fade-in-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-av-card/80 border border-av-input-border/40 text-xs font-semibold uppercase tracking-widest text-av-light-orange mb-6"
          >
            <span>{slide.icon}</span>
            <span>{slide.subtitle}</span>
          </div>

          {/* Title */}
          <h1
            key={`title-${slide.id}`}
            className="animate-fade-in-up text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6"
          >
            {slide.title.split(". ").map((part, i) => (
              <span key={i}>
                {i > 0 && <span className="text-av-orange">. </span>}
                <span className={i === 1 ? "text-av-orange" : "text-av-white"}>
                  {part}
                </span>
              </span>
            ))}
          </h1>

          {/* Description */}
          <p
            key={`desc-${slide.id}`}
            className="animate-fade-in-up text-base lg:text-lg text-av-white/70 leading-relaxed mb-8 max-w-lg"
            style={{ animationDelay: "0.15s" }}
          >
            {slide.description}
          </p>

          {/* CTA row */}
          <div
            className="animate-fade-in-up flex flex-wrap gap-4"
            style={{ animationDelay: "0.3s" }}
          >
            <NavLink
              href={slide.cta.href}
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-bold rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-xl hover:shadow-av-orange/25 hover:scale-105 active:scale-95"
              spinnerClassName="w-4 h-4"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              {slide.cta.label}
            </NavLink>
            {slide.secondaryCta && (
              <NavLink
                href={slide.secondaryCta.href}
                className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium rounded-full border border-av-white/20 text-av-white hover:bg-av-white/5 transition-all"
                spinnerClassName="w-4 h-4"
              >
                {slide.secondaryCta.label}
              </NavLink>
            )}
          </div>
        </div>

        {/* Slide indicators */}
        <div className="flex items-center gap-3 mt-12">
          {items.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`relative h-1.5 rounded-full transition-all duration-500 ${
                i === current
                  ? "w-10 bg-av-orange"
                  : "w-5 bg-av-white/20 hover:bg-av-white/40"
              }`}
            >
              {i === current && (
                <span className="absolute inset-0 rounded-full bg-av-orange animate-pulse" />
              )}
            </button>
          ))}
          <span className="ml-4 text-xs text-av-hint font-mono tabular-nums">
            {String(current + 1).padStart(2, "0")} /{" "}
            {String(items.length).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-av-dark-blue to-transparent pointer-events-none" />
    </section>
  );
}
