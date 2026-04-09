"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPlansApi, type Plan } from "@/lib/api";

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"viewer" | "creator">("viewer");
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await getPlansApi();
        if (res.ok) {
          setPlans(res.data.plans);
        } else {
          setError("Failed to load plans");
        }
      } catch {
        setError("Failed to load plans");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const viewerPlans = plans.filter((p) => p.type === "viewer");
  const creatorPlans = plans.filter((p) => p.type === "creator");
  const activePlans = tab === "viewer" ? viewerPlans : creatorPlans;

  function formatPrice(price: number) {
    return price.toLocaleString("en-NG");
  }

  function getViewerTierColor(plan: Plan) {
    if (plan.name === "premium_viewer") return { border: "border-av-orange/50", bg: "bg-av-orange/10", text: "text-av-orange", glow: "shadow-av-orange/15" };
    if (plan.name === "pro_viewer") return { border: "border-purple-400/40", bg: "bg-purple-400/10", text: "text-purple-400", glow: "" };
    if (plan.name === "basic_viewer") return { border: "border-indigo-400/40", bg: "bg-indigo-400/10", text: "text-indigo-400", glow: "" };
    return { border: "border-av-input-border", bg: "bg-av-input-fill", text: "text-av-hint", glow: "" };
  }

  function getCreatorTierColor(plan: Plan) {
    if (plan.name === "premium") return { border: "border-av-orange/50", bg: "bg-av-orange/10", text: "text-av-orange", glow: "shadow-av-orange/15" };
    if (plan.name === "pro") return { border: "border-emerald-400/40", bg: "bg-emerald-400/10", text: "text-emerald-400", glow: "" };
    return { border: "border-av-input-border", bg: "bg-av-light-orange/10", text: "text-av-light-orange", glow: "" };
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-16 pb-12 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(244,150,23,0.08),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-av-orange/80 font-semibold mb-4 animate-fade-in-up">
            Transparent Pricing
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            Choose Your{" "}
            <span className="bg-gradient-to-r from-av-orange to-av-light-orange bg-clip-text text-transparent">
              Plan
            </span>
          </h1>
          <p className="mt-5 text-lg text-av-white/60 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            Watch and earn vPT rewards as a viewer, or unlock creator tools to broadcast and monetize your content.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 pb-24">
        {/* Tab Toggle */}
        <div className="flex justify-center mb-8 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <div className="inline-flex rounded-xl border border-av-input-border bg-av-input-fill p-1">
            <button
              onClick={() => setTab("viewer")}
              className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                tab === "viewer"
                  ? "bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue shadow-lg shadow-av-orange/20"
                  : "text-av-white/60 hover:text-av-white"
              }`}
            >
              Viewer Plans
            </button>
            <button
              onClick={() => setTab("creator")}
              className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                tab === "creator"
                  ? "bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue shadow-lg shadow-av-orange/20"
                  : "text-av-white/60 hover:text-av-white"
              }`}
            >
              Creator Plans
            </button>
          </div>
        </div>

        {/* Billing Toggle — Viewer only */}
        {tab === "viewer" && (
          <div className="flex justify-center mb-10 animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
            <div className="inline-flex items-center gap-3">
              <span className={`text-sm font-medium ${!yearly ? "text-av-white" : "text-av-white/40"}`}>Monthly</span>
              <button
                onClick={() => setYearly(!yearly)}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  yearly ? "bg-av-orange" : "bg-av-input-border"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                    yearly ? "translate-x-[30px]" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${yearly ? "text-av-white" : "text-av-white/40"}`}>
                Yearly
              </span>
              {yearly && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                  Save up to 20%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="max-w-md mx-auto rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-center text-sm text-red-300">
            {error}
            <button onClick={() => window.location.reload()} className="ml-3 underline hover:text-red-200">
              Retry
            </button>
          </div>
        )}

        {/* Plans Grid */}
        {!loading && !error && (
          <div className="stagger-children">
            {tab === "viewer" ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {viewerPlans.map((plan) => {
                  const tier = getViewerTierColor(plan);
                  const isFree = plan.price === 0;
                  const isPremium = plan.name === "premium_viewer";
                  const price = yearly && plan.yearly_price ? plan.yearly_price : plan.price;
                  const period = yearly ? "/year" : "/month";
                  const multiplier = plan.reward_multiplier ?? 0;

                  let savingsPercent = 0;
                  if (yearly && plan.yearly_price && plan.price > 0) {
                    savingsPercent = Math.round(((plan.price * 12 - plan.yearly_price) / (plan.price * 12)) * 100);
                  }

                  return (
                    <div
                      key={plan.id}
                      className={`relative flex flex-col rounded-2xl border ${tier.border} bg-av-card/80 backdrop-blur-sm p-6 transition-all hover:-translate-y-1 hover:shadow-xl ${tier.glow ? `shadow-lg ${tier.glow}` : "hover:shadow-black/30"} ${isPremium ? "ring-1 ring-av-orange/30" : ""}`}
                    >
                      {/* Popular badge */}
                      {isPremium && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-[10px] font-bold uppercase tracking-wider text-av-dark-blue shadow-lg shadow-av-orange/25">
                          Most Popular
                        </div>
                      )}

                      {/* Plan header */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-2.5 py-1 rounded-lg ${tier.bg} text-[11px] font-bold uppercase tracking-wider ${tier.text}`}>
                            {isFree ? "Free" : plan.name.replace("_", " ")}
                          </span>
                          {plan.badge && (
                            <span className={`text-[10px] font-semibold ${tier.text}`}>
                              {plan.badge}
                            </span>
                          )}
                        </div>

                        {/* Price */}
                        <div className="flex items-end gap-1 mb-1">
                          <span className="text-3xl font-extrabold text-av-white">
                            {isFree ? "₦0" : `₦${formatPrice(price)}`}
                          </span>
                          {!isFree && (
                            <span className="text-sm text-av-white/40 pb-1">{period}</span>
                          )}
                        </div>
                        {yearly && savingsPercent > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-400">
                            Save {savingsPercent}%
                          </span>
                        )}
                      </div>

                      {/* Multiplier badge */}
                      <div className={`mb-4 px-3 py-2 rounded-xl border ${multiplier > 0 ? `${tier.bg} border-current/10` : "bg-av-input-fill border-av-input-border"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-base ${multiplier > 0 ? tier.text : "text-av-hint"}`}>
                            {multiplier > 0 ? "🚀" : "—"}
                          </span>
                          <div>
                            <p className={`text-sm font-bold ${multiplier > 0 ? tier.text : "text-av-hint"}`}>
                              {multiplier > 0 ? `${multiplier}x Reward Multiplier` : "No vPT Rewards"}
                            </p>
                            <p className="text-[10px] text-av-white/30">
                              Community pool share
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Features */}
                      <ul className="flex-1 space-y-2.5 mb-6">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5">
                            <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isFree ? "text-av-hint" : tier.text}`} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                            <span className="text-sm text-av-white/70">
                              {plan.display_labels[f] || f.replace(/_/g, " ")}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      {isFree ? (
                        <div className="rounded-xl bg-av-input-fill border border-av-input-border py-3 text-center text-sm font-semibold text-av-hint">
                          Default Plan
                        </div>
                      ) : (
                        <Link
                          href="/register"
                          className={`block rounded-xl py-3 text-center text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                            isPremium
                              ? "bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue shadow-lg shadow-av-orange/20 hover:shadow-xl hover:shadow-av-orange/30"
                              : `border ${tier.border} ${tier.bg} ${tier.text} hover:brightness-110`
                          }`}
                        >
                          {isPremium ? "Go Premium" : "Get Started"}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Creator Plans Grid */
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
                {creatorPlans.map((plan) => {
                  const tier = getCreatorTierColor(plan);
                  const isPremium = plan.name === "premium";
                  const isPro = plan.name === "pro";

                  return (
                    <div
                      key={plan.id}
                      className={`relative flex flex-col rounded-2xl border ${tier.border} bg-av-card/80 backdrop-blur-sm p-6 transition-all hover:-translate-y-1 hover:shadow-xl ${tier.glow ? `shadow-lg ${tier.glow}` : "hover:shadow-black/30"} ${isPremium ? "ring-1 ring-av-orange/30" : ""}`}
                    >
                      {isPremium && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-[10px] font-bold uppercase tracking-wider text-av-dark-blue shadow-lg shadow-av-orange/25">
                          Best Value
                        </div>
                      )}

                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-2.5 py-1 rounded-lg ${tier.bg} text-[11px] font-bold uppercase tracking-wider ${tier.text}`}>
                            {plan.name}
                          </span>
                          {plan.badge && (
                            <span className={`text-[10px] font-semibold ${tier.text}`}>
                              {plan.badge}
                            </span>
                          )}
                        </div>

                        <div className="flex items-end gap-1 mb-1">
                          <span className="text-3xl font-extrabold text-av-white">
                            ₦{formatPrice(plan.price)}
                          </span>
                          <span className="text-sm text-av-white/40 pb-1">/month</span>
                        </div>
                      </div>

                      <ul className="flex-1 space-y-2.5 mb-6">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5">
                            <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tier.text}`} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                            <span className="text-sm text-av-white/70">
                              {plan.display_labels[f] || f.replace(/_/g, " ")}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <Link
                        href="/register"
                        className={`block rounded-xl py-3 text-center text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                          isPremium
                            ? "bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue shadow-lg shadow-av-orange/20 hover:shadow-xl hover:shadow-av-orange/30"
                            : isPro
                            ? `border ${tier.border} ${tier.bg} ${tier.text} hover:brightness-110`
                            : `border ${tier.border} ${tier.bg} ${tier.text} hover:brightness-110`
                        }`}
                      >
                        {isPremium ? "Go Premium" : isPro ? "Go Pro" : "Get Started"}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FAQ / Info Section */}
        <section className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-av-white mb-2">
            How vPT Rewards Work
          </h2>
          <p className="text-center text-av-white/50 text-sm mb-10">
            Your viewer plan determines your share of the community pool.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-av-input-border bg-av-card/60 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-av-orange/10 flex items-center justify-center text-av-orange text-lg">
                  🎯
                </div>
                <h3 className="text-sm font-bold text-av-white">Community Pool</h3>
              </div>
              <p className="text-xs text-av-white/50 leading-relaxed">
                A percentage of every subscription payment flows into the community pool. This pool is distributed among active viewers based on their plan multiplier.
              </p>
            </div>

            <div className="rounded-2xl border border-av-input-border bg-av-card/60 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-purple-400/10 flex items-center justify-center text-purple-400 text-lg">
                  ⚡
                </div>
                <h3 className="text-sm font-bold text-av-white">Multiplier Effect</h3>
              </div>
              <p className="text-xs text-av-white/50 leading-relaxed">
                Higher tier plans earn a larger multiplier on community pool rewards. Premium viewers earn 3.5x more vPT per distribution cycle compared to the base rate.
              </p>
            </div>

            <div className="rounded-2xl border border-av-input-border bg-av-card/60 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-400/10 flex items-center justify-center text-emerald-400 text-lg">
                  💎
                </div>
                <h3 className="text-sm font-bold text-av-white">vPT Tokens</h3>
              </div>
              <p className="text-xs text-av-white/50 leading-relaxed">
                vPT (Virtual Points Token) can be used to subscribe to creators, tip during live streams, unlock premium content, and trade on-chain via BSC.
              </p>
            </div>

            <div className="rounded-2xl border border-av-input-border bg-av-card/60 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-av-light-orange/10 flex items-center justify-center text-av-light-orange text-lg">
                  🔄
                </div>
                <h3 className="text-sm font-bold text-av-white">Upgrade Anytime</h3>
              </div>
              <p className="text-xs text-av-white/50 leading-relaxed">
                Switch between plans at any time. Upgrading immediately unlocks higher tier benefits and increased reward multipliers.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="mt-16 rounded-3xl border border-av-orange/20 bg-gradient-to-br from-av-orange/5 to-av-light-orange/5 p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-av-white mb-3">
            Ready to Start Earning?
          </h2>
          <p className="text-av-white/50 text-sm max-w-lg mx-auto mb-6">
            Join thousands of viewers and creators on Africa&apos;s premier streaming platform. Watch, earn, and connect.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-3 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-bold text-av-dark-blue shadow-lg shadow-av-orange/20 transition-all hover:shadow-xl hover:shadow-av-orange/30 hover:scale-105 active:scale-95"
            >
              Create Account
            </Link>
            <Link
              href="/channels"
              className="px-8 py-3 rounded-full border border-av-white/20 text-sm font-semibold text-av-white/80 hover:text-av-white hover:bg-av-white/5 transition-all"
            >
              Browse Channels
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
