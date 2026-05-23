"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { resolveWebsiteMediaUrl } from "@/lib/media";

interface RecentItem {
  channelId: string;
  channelName: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  viewedAt: number;
}

const STORAGE_KEY = "afrovision_recently_viewed";

export function getRecentlyViewed(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentItem[];
  } catch {
    return [];
  }
}

export function addToRecentlyViewed(item: Omit<RecentItem, "viewedAt">) {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentlyViewed().filter(
      (r) => r.channelId !== item.channelId
    );
    const updated: RecentItem[] = [
      { ...item, viewedAt: Date.now() },
      ...existing,
    ].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // silent
  }
}

export function RecentlyViewedRow() {
  const { isAuthenticated, isLoading } = useAuth();
  const items = isAuthenticated && !isLoading ? getRecentlyViewed() : [];

  if (!isAuthenticated || isLoading) return null;

  return (
    <section className="py-10 lg:py-14">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-av-white">
              Recently Viewed
            </h2>
            <p className="text-sm text-av-hint mt-1">
              Continue where you left off
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-av-input-border/20 bg-av-card/50 px-6 py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-av-light-blue/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange/60">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              </svg>
            </div>
            <p className="text-sm text-av-hint mb-3">No channels viewed yet</p>
            <Link
              href="/channels"
              className="text-sm font-semibold text-av-orange hover:text-av-light-orange transition-colors"
            >
              Explore Channels →
            </Link>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {items.map((item) => (
              <Link
                key={item.channelId}
                href={`/channel/${item.channelId}`}
                className="flex-shrink-0 w-[200px] sm:w-[240px] rounded-xl border border-av-input-border/20 bg-av-card hover:border-av-orange/30 hover:bg-av-card/80 transition-all group"
              >
                {/* Banner */}
                <div className="relative h-16 rounded-t-xl bg-gradient-to-br from-av-light-blue/20 to-av-orange/10 overflow-hidden">
                  {item.bannerUrl && (
                    <Image
                      src={resolveWebsiteMediaUrl(item.bannerUrl)}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 240px, 200px"
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {/* Info */}
                <div className="px-3 py-2.5 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-av-orange/15 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.logoUrl ? (
                      <Image
                        src={resolveWebsiteMediaUrl(item.logoUrl)}
                        alt=""
                        width={32}
                        height={32}
                        unoptimized
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-xs font-bold text-av-orange">
                        {item.channelName?.[0]?.toUpperCase() || "C"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-av-white truncate group-hover:text-av-orange transition-colors">
                    {item.channelName}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
