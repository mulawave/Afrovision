"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getChannelAnalyticsApi,
  getChannelApi,
  type ChannelAnalytics,
  type Channel,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

/* ── helpers ──────────────────────────────────────────── */

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtNgn(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString()}`;
}

const PERIODS = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
  { label: "1 Year", value: "365d" },
];

/* ── sub-components ───────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-4 flex flex-col gap-1">
      <span className="text-xs text-av-hint uppercase tracking-wider">{label}</span>
      <span
        className={`text-2xl font-bold ${accent ? "text-av-orange" : "text-av-white"}`}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-av-hint">{sub}</span>}
    </div>
  );
}

function BarChart({
  bars,
  highlightIndex,
  labelFn,
  height = 120,
}: {
  bars: { value: number }[];
  highlightIndex?: number;
  labelFn?: (i: number) => string;
  height?: number;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex items-end gap-[2px] overflow-x-auto pb-1" style={{ height }}>
      {bars.map((bar, i) => {
        const pct = bar.value / max;
        const barH = Math.max(pct * (height - 20), bar.value > 0 ? 4 : 2);
        const isHighlight = i === highlightIndex;
        return (
          <div
            key={i}
            className="flex flex-col items-center flex-1 min-w-[8px] group cursor-pointer"
            title={labelFn ? `${labelFn(i)}: ${fmt(bar.value)}` : `${fmt(bar.value)}`}
          >
            <div
              style={{ height: barH }}
              className={`w-full rounded-t transition-all ${
                isHighlight
                  ? "bg-av-orange"
                  : bar.value > 0
                  ? "bg-av-light-blue group-hover:bg-av-light-orange/60"
                  : "bg-av-input-border/20"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

function DemographicBar({
  label,
  count,
  pct,
}: {
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-av-hint truncate">{label}</span>
      <div className="flex-1 h-2 bg-av-input-border/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-av-orange rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, pct > 0 ? 1 : 0)}%` }}
        />
      </div>
      <span className="text-xs text-av-white w-10 text-right">{fmt(count)}</span>
      <span className="text-xs text-av-hint w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

/* ── main page wrapper (Suspense boundary) ────────────── */

export default function ChannelAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-av-hint animate-pulse">Loading…</div>
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}

/* ── actual content ───────────────────────────────────── */

function AnalyticsContent() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const channelId = params.get("channel_id") ?? "";

  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState<ChannelAnalytics | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const loadData = useCallback(async () => {
    if (!channelId || !isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, channelRes] = await Promise.all([
        getChannelAnalyticsApi(channelId, period),
        getChannelApi(channelId),
      ]);

      if (analyticsRes.ok && "overview" in analyticsRes.data) {
        setData(analyticsRes.data as ChannelAnalytics);
      } else {
        const msg =
          analyticsRes.data && "error" in analyticsRes.data
            ? String((analyticsRes.data as { error: string }).error)
            : "Failed to load analytics";
        setError(msg);
      }

      if (channelRes.ok && "channel" in channelRes.data) {
        setChannel(channelRes.data.channel);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [channelId, period, isAuthenticated]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!isAuthenticated) return null;

  /* ── peak hour label */
  const peakHourLabel = (() => {
    if (!data) return "—";
    const h = parseInt(data.overview.peak_hour ?? "0", 10);
    if (isNaN(h)) return data.overview.peak_hour ?? "—";
    const ampm = h >= 12 ? "PM" : "AM";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00 ${ampm}`;
  })();

  /* ── hourly bar highlight */
  const peakHourIndex = data
    ? parseInt(data.overview.peak_hour ?? "0", 10)
    : undefined;

  /* ── render ─────────────────────────────────────────── */

  return (
    <main className="min-h-screen py-8 px-4 md:px-8 lg:px-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/creator-studio"
          className="flex items-center gap-1 text-av-hint hover:text-av-white transition-colors text-sm"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Creator Studio
        </Link>
        <span className="text-av-input-border/60">/</span>
        <span className="text-av-white font-semibold">
          {channel?.name ?? "Channel Analytics"}
        </span>
        <div className="ml-auto">
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-av-input-border/40 bg-av-card px-4 py-2 text-sm text-av-white hover:border-av-orange/40 transition-colors disabled:opacity-40"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold whitespace-nowrap transition-all ${
              period === p.value
                ? "bg-av-orange text-av-dark-blue shadow-lg shadow-av-orange/20"
                : "border border-av-input-border/40 bg-av-card text-av-hint hover:text-av-white hover:border-av-orange/30"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-av-orange/30 border-t-av-orange animate-spin" />
          <p className="text-av-hint text-sm">Loading analytics…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-400 font-semibold">{error}</p>
          <button
            onClick={() => void loadData()}
            className="mt-3 text-sm text-av-orange hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && (
        <div className="flex flex-col gap-6">
          {/* Overview Grid */}
          <section>
            <h2 className="text-av-light-orange font-semibold mb-3 text-sm uppercase tracking-wider">
              Overview
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Views" value={fmt(data.overview.total_views)} accent />
              <StatCard
                label="Unique Viewers"
                value={fmt(data.overview.unique_viewers)}
              />
              <StatCard
                label="Peak Concurrent"
                value={fmt(data.overview.peak_viewers)}
              />
              <StatCard
                label="Peak Hour"
                value={peakHourLabel}
                sub="busiest time of day"
              />
              <StatCard
                label="Reactions"
                value={fmt(data.overview.total_reactions)}
              />
              <StatCard
                label="Comments"
                value={fmt(data.overview.total_comments)}
              />
              <StatCard
                label="Gifts Sent"
                value={fmt(data.overview.total_gifts_count)}
              />
              <StatCard
                label="Gift Revenue"
                value={fmtNgn(data.overview.total_gifts_ngn)}
                sub={`${fmt(data.overview.total_gifts_vpt)} vPT`}
                accent
              />
            </div>
          </section>

          {/* Activity by Hour */}
          <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-5">
            <h2 className="text-av-light-orange font-semibold mb-1 text-sm uppercase tracking-wider">
              Activity by Hour
            </h2>
            <p className="text-xs text-av-hint mb-4">
              When your viewers are most active (UTC) — peak hour highlighted in orange
            </p>
            <BarChart
              bars={data.viewer_activity_by_hour.map((h) => ({ value: h.events }))}
              highlightIndex={peakHourIndex}
              labelFn={(i) => {
                const ampm = i >= 12 ? "PM" : "AM";
                const d = i === 0 ? 12 : i > 12 ? i - 12 : i;
                return `${d}:00 ${ampm}`;
              }}
              height={140}
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-av-hint">12 AM</span>
              <span className="text-xs text-av-hint">12 PM</span>
              <span className="text-xs text-av-hint">11 PM</span>
            </div>
          </section>

          {/* Daily Viewer Trend */}
          {data.timeline.length > 0 && (
            <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-5">
              <h2 className="text-av-light-orange font-semibold mb-1 text-sm uppercase tracking-wider">
                Daily Viewer Trend
              </h2>
              <p className="text-xs text-av-hint mb-4">
                Views per day over the selected period
              </p>
              <BarChart
                bars={data.timeline.map((t) => ({ value: t.views }))}
                labelFn={(i) => {
                  const t = data.timeline[i];
                  if (!t) return "";
                  return new Date(t.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
                height={120}
              />
              <div className="flex justify-between mt-2">
                <span className="text-xs text-av-hint">
                  {data.timeline[0]
                    ? new Date(data.timeline[0].date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </span>
                <span className="text-xs text-av-hint">
                  {data.timeline[data.timeline.length - 1]
                    ? new Date(
                        data.timeline[data.timeline.length - 1].date
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </span>
              </div>
            </section>
          )}

          {/* Viewing Milestones */}
          <section>
            <h2 className="text-av-light-orange font-semibold mb-3 text-sm uppercase tracking-wider">
              Viewing Milestones
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Best Day Views"
                value={fmt(data.overview.best_day_views)}
                sub={
                  data.overview.best_day_date
                    ? new Date(data.overview.best_day_date).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      )
                    : undefined
                }
                accent
              />
              <StatCard
                label="Best Week Total"
                value={fmt(data.overview.weekly_views)}
                sub="rolling 7 days"
              />
              <StatCard
                label="Best Month Total"
                value={fmt(data.overview.monthly_views)}
                sub="rolling 30 days"
              />
              <StatCard
                label="Best Year Total"
                value={fmt(data.overview.yearly_views)}
                sub="rolling 365 days"
              />
            </div>
          </section>

          {/* Demographics */}
          <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-av-light-orange font-semibold text-sm uppercase tracking-wider">
                  Viewer Demographics
                </h2>
                <p className="text-xs text-av-hint mt-1">
                  Based on {fmt(data.demographics.total_identified)} identified viewers
                  from KYC data
                </p>
              </div>
            </div>

            {data.demographics.total_identified === 0 ? (
              <p className="text-av-hint text-sm text-center py-6">
                Not enough viewer data yet — demographics appear once viewers complete their KYC.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Gender */}
                <div>
                  <h3 className="text-av-white text-xs font-semibold mb-3 uppercase tracking-wider">
                    Gender
                  </h3>
                  <div className="flex flex-col gap-2">
                    {data.demographics.gender.map((g) => (
                      <DemographicBar
                        key={g.label}
                        label={g.label}
                        count={g.count}
                        pct={g.pct}
                      />
                    ))}
                  </div>
                </div>

                {/* Age Groups */}
                <div>
                  <h3 className="text-av-white text-xs font-semibold mb-3 uppercase tracking-wider">
                    Age Groups
                  </h3>
                  <div className="flex flex-col gap-2">
                    {data.demographics.age_groups.map((a) => (
                      <DemographicBar
                        key={a.label}
                        label={a.label}
                        count={a.count}
                        pct={a.pct}
                      />
                    ))}
                  </div>
                </div>

                {/* Top Countries */}
                <div>
                  <h3 className="text-av-white text-xs font-semibold mb-3 uppercase tracking-wider">
                    Top Countries
                  </h3>
                  <div className="flex flex-col gap-2">
                    {data.demographics.top_countries.slice(0, 8).map((c) => (
                      <DemographicBar
                        key={c.code}
                        label={c.country || c.code}
                        count={c.count}
                        pct={c.pct}
                      />
                    ))}
                    {data.demographics.top_countries.length === 0 && (
                      <p className="text-av-hint text-xs">No country data yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Empty state — no channel_id */}
      {!loading && !error && !data && !channelId && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-av-hint">No channel selected.</p>
          <Link
            href="/creator-studio"
            className="text-sm text-av-orange hover:underline"
          >
            Go to Creator Studio
          </Link>
        </div>
      )}
    </main>
  );
}
