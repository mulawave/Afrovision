"use client";

import { useState, useEffect, useCallback } from "react";
import { NavLink } from "@/components/NavLink";
import type { HomepageUpcomingSection } from "@/lib/homepage";
import {
  getUpcomingShowsApi,
  getMyRemindersApi,
  setReminderApi,
  removeReminderApi,
  type UpcomingProgram,
} from "@/lib/api";

// Category → emoji mapping
const CATEGORY_ICONS: Record<string, string> = {
  music: "🎵",
  technology: "💻",
  comedy: "😂",
  nature: "🦁",
  business: "🚀",
  sports: "⚽",
  news: "📰",
  education: "📚",
  entertainment: "🎬",
  documentary: "🎥",
  community: "🌍",
};

function iconForCategory(category: string): string {
  return CATEGORY_ICONS[category?.toLowerCase()] || "📺";
}

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = targetMs - Date.now();
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
  }, [targetMs]);

  return remaining;
}

function ShowCard({
  show,
  reminded,
  onToggleReminder,
}: {
  show: UpcomingProgram;
  reminded: boolean;
  onToggleReminder: (programId: string, currentlySet: boolean) => void;
}) {
  const countdown = useCountdown(show.start_time);
  const time = new Date(show.start_time);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    await onToggleReminder(show.id, reminded);
    setLoading(false);
  };

  return (
    <article className="group rounded-2xl bg-av-card border border-av-input-border/30 p-5 transition-all duration-300 hover:border-av-orange/30 hover:shadow-lg hover:shadow-av-orange/5 hover:-translate-y-0.5 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">{iconForCategory(show.channel_category)}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-av-white truncate group-hover:text-av-orange transition-colors">
            {show.video_title}
          </h3>
          <p className="text-xs text-av-light-orange truncate">{show.channel_name}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-0.5 rounded-full bg-av-light-blue/30 border border-av-input-border/30 text-[10px] font-medium text-av-light-orange">
          {show.channel_category || "General"}
        </span>
        <span className="text-[10px] text-av-light-orange" suppressHydrationWarning>
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
        <p className="text-[10px] uppercase tracking-wider text-av-light-orange mb-0.5">
          Starts in
        </p>
        <p className="text-sm font-bold font-mono text-av-light-orange tabular-nums" suppressHydrationWarning>
          {countdown}
        </p>
      </div>

      {/* Reminder CTA */}
      <button
        onClick={handleClick}
        disabled={loading}
        className={`mt-auto w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
          reminded
            ? "bg-av-orange/15 text-av-orange border border-av-orange/30"
            : "bg-av-input-fill border border-av-input-border/40 text-av-light-orange hover:text-av-white hover:border-av-orange/40"
        } ${loading ? "opacity-50 cursor-wait" : ""}`}
      >
        {loading ? "..." : reminded ? "✓ Reminder Set" : "🔔 Set Reminder"}
      </button>
    </article>
  );
}

export function UpcomingShows({ section }: { section?: HomepageUpcomingSection }) {
  const [shows, setShows] = useState<UpcomingProgram[]>([]);
  const [reminderIds, setReminderIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Fetch upcoming shows from live schedule
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getUpcomingShowsApi();
        if (!cancelled && res.ok && "upcoming" in res.data) {
          setShows(res.data.upcoming);
        }
      } catch {
        // silently fall back to empty
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch user's active reminders (only if logged in)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyRemindersApi();
        if (!cancelled && res.ok && "reminders" in res.data) {
          setReminderIds(new Set(res.data.reminders.map((r) => r.program_id)));
        }
      } catch {
        // not logged in or error — ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleToggleReminder = useCallback(
    async (programId: string, currentlySet: boolean) => {
      try {
        if (currentlySet) {
          const res = await removeReminderApi(programId);
          if (res.ok) {
            setReminderIds((prev) => {
              const next = new Set(prev);
              next.delete(programId);
              return next;
            });
          }
        } else {
          const res = await setReminderApi(programId);
          if (res.ok) {
            setReminderIds((prev) => new Set(prev).add(programId));
          }
        }
      } catch {
        // ignore
      }
    },
    []
  );

  // Use section items as fallback if API returned nothing but section prop has items
  const displayShows =
    shows.length > 0
      ? shows
      : section?.items?.length
        ? section.items.map((item) => ({
            id: item.id,
            channel_id: "",
            channel_name: item.channel,
            channel_category: item.category,
            video_title: item.title,
            video_thumbnail: null,
            start_time: new Date(item.scheduled_at).getTime(),
            end_time: new Date(item.scheduled_at).getTime() + 3600000,
          }))
        : [];

  const isEmpty = loaded && displayShows.length === 0;

  return (
    <section className="py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-av-white tracking-tight">
              {section?.title || "📅 Upcoming Shows"}
            </h2>
            <p className="text-sm text-av-light-orange mt-1">
              {section?.subtitle || "Don\u0027t miss these live events \u2014 set a reminder"}
            </p>
          </div>
          <NavLink
            href={section?.cta_href || "/schedule"}
            className="hidden sm:inline-flex text-xs font-semibold text-av-orange hover:text-av-light-orange transition-colors"
          >
            {section?.cta_label || "Full Schedule →"}
          </NavLink>
        </div>

        {/* Loading state */}
        {!loaded && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-av-card/50 border border-av-input-border/20 p-5 animate-pulse h-52"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="text-center py-16 rounded-2xl bg-av-card/50 border border-av-input-border/20">
            <p className="text-4xl mb-3">🗓️</p>
            <p className="text-av-light-orange text-sm">
              No upcoming shows scheduled. Stay tuned!
            </p>
          </div>
        )}

        {/* Show grid */}
        {loaded && displayShows.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {displayShows.map((show) => (
              <ShowCard
                key={show.id}
                show={show}
                reminded={reminderIds.has(show.id)}
                onToggleReminder={handleToggleReminder}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
