"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  getCachedCommunityPoolStats,
  getCommunityPoolStats,
  type CommunityPoolStats,
} from "@/lib/home-stats";

const AUTH_ROUTES = ["/login", "/register", "/pak-login", "/forgot-password", "/reset-password"];

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getDisplayVpt(pool: CommunityPoolStats): number {
  const rawVpt = Number(pool.total_vpt || 0);
  const ngn = Number(pool.total_ngn || 0);
  const rate = Number(pool.vpt_rate || 0);

  if (ngn <= 0) return rawVpt;
  if (rate <= 0) return rawVpt;

  const derivedVpt = ngn / rate;
  // Keep header values internally consistent if stored vPT is stale/undercounted.
  return Math.max(rawVpt, derivedVpt);
}

export function CommunityPoolBar() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const [pool, setPool] = useState<CommunityPoolStats | null>(() => getCachedCommunityPoolStats());
  const hidden = AUTH_ROUTES.includes(pathname);

  useEffect(() => {
    if (isLoading || hidden) return;
    let cancelled = false;

    async function load(forceRefresh = false) {
      const nextPool = await getCommunityPoolStats(forceRefresh);
      if (!cancelled && nextPool) {
        setPool(nextPool);
      }
    }

    load(user?.kyc_status === "verified");

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        load();
      }
    }

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isLoading, hidden, user?.kyc_status]);

  if (hidden || isLoading || !pool) return null;

  const displayPoolVpt = getDisplayVpt(pool);

  const stats = [
    {
      label: "Pool Balance",
      vpt: displayPoolVpt,
      ngn: pool.total_ngn,
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      label: "Distributed",
      vpt: pool.total_distributed_vpt,
      ngn: pool.total_distributed_ngn,
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Beneficiaries",
      count: pool.total_beneficiaries,
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-gradient-to-r from-av-dark-blue via-av-light-blue/40 to-av-dark-blue border-b border-av-orange/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-6 sm:gap-10 py-2 overflow-x-auto">
          {/* Label */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-av-orange">
              Community Pool
            </span>
          </div>

          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <span className="text-av-orange">{s.icon}</span>
              <span className="text-[11px] font-bold text-av-white">
                {s.label}:
              </span>
              {"count" in s ? (
                <span className="text-[12px] font-extrabold text-av-orange">
                  {s.count!.toLocaleString()}
                </span>
              ) : (
                <span className="text-[12px] font-extrabold text-av-white">
                  {formatNum(s.vpt!)} vPT{" "}
                  <span className="text-[11px] font-bold text-av-orange">
                    (₦{formatNum(s.ngn!)})
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
