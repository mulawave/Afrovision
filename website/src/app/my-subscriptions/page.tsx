"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  getMyChannelSubsApi,
  cancelChannelSubApi,
  type ChannelSubscription,
} from "@/lib/api";

function formatDate(isoOrEpoch: number | string): string {
  const d = new Date(isoOrEpoch);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MySubscriptionsPage() {
  const { isAuthenticated } = useAuth();
  const [subscriptions, setSubscriptions] = useState<ChannelSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    async function fetchSubs() {
      setLoading(true);
      setError(null);
      const res = await getMyChannelSubsApi();
      if (cancelled) return;
      if (res.ok && "subscriptions" in res.data) {
        setSubscriptions(res.data.subscriptions);
      } else {
        setError("Failed to load subscriptions");
      }
      setLoading(false);
    }
    fetchSubs();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleCancel = async (sub: ChannelSubscription) => {
    setCancellingId(sub.id);
    const res = await cancelChannelSubApi(sub.id);
    if (res.ok) {
      setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id));
    } else {
      setError("Failed to cancel subscription. Please try again.");
    }
    setCancellingId(null);
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 pb-16 flex flex-col items-center justify-center gap-4">
        <p className="text-3xl">🔒</p>
        <p className="text-sm text-av-light-orange">Please log in to view your subscriptions.</p>
        <Link
          href="/login"
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-bold text-av-dark-blue hover:shadow-lg transition-all"
        >
          Log In
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </main>
    );
  }

  const activeSubs = subscriptions.filter((s) => s.status === "active");

  return (
    <main className="min-h-screen pt-24 pb-16 px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl lg:text-3xl font-bold text-av-white mb-8">
          My ADTv Subscriptions
        </h1>

        {error && (
          <div className="mb-6 rounded-xl bg-av-error/10 border border-av-error/20 p-4 text-sm text-av-error">
            {error}
          </div>
        )}

        {activeSubs.length === 0 ? (
          <div className="text-center py-20 rounded-xl bg-av-card border border-av-input-border/20">
            <p className="text-4xl mb-4">📺</p>
            <p className="text-sm text-av-light-orange mb-6">
              You haven&apos;t subscribed to any channels yet.
            </p>
            <Link
              href="/"
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-bold text-av-dark-blue hover:shadow-lg transition-all"
            >
              Browse Channels
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeSubs.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-av-card border border-av-input-border/20 hover:border-av-orange/30 transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-xl font-bold text-av-dark-blue flex-shrink-0">
                  {sub.channel_name?.charAt(0).toUpperCase() || "📺"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-av-white truncate">
                      {sub.channel_name || "Unknown Channel"}
                    </h3>
                    {sub.is_premium ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-av-orange bg-av-orange/10 border border-av-orange/20">
                        PREMIUM
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-300 bg-emerald-400/10 border border-emerald-400/20">
                        FREE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-av-light-orange mt-0.5">
                    Subscribed {formatDate(sub.subscribed_at)}
                    {sub.is_premium && sub.next_billing && (
                      <> · Next billing {formatDate(sub.next_billing)}</>
                    )}
                    {sub.is_premium && sub.amount > 0 && (
                      <> · ₦{sub.amount.toLocaleString()} / {sub.interval_count} {sub.interval_unit}{sub.interval_count > 1 ? "s" : ""}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Link
                    href={`/channel/${sub.channel_id}`}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-av-orange border border-av-orange/40 hover:bg-av-orange/10 transition-all"
                  >
                    View Channel
                  </Link>
                  <button
                    onClick={() => handleCancel(sub)}
                    disabled={cancellingId === sub.id}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-av-error border border-av-error/40 hover:bg-av-error/10 transition-all disabled:opacity-60"
                  >
                    {cancellingId === sub.id ? "Cancelling..." : "Unsubscribe"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
