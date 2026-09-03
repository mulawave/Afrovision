/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getChannelByNumberApi, getChannelsApi, getCategoriesApi, type Channel, type Category } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { BannerAd } from "@/components/BannerAd";

const CHANNELS_PER_PAGE = 25;

function getChannelIdentityLabel(channel: Channel) {
  if (channel.owner_details_visible === false || channel.owner_display_mode === "hide_owner") {
    return "";
  }
  const name = (channel.public_owner_name || channel.owner_brand_name || channel.owner_name || "").trim();
  if (!name) return "";
  return channel.owner_display_mode === "brand_only" ? name : `by ${name}`;
}

function getChannelMetaLine(channel: Channel) {
  const identityLabel = getChannelIdentityLabel(channel);
  return identityLabel ? `${channel.category} · ${identityLabel}` : channel.category;
}

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
  const [currentPage, setCurrentPage] = useState(1);

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
        [channel.name, channel.category, getChannelIdentityLabel(channel)]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(value))
      );
    }

    return result;
  }, [channels, query, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredChannels.length / CHANNELS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedChannels = useMemo(() => {
    const start = (safeCurrentPage - 1) * CHANNELS_PER_PAGE;
    return filteredChannels.slice(start, start + CHANNELS_PER_PAGE);
  }, [filteredChannels, safeCurrentPage]);

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
      router.push(`/channel/${res.data.channel.id}`);
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
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search public channels by name, category, or creator"
            className="h-11 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none"
          />
        </div>

        {categories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedCategory(null);
                setCurrentPage(1);
              }}
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
                onClick={() => {
                  setSelectedCategory(cat.name === selectedCategory ? null : cat.name);
                  setCurrentPage(1);
                }}
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
          <>
          <div className="grid gap-x-5 gap-y-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {paginatedChannels.map((channel) => (
              <div
                key={channel.id}
                className="group rounded-2xl border border-yellow-500/40 bg-av-card overflow-hidden transition-all hover:border-yellow-400/70 hover:-translate-y-1 hover:shadow-lg hover:shadow-yellow-500/10 flex flex-col"
              >
                <Link href={`/channel/${channel.id}`} className="block">
                  <div className="relative h-28 bg-gradient-to-br from-av-light-blue/40 via-av-dark-blue to-av-dark-blue">
                    {channel.banner_url ? (
                      <img src={channel.banner_url} alt={channel.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">📡</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-av-dark-blue via-av-dark-blue/20 to-transparent" />
                    <div className="absolute bottom-2 left-2 rounded-full bg-av-error px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      {channel.type}
                    </div>
                  </div>
                </Link>
                <div className="p-3 flex flex-col flex-1">
                  <Link href={`/channel/${channel.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="truncate text-sm font-semibold text-av-white group-hover:text-av-orange transition-colors">{channel.name}</h2>
                      <span className="text-[10px] font-semibold text-av-light-orange flex-shrink-0">#{channel.channel_number}</span>
                    </div>
                  </Link>
                  <p className="mt-0.5 text-[11px] text-av-light-orange truncate">{getChannelMetaLine(channel)}</p>
                  <p className="mt-1.5 line-clamp-1 text-xs text-av-light-orange">{channel.description}</p>
                  <div className="mt-2 text-[11px] text-av-light-orange">
                    {channel.followers_count ?? 0} followers
                  </div>
                  <div className="mt-auto pt-3 flex items-center gap-2">
                    <Link
                      href={`/channel/${channel.id}`}
                      className="flex-1 rounded-lg border border-av-input-border/40 bg-white/[0.03] px-2 py-1.5 text-center text-[11px] font-semibold text-av-light-orange hover:text-av-white hover:border-av-orange/40 transition-all"
                    >
                      Visit Profile
                    </Link>
                    <Link
                      href={`/live/${channel.id}`}
                      className="flex-1 rounded-lg bg-gradient-to-r from-av-orange to-av-light-orange px-2 py-1.5 text-center text-[11px] font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/20 transition-all"
                    >
                      Tune In
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  safeCurrentPage === 1
                    ? "border-av-input-border/20 text-av-light-orange/40 cursor-not-allowed"
                    : "border-av-input-border/40 text-av-light-orange hover:text-av-white hover:border-av-orange/40"
                }`}
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, index) => {
                const page = index + 1;
                const isActive = page === safeCurrentPage;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    aria-current={isActive ? "page" : undefined}
                    className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold border inline-flex items-center justify-center transition-all ${
                      isActive
                        ? "bg-av-orange/20 border-av-orange/40 text-av-orange"
                        : "border-av-input-border/40 text-av-light-orange hover:text-av-white hover:border-av-orange/40"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage === totalPages}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  safeCurrentPage === totalPages
                    ? "border-av-input-border/20 text-av-light-orange/40 cursor-not-allowed"
                    : "border-av-input-border/40 text-av-light-orange hover:text-av-white hover:border-av-orange/40"
                }`}
              >
                Next
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </main>
    </>
  );
}