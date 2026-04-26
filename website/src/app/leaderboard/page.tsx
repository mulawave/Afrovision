"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getLeaderboardApi, type LeaderboardEntry } from "@/lib/api";

function levelColorClass(level: number): string {
  switch (level) {
    case 3:
      return "text-orange-400";
    case 2:
      return "text-purple-400";
    case 1:
      return "text-blue-400";
    default:
      return "text-av-hint";
  }
}

function levelBadgeClass(level: number): string {
  switch (level) {
    case 3:
      return "bg-orange-500/15 border-orange-500/30 text-orange-400";
    case 2:
      return "bg-purple-500/15 border-purple-500/30 text-purple-400";
    case 1:
      return "bg-blue-500/15 border-blue-500/30 text-blue-400";
    default:
      return "bg-av-input-fill border-av-input-border/30 text-av-hint";
  }
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getLeaderboardApi(50, 0)
      .then((res) => {
        if (!active) return;
        if (res.ok && "leaderboard" in res.data) {
          setEntries(res.data.leaderboard);
        } else {
          setError("Failed to load leaderboard");
        }
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load leaderboard");
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-av-light-orange hover:text-av-orange transition-colors"
          >
            ← Back to Home
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-av-white">🏆 Reputation Leaderboard</h1>
          <p className="mt-1 text-sm text-av-light-orange">
            Top gifters ranked by total reputation points earned. Send gifts to climb the ranks!
          </p>
        </div>

        {/* Level legend */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { label: "Level 3", cls: levelBadgeClass(3) },
            { label: "Level 2", cls: levelBadgeClass(2) },
            { label: "Level 1", cls: levelBadgeClass(1) },
            { label: "None", cls: levelBadgeClass(0) },
          ].map((item) => (
            <span
              key={item.label}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${item.cls}`}
            >
              {item.label}
            </span>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl bg-av-card border border-av-input-border/20 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-sm text-av-error">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 rounded-lg bg-av-orange/10 text-av-orange text-xs font-semibold hover:bg-av-orange/20 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-av-light-orange">
                No reputation data yet. Be the first to send a gift!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-av-input-border/10">
              {entries.map((entry) => (
                <div
                  key={entry.user_id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-av-input-fill/30 transition-colors"
                >
                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {entry.rank <= 3 ? (
                      <span className="text-lg">
                        {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-av-hint">#{entry.rank}</span>
                    )}
                  </div>

                  {/* Avatar placeholder */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-av-dark-blue">
                      {entry.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </span>
                  </div>

                  {/* Name + level */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-av-white truncate">
                      {entry.name || "Unknown"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`px-1.5 py-0 rounded text-[9px] font-bold uppercase border ${levelBadgeClass(
                          entry.level
                        )}`}
                      >
                        {entry.level === 0 ? "None" : `Lvl ${entry.level}`}
                      </span>
                    </div>
                  </div>

                  {/* Total reps */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${levelColorClass(entry.level)}`}>
                      {Math.floor(entry.total_reps).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-av-hint">reps</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
