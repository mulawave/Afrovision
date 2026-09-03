"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  getPublicProfileApi,
  type PublicProfile,
  type PublicProfileChannel,
} from "@/lib/api";
import { resolveWebsiteMediaUrl } from "@/lib/media";

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params?.userId as string;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [channels, setChannels] = useState<PublicProfileChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const res = await getPublicProfileApi(userId);
    if (!res.ok || !("profile" in res.data)) {
      setError("error" in res.data ? res.data.error : "Profile not found.");
      setLoading(false);
      return;
    }
    setProfile(res.data.profile);
    setChannels(res.data.channels);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">{error || "Profile not found."}</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Back to home →
          </Link>
        </div>
      </main>
    );
  }

  const joinDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <>
      <title>{profile.name} — AfroVision</title>
      <main className="min-h-screen pb-16 pt-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          {/* Profile header */}
          <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {profile.avatar_url ? (
                <Image
                  src={resolveWebsiteMediaUrl(profile.avatar_url)}
                  alt={profile.name}
                  width={120}
                  height={120}
                  unoptimized
                  className="h-28 w-28 rounded-full border-2 border-av-orange/30 object-cover flex-shrink-0"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-av-orange/30 bg-av-input-fill text-3xl font-bold text-av-orange flex-shrink-0">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-av-white">{profile.name}</h1>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {profile.is_premium_creator && (
                    <span className="rounded-full border border-av-orange/30 bg-av-orange/10 px-3 py-0.5 text-xs font-semibold text-av-orange">
                      Premium Creator
                    </span>
                  )}
                  <span className="rounded-full border border-av-input-border/30 px-3 py-0.5 text-xs font-medium text-av-light-orange capitalize">
                    {profile.role}
                  </span>
                  {joinDate && (
                    <span className="text-xs text-av-light-orange/70">
                      Joined {joinDate}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Channels section */}
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-av-white">
              Channels {channels.length > 0 && <span className="text-sm text-av-light-orange">({channels.length})</span>}
            </h2>

            {channels.length === 0 ? (
              <div className="rounded-2xl border border-av-input-border/20 bg-av-card/50 p-8 text-center">
                <p className="text-sm text-av-light-orange">No public channels yet.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {channels.map((ch) => {
                  const isExclusive = Number(ch.exclusive_monthly_fee_ngn || 0) > 0;
                  return (
                    <Link
                      key={ch.id}
                      href={`/channel/${ch.id}`}
                      className="group rounded-2xl border border-av-input-border/20 bg-av-card p-4 hover:border-av-orange/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {ch.logo_url ? (
                          <Image
                            src={resolveWebsiteMediaUrl(ch.logo_url)}
                            alt={ch.name}
                            width={48}
                            height={48}
                            unoptimized
                            className="h-12 w-12 rounded-lg border border-av-input-border/30 object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-av-input-border/30 bg-av-input-fill text-sm font-bold text-av-orange flex-shrink-0">
                            {ch.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-av-white group-hover:text-av-orange transition-colors">
                            {ch.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-av-light-orange">
                            #{ch.channel_number} · {ch.category || "General"}
                          </p>
                        </div>
                      </div>
                      {ch.description && (
                        <p className="mt-3 line-clamp-2 text-xs text-av-light-orange/80 leading-relaxed">
                          {ch.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        {isExclusive && (
                          <span className="rounded-full border border-av-orange/30 bg-av-orange/10 px-2.5 py-0.5 text-[10px] font-semibold text-av-orange">
                            Exclusive
                          </span>
                        )}
                        <span className="text-[10px] text-av-light-orange/60 capitalize">{ch.type}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
