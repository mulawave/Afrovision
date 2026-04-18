"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getMeApi, type StoredUser } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { PremiumBadge } from "@/components/PremiumBadge";

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProfilePage() {
  const { isAuthenticated, user: authUser, logout, refreshUser } = useAuth();
  const [profile, setProfile] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Refresh auth context user AND fetch fresh profile
    refreshUser();
    getMeApi().then((res) => {
      if (cancelled) return;
      if (res.ok && "user" in res.data) {
        setProfile(res.data.user);
      } else {
        setError("Failed to load profile");
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshUser]);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">Sign in to view your profile.</p>
          <Link href="/login?redirect=/profile" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Profile — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Account</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Profile</h1>
          </div>
          <button onClick={logout} className="rounded-full border border-av-error/30 bg-av-error/5 px-5 py-2 text-sm font-semibold text-av-error hover:bg-av-error/10">
            Sign out
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
          </div>
        ) : error || !profile ? (
          <div className="rounded-2xl border border-av-error/30 bg-av-error/5 p-8 text-center text-sm text-av-error">
            {error || "Profile unavailable"}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <div className="flex items-center gap-4">
                  {profile.avatar_url ? (
                    <Image src={profile.avatar_url} alt="Avatar" width={64} height={64} className="rounded-full object-cover w-16 h-16" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-av-orange to-av-light-orange text-2xl font-bold text-av-dark-blue">
                      {(profile.name || profile.email)[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-semibold text-av-white">{profile.name || "Unnamed member"}</h2>
                      <PremiumBadge user={profile} size="md" />
                    </div>
                    <p className="text-sm text-av-light-orange">{profile.email}</p>
                    <Link href="/profile/edit" className="mt-2 inline-block text-xs font-semibold text-av-orange hover:text-av-light-orange">
                      Edit Profile
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-av-orange/30 bg-av-orange/10 px-3 py-1 text-[11px] font-bold uppercase text-av-orange">
                        {profile.role}
                      </span>
                      <span className="rounded-full border border-av-input-border/30 bg-av-input-fill px-3 py-1 text-[11px] font-medium text-av-light-orange">
                        KYC: {profile.kyc_status}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <InfoCard label="Preferred Currency" value={profile.preferred_currency} />
                <InfoCard label="vPT Balance" value={`${profile.vpt_balance.toLocaleString()} VPT`} />
                <InfoCard label="Plan" value={profile.subscription_plan || "No active plan"} />
                <InfoCard label="Member Since" value={formatDate(profile.created_at)} />
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <h3 className="text-sm font-semibold text-av-white">Quick Access</h3>
                <div className="mt-4 space-y-3">
                  <QuickLink href="/notifications" label="Notifications" note="Review go-live alerts, admin notices, and account updates" />
                  <QuickLink href="/wallet" label="Wallet" note="View balances, ledger, and creator wallet status" />
                  <QuickLink href="/referrals" label="Referrals" note="Track your referral earnings and network" />
                  {(profile.role === "creator" || profile.role === "admin") ? <QuickLink href="/create-channel" label="Create Channel" note="Launch a new public or private channel with media" /> : null}
                  {(profile.role === "creator" || profile.role === "admin") ? <QuickLink href="/creator-studio" label="Creator Studio" note="Upload videos and manage the broadcast schedule" /> : null}
                  {profile.role === "admin" ? <QuickLink href="/admin" label="Admin" note="Review users, channels, flags, and broadcast messaging" /> : null}
                  <QuickLink href="/profile/delete-account" label="Delete Account" note="Request permanent account deletion with a 30-day grace period" danger />
                </div>
              </section>

              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6 text-sm text-av-light-orange">
                <p>Subscription status: <span className="font-semibold text-av-white">{profile.subscription_status}</span></p>
                <p className="mt-2">Expiry: <span className="font-semibold text-av-white">{formatDate(profile.subscription_expiry)}</span></p>
                <p className="mt-2">Creator wallet: <span className="font-semibold text-av-white">{profile.bsc_address || "Not created yet"}</span></p>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-5">
      <p className="text-[11px] uppercase tracking-wider text-av-light-orange">{label}</p>
      <p className="mt-2 text-base font-semibold text-av-white">{value}</p>
    </div>
  );
}

function QuickLink({ href, label, note, danger }: { href: string; label: string; note: string; danger?: boolean }) {
  return (
    <Link href={href} className={`block rounded-xl border p-4 transition-all ${danger ? "border-av-error/30 bg-av-error/5 hover:border-av-error/50 hover:bg-av-error/10" : "border-av-input-border/30 bg-av-input-fill/40 hover:border-av-orange/40 hover:bg-av-input-fill/70"}`}>
      <p className={`text-sm font-semibold ${danger ? "text-av-error" : "text-av-white"}`}>{label}</p>
      <p className={`mt-1 text-xs ${danger ? "text-av-error/70" : "text-av-light-orange"}`}>{note}</p>
    </Link>
  );
}