"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { type ReferralDashboard, getReferralDashboardApi } from "@/lib/api";

function maskTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ReferralsPage() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"earnings" | "referrals" | "tree">("earnings");

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const res = await getReferralDashboardApi();
      if (cancelled) return;
      if (res.ok) {
        setData(res.data as ReferralDashboard);
      } else {
        setError("Failed to load referral data");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleCopy = useCallback(() => {
    if (!data) return;
    navigator.clipboard.writeText(data.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-av-hint mb-4">Sign in to view your referral dashboard</p>
          <Link href="/login" className="text-av-orange hover:underline">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen pt-20 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-av-error mb-4">{error || "Something went wrong"}</p>
          <button onClick={() => window.location.reload()} className="text-av-orange hover:underline">
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Referrals — AfroVision</title>
      <main className="min-h-screen pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Refer & Earn</h1>
          <p className="text-av-hint mt-1 text-sm">Share your code, earn from your network&apos;s activity</p>
        </div>

        {/* Referral Code Card */}
        <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-av-dark-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-av-hint uppercase tracking-widest mb-1">Your Referral Code</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-[0.25em] font-mono">
                {data.referral_code}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                copied
                  ? "bg-av-card border border-av-orange/40 text-av-orange"
                  : "bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue hover:brightness-110"
              }`}
            >
              {copied ? "✓ Copied" : "Copy Code"}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <StatCard label="Invites" value={String(data.invited_count)} />
          <StatCard label="Total NGN" value={`₦${data.total_earnings_ngn.toLocaleString()}`} />
          <StatCard label="Total VPT" value={`${data.total_earnings_vpt_units.toLocaleString()}`} icon="💎" />
          <StatCard label="Active Levels" value={`${data.upline.length} / 5`} />
        </div>

        {/* Level Distribution */}
        <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-5 sm:p-6 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Referral Levels</h3>
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {data.level_distribution.map((lvl) => (
              <div
                key={lvl.level}
                className="text-center p-3 rounded-xl bg-av-input-fill border border-av-input-border/30"
              >
                <p className="text-lg sm:text-xl font-bold text-av-orange">{lvl.percentage}%</p>
                <p className="text-[10px] text-av-hint mt-1">Level {lvl.level}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-av-hint mt-3">
            Earnings come from 1/3 of the 30% community pool on each creator subscription in your tree.
            Split: 50% cash wallet · 50% vPT wallet.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl bg-av-card border border-av-input-border/30">
          {(["earnings", "referrals", "tree"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t
                  ? "bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue"
                  : "text-av-hint hover:text-white"
              }`}
            >
              {t === "earnings" ? "Earnings History" : t === "referrals" ? "Direct Referrals" : "My Upline"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="rounded-2xl bg-av-card border border-av-input-border/30 overflow-hidden">
          {tab === "earnings" && (
            <EarningsTab earnings={data.earnings} />
          )}
          {tab === "referrals" && (
            <ReferralsTab referrals={data.direct_referrals} />
          )}
          {tab === "tree" && (
            <UplineTab upline={data.upline} />
          )}
        </div>

        {/* How It Works */}
        <div className="mt-8 rounded-2xl bg-av-card border border-av-input-border/30 p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-white mb-4">How It Works</h3>
          <div className="space-y-4">
            {[
              { icon: "🔗", title: "Share your code", desc: "Send your referral code to friends via any channel." },
              { icon: "👤", title: "Friends sign up", desc: "When they register with your code, they join your referral tree." },
              { icon: "💰", title: "Earn from subscriptions", desc: "When anyone in your 5-level tree subscribes to a creator, you earn a cut." },
              { icon: "📊", title: "5-level deep", desc: "L1: 40% · L2: 20% · L3: 15% · L4: 15% · L5: 10% of the referral pool." },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{step.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <p className="text-xs text-av-hint">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="rounded-xl bg-av-card border border-av-input-border/30 p-4 text-center">
      <p className="text-lg sm:text-xl font-bold text-white">
        {icon && <span className="mr-1">{icon}</span>}
        {value}
      </p>
      <p className="text-[10px] text-av-hint mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function EarningsTab({ earnings }: { earnings: ReferralDashboard["earnings"] }) {
  if (earnings.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-av-hint text-sm">No earnings yet. Share your code to start earning!</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-av-input-border/20">
      {earnings.map((e) => (
        <div key={e.id} className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-lg bg-av-input-fill flex items-center justify-center text-xs font-bold text-av-orange">
            L{e.level}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">
              {e.source_name || e.source_email || "Unknown"}
            </p>
            <p className="text-[10px] text-av-hint">{maskTime(e.created_at)}</p>
          </div>
          <div className="text-right">
            {e.amount_ngn > 0 && (
              <p className="text-sm font-semibold text-av-success">₦{e.amount_ngn.toLocaleString()}</p>
            )}
            {e.amount_vpt_units > 0 && (
              <p className="text-sm font-semibold text-av-orange">{e.amount_vpt_units} VPT</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReferralsTab({ referrals }: { referrals: ReferralDashboard["direct_referrals"] }) {
  if (referrals.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-av-hint text-sm">You haven&apos;t referred anyone yet.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-av-input-border/20">
      {referrals.map((r) => (
        <div key={r.uid} className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-xs font-bold text-av-dark-blue">
            {(r.name || r.email || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{r.name || "Anonymous"}</p>
            <p className="text-[10px] text-av-hint truncate">{r.email || "—"}</p>
          </div>
          <p className="text-[10px] text-av-hint">{r.joined_at ? maskTime(r.joined_at) : "—"}</p>
        </div>
      ))}
    </div>
  );
}

function UplineTab({ upline }: { upline: ReferralDashboard["upline"] }) {
  if (upline.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-av-hint text-sm">You joined without a referral code — no upline.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-av-input-border/20">
      {upline.map((u) => (
        <div key={u.uid} className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-lg bg-av-input-fill flex items-center justify-center text-xs font-bold text-av-light-orange">
            L{u.level}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{u.name || "Anonymous"}</p>
            <p className="text-[10px] text-av-hint truncate">{u.email || "—"}</p>
          </div>
          <p className="text-[10px] text-av-hint">Level {u.level} referrer</p>
        </div>
      ))}
    </div>
  );
}
