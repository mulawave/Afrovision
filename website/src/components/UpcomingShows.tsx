"use client";

import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import type { HomepageUpcomingSection } from "@/lib/homepage";

interface Show {
  id: string;
  title: string;
  channel: string;
  category: string;
  scheduledAt: string; // ISO date
  icon: string;
}

const DEMO_SHOWS: Show[] = [
  {
    id: "1",
    title: "AfroBeats Friday Night",
    channel: "AfroBeats Live",
    category: "Music",
    scheduledAt: new Date(Date.now() + 3 * 3600000).toISOString(),
    icon: "🎵",
  },
  {
    id: "2",
    title: "Tech Talk: AI in Africa",
    channel: "Tech Africa",
    category: "Technology",
    scheduledAt: new Date(Date.now() + 8 * 3600000).toISOString(),
    icon: "💻",
  },
  {
    id: "3",
    title: "Stand-Up Special: Lagos Laughs",
    channel: "Lagos Comedy Club",
    category: "Comedy",
    scheduledAt: new Date(Date.now() + 26 * 3600000).toISOString(),
    icon: "😂",
  },
  {
    id: "4",
    title: "Safari Sunset Stream",
    channel: "Safari Streams",
    category: "Nature",
    scheduledAt: new Date(Date.now() + 50 * 3600000).toISOString(),
    icon: "🦁",
  },
  {
    id: "5",
    title: "Amapiano Live Mix",
    channel: "Amapiano Radio",
    category: "Music",
    scheduledAt: new Date(Date.now() + 72 * 3600000).toISOString(),
    icon: "🎧",
  },
  {
    id: "6",
    title: "Startup Pitch Night",
    channel: "Startup Hub",
    category: "Business",
    scheduledAt: new Date(Date.now() + 96 * 3600000).toISOString(),
    icon: "🚀",
  },
];

function useCountdown(targetDate: string) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Starting soon");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h >= 24) {
        const d = Math.floor(h / 24);
        setRemaining(`${d}d ${h % 24}h`);
      } else {
        setRemaining(`${h}h ${m}m ${s}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return remaining;
}

function ShowCard({ show }: { show: Show }) {
  const countdown = useCountdown(show.scheduledAt);
  const [reminded, setReminded] = useState(false);
  const time = new Date(show.scheduledAt);

  return (
    <article className="group rounded-2xl bg-av-card border border-av-input-border/30 p-5 transition-all duration-300 hover:border-av-orange/30 hover:shadow-lg hover:shadow-av-orange/5 hover:-translate-y-0.5 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">{show.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-av-white truncate group-hover:text-av-orange transition-colors">
            {show.title}
          </h3>
          <p className="text-xs text-av-hint truncate">{show.channel}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-0.5 rounded-full bg-av-light-blue/30 border border-av-input-border/30 text-[10px] font-medium text-av-white/70">
          {show.category}
        </span>
        <span className="text-[10px] text-av-hint" suppressHydrationWarning>
          {time.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}{" "}
          •{" "}
          {time.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Countdown */}
      <div className="px-3 py-2 rounded-lg bg-av-dark-blue/80 border border-av-input-border/20 mb-4">
        <p className="text-[10px] uppercase tracking-wider text-av-hint mb-0.5">
          Starts in
        </p>
        <p className="text-sm font-bold font-mono text-av-light-orange tabular-nums" suppressHydrationWarning>
          {countdown}
        </p>
      </div>

      {/* Reminder CTA */}
      <button
        onClick={() => setReminded(!reminded)}
        className={`mt-auto w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
          reminded
            ? "bg-av-orange/15 text-av-orange border border-av-orange/30"
            : "bg-av-input-fill border border-av-input-border/40 text-av-white/70 hover:text-av-white hover:border-av-orange/40"
        }`}
      >
        {reminded ? "✓ Reminder Set" : "🔔 Set Reminder"}
      </button>
    </article>
  );
}

export function UpcomingShows({ section }: { section?: HomepageUpcomingSection }) {
  const shows = section?.items?.length
    ? section.items.map((item) => ({
        id: item.id,
        title: item.title,
        channel: item.channel,
        category: item.category,
        scheduledAt: item.scheduled_at,
        icon: item.icon,
      }))
    : DEMO_SHOWS;
  const isEmpty = shows.length === 0;

  return (
    <section className="py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-av-white tracking-tight">
              {section?.title || "📅 Upcoming Shows"}
            </h2>
            <p className="text-sm text-av-hint mt-1">
              {section?.subtitle || "Don&apos;t miss these live events — set a reminder"}
            </p>
          </div>
          <NavLink
            href={section?.cta_href || "/schedule"}
            className="hidden sm:inline-flex text-xs font-semibold text-av-orange hover:text-av-light-orange transition-colors"
          >
            {section?.cta_label || "Full Schedule →"}
          </NavLink>
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="text-center py-16 rounded-2xl bg-av-card/50 border border-av-input-border/20">
            <p className="text-4xl mb-3">🗓️</p>
            <p className="text-av-hint text-sm">
              No upcoming shows scheduled. Check back later!
            </p>
          </div>
        )}

        {/* Show grid */}
        {!isEmpty && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {shows.map((show) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
