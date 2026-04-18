/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getChannelByNumberApi, getChannelsApi, getCategoriesApi, type Channel, type Category } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { BannerAd } from "@/components/BannerAd";

export default function ChannelsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [channelNumber, setChannelNumber] = useState("");
  const [numberLoading, setNumberLoading] = useState(false);
  const [numberError, setNumberError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getChannelsApi(), getCategoriesApi()]).then(([channelsRes, categoriesRes]) => {
      if (cancelled) return;
      if (channelsRes.ok && "channels" in channelsRes.data) {
        setChannels(channelsRes.data.channels);
      } else {
        setError("Failed to load channels");
      }
      if (categoriesRes.ok && "categories" in categoriesRes.data) {
        setCategories(categoriesRes.data.categories);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredChannels = useMemo(() => {
    let result = channels;

    if (selectedCategory) {
      result = result.filter((channel) => channel.category?.toLowerCase() === selectedCategory.toLowerCase());
    }

    const value = query.trim().toLowerCase();
    if (value) {
      result = result.filter((channel) =>
        [channel.name, channel.category, channel.owner_name]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(value))
      );
    }

    return result;
  }, [channels, query, selectedCategory]);

  async function handleChannelNumberAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!channelNumber.trim()) {
      setNumberError("Enter a channel number");
      return;
    }
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent("/channels")}`);
      return;
    }

    setNumberLoading(true);
    setNumberError(null);
    const res = await getChannelByNumberApi(channelNumber.trim());
    setNumberLoading(false);

    if (res.ok && "channel" in res.data) {
      router.push(`/live/${res.data.channel.id}`);
      return;
    }

    setNumberError("Channel not found or unavailable");
  }

  return (
    <>
      <title>Channels — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Discover</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Channels</h1>
            <p className="mt-2 max-w-2xl text-sm text-av-light-orange">
              Public channels appear here. Private channels stay off public listings and can only be opened with their channel number.
            </p>
          </div>
          <form onSubmit={handleChannelNumberAccess} className="w-full max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange">
              Private Channel Access
            </label>
            <div className="mt-3 flex gap-2">
              <input
                value={channelNumber}
                onChange={(e) => setChannelNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter channel number"
                className="h-11 flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none"
              />
              <button
                type="submit"
                disabled={numberLoading}
                className="rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 text-sm font-semibold text-av-dark-blue disabled:opacity-60"
              >
                {numberLoading ? "Opening..." : "Open"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-av-light-orange">
              {isAuthenticated ? "Signed in users can access a private channel directly by number." : "Sign in first to access a private channel by number."}
            </p>
            {numberError && <p className="mt-2 text-xs text-av-error">{numberError}</p>}
          </form>
        </div>

        <div className="mb-6 rounded-2xl border border-av-input-border/30 bg-av-card p-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search public channels by name, category, or creator"
            className="h-11 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none"
          />
        </div>

        {categories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                !selectedCategory
                  ? "border-av-orange/50 bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue shadow-md shadow-av-orange/20"
                  : "border-av-input-border/30 bg-av-card text-av-light-orange hover:border-av-orange/40 hover:text-av-white"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name === selectedCategory ? null : cat.name)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                  selectedCategory === cat.name
                    ? "border-av-orange/50 bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue shadow-md shadow-av-orange/20"
                    : "border-av-input-border/30 bg-av-card text-av-light-orange hover:border-av-orange/40 hover:text-av-white"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <BannerAd placement="page" className="mb-6" />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-av-error/30 bg-av-error/5 p-8 text-center">
            <p className="text-sm text-av-error">{error}</p>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="rounded-2xl border border-av-input-border/20 bg-av-card/50 p-12 text-center">
            <p className="text-4xl">📺</p>
            <p className="mt-3 text-sm text-av-light-orange">No public channels matched your search.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredChannels.map((channel) => (
              <Link
                key={channel.id}
                href={`/live/${channel.id}`}
                className="group rounded-2xl border border-av-input-border/30 bg-av-card overflow-hidden transition-all hover:border-av-orange/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-av-orange/10"
              >
                <div className="relative h-36 bg-gradient-to-br from-av-light-blue/40 via-av-dark-blue to-av-dark-blue">
                  {channel.banner_url ? (
                    <img src={channel.banner_url} alt={channel.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl">📡</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-av-dark-blue via-av-dark-blue/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 rounded-full bg-av-error px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    {channel.type}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="truncate text-lg font-semibold text-av-white group-hover:text-av-orange transition-colors">{channel.name}</h2>
                    <span className="text-[11px] font-semibold text-av-light-orange">#{channel.channel_number}</span>
                  </div>
                  <p className="mt-1 text-xs text-av-light-orange">{channel.category} · by {channel.owner_name}</p>
                  <p className="mt-3 line-clamp-2 text-sm text-av-light-orange">{channel.description}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-av-light-orange">
                    <span>{channel.followers_count ?? 0} followers</span>
                    <span className="text-av-orange">Watch →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
    </>
  );
}