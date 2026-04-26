"use client";

import { type Reputation } from "@/lib/api";

const LEVEL_CONFIG: Record<number, { label: string; bg: string; border: string; text: string }> = {
  0: { label: "No Rep", bg: "bg-av-input-fill", border: "border-av-input-border/30", text: "text-av-hint" },
  1: { label: "Level 1", bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400" },
  2: { label: "Level 2", bg: "bg-purple-500/15", border: "border-purple-500/30", text: "text-purple-400" },
  3: { label: "Level 3", bg: "bg-orange-500/15", border: "border-orange-500/30", text: "text-orange-400" },
};

interface ReputationBadgeProps {
  reputation: Reputation | null;
  /** "sm" = inline pill (navbar); "md" = default; "lg" = profile card with reps count */
  size?: "sm" | "md" | "lg";
  className?: string;
  loading?: boolean;
}

export function ReputationBadge({ reputation, size = "md", className = "", loading }: ReputationBadgeProps) {
  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <span className="w-3 h-3 rounded-full border border-av-light-orange border-t-transparent animate-spin" />
      </span>
    );
  }

  if (!reputation) return null;

  const config = LEVEL_CONFIG[reputation.level] ?? LEVEL_CONFIG[0];

  if (size === "sm") {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${config.bg} ${config.border} ${config.text} ${className}`}>
        ⭐ {reputation.level === 0 ? "None" : `Lvl ${reputation.level}`}
      </span>
    );
  }

  if (size === "lg") {
    return (
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${config.bg} ${config.border} ${className}`}>
        <div className={`flex items-center justify-center w-9 h-9 rounded-full ${config.bg} border ${config.border}`}>
          <span className="text-base">⭐</span>
        </div>
        <div>
          <p className={`text-sm font-bold ${config.text}`}>
            {reputation.level === 0 ? "No Reputation" : `Reputation Level ${reputation.level}`}
          </p>
          <p className="text-[11px] text-av-light-orange mt-0.5">
            {Math.floor(reputation.total_reps).toLocaleString()} reps
            {reputation.leaderboard_rank ? ` · Rank #${reputation.leaderboard_rank}` : ""}
          </p>
        </div>
      </div>
    );
  }

  // size = "md"
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${config.bg} ${config.border} ${config.text} ${className}`}>
      ⭐ {reputation.level === 0 ? "No Rep" : `Level ${reputation.level}`}
      <span className="text-[9px] font-medium opacity-75">
        ({Math.floor(reputation.total_reps).toLocaleString()})
      </span>
    </span>
  );
}
