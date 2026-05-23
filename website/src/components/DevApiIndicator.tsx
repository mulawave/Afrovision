"use client";

import { API_BASE } from "@/lib/api";

export function DevApiIndicator() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const apiBase = API_BASE || "(not set)";

  return (
    <div className="fixed bottom-3 left-3 z-[100] rounded-lg border border-av-input-border/50 bg-av-card/90 px-3 py-2 text-[11px] text-av-light-orange shadow-lg backdrop-blur-sm">
      <p className="uppercase tracking-[0.18em] text-[10px] opacity-80">Connected API</p>
      <p className="mt-1 max-w-[70vw] break-all font-mono text-av-white">{apiBase}</p>
    </div>
  );
}
