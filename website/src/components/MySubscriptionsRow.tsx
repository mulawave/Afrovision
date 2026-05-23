"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { resolveWebsiteMediaUrl } from "@/lib/media";
import {
  getMyChannelSubsApi,
  getMyCreatorSubsApi,
  type ChannelSubscription,
  type CreatorSubscription,
} from "@/lib/api";

interface UnifiedSub {
  id: string;
  type: "channel" | "creator";
  name: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  href: string;
  isPremium: boolean;
  subscribedAt: number;
}

function toUnified(channelSubs: ChannelSubscription[], creatorSubs: CreatorSubscription[]): UnifiedSub[] {
  const channelItems: UnifiedSub[] = channelSubs.map((s) => ({
    id: s.id,
    type: "channel",
    name: s.channel_name || "Unknown Channel",
    logoUrl: s.channel_logo_url,
    bannerUrl: s.channel_banner_url,
    href: `/channel/${s.channel_id}`,
    isPremium: s.is_premium,
    subscribedAt: s.subscribed_at,
  }));
  const creatorItems: UnifiedSub[] = creatorSubs.map((s) => ({
    id: s.id,
    type: "creator",
    name: s.creator_name || "Unknown Creator",
    logoUrl: s.creator_avatar_url,
    bannerUrl: null,
    href: `/profile/${s.creator_uid}`,
    isPremium: true,
    subscribedAt: s.subscribed_at,
  }));
  return [...channelItems, ...creatorItems].sort((a, b) => b.subscribedAt - a.subscribedAt);
}

export function MySubscriptionsRow() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isAuthenticated || isLoading) return null;

  return <MySubscriptionsRowContent />;
}

function MySubscriptionsRowContent() {
  const [subs, setSubs] = useState<UnifiedSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchSubs = () => {
    Promise.all([getMyChannelSubsApi(), getMyCreatorSubsApi()])
      .then(([channelRes, creatorRes]) => {
        const channelActive =
          channelRes.ok && "subscriptions" in channelRes.data
            ? channelRes.data.subscriptions.filter((s) => s.status === "active")
            : [];
        const creatorActive =
          creatorRes.ok && "subscriptions" in creatorRes.data
            ? creatorRes.data.subscriptions.filter((s) => s.status === "active")
            : [];
        if (!channelRes.ok && !creatorRes.ok) {
          setError(true);
        } else {
          setSubs(toUnified(channelActive, creatorActive));
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  const handleRetry = () => {
    setLoading(true);
    setError(false);
    fetchSubs();
  };

  useEffect(() => {
    fetchSubs();
  }, []);

  return (
    <section className="py-10 lg:py-14 bg-gradient-to-b from-amber-500/[0.06] via-amber-400/[0.04] to-transparent">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-av-white">
              My Subscriptions
            </h2>
            <p className="text-sm text-av-hint mt-1">
              Channels &amp; creators you&apos;re subscribed to
            </p>
          </div>
          <Link
            href="/my-subscriptions"
            className="text-sm font-semibold text-av-orange hover:text-av-light-orange transition-colors"
          >
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[200px] rounded-xl bg-av-card/40 animate-pulse h-24"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-av-input-border/20 bg-av-card/50 px-6 py-8 text-center">
            <p className="text-sm text-av-hint mb-3">Could not load subscriptions</p>
            <button
              onClick={handleRetry}
              className="text-sm font-semibold text-av-orange hover:text-av-light-orange transition-colors"
            >
              Retry
            </button>
          </div>
        ) : subs.length === 0 ? (
          <div className="rounded-xl border border-av-input-border/20 bg-av-card/50 px-6 py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-av-orange/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-av-orange/60">
                <path d="M20 8H4V6h16v2zm-2-6H6v2h12V2zm4 10v8c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2zm-6 4l-6-3.27v6.53L16 16z" />
              </svg>
            </div>
            <p className="text-sm text-av-hint mb-3">No active subscriptions yet</p>
            <Link
              href="/channels"
              className="text-sm font-semibold text-av-orange hover:text-av-light-orange transition-colors"
            >
              Browse Channels →
            </Link>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {subs.map((sub) => (
              <Link
                key={sub.id}
                href={sub.href}
                className="flex-shrink-0 w-[200px] sm:w-[240px] rounded-xl border border-av-input-border/20 bg-av-card hover:border-av-orange/30 hover:bg-av-card/80 transition-all group"
              >
                {/* Banner */}
                <div className="h-16 rounded-t-xl bg-gradient-to-br from-av-orange/20 to-av-light-blue/20 overflow-hidden relative">
                  {sub.bannerUrl && (
                    <Image
                      src={resolveWebsiteMediaUrl(sub.bannerUrl)}
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
                    {sub.logoUrl ? (
                      <Image
                        src={resolveWebsiteMediaUrl(sub.logoUrl)}
                        alt=""
                        width={32}
                        height={32}
                        unoptimized
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-xs font-bold text-av-orange">
                        {sub.name?.[0]?.toUpperCase() || "C"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-av-white truncate group-hover:text-av-orange transition-colors">
                      {sub.name}
                    </p>
                    <p className="text-[10px] text-av-hint">
                      {sub.type === "creator" ? "Creator" : sub.isPremium ? "Premium" : "Free"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
