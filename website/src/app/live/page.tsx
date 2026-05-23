"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getChannelsApi, type Channel } from "@/lib/api";

// metadata must be exported from a server component, but this is client
// — we set the title via <title> in the head instead for this page

const CHANNELS_PER_PAGE = 12;

export default function LivePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    getChannelsApi().then((res) => {
      if (cancelled) return;
      if (res.ok && "channels" in res.data) {
        setChannels(res.data.channels.filter((c) => c.is_live));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const totalPages = Math.max(1, Math.ceil(channels.length / CHANNELS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedChannels = useMemo(() => {
    const start = (safeCurrentPage - 1) * CHANNELS_PER_PAGE;
    return channels.slice(start, start + CHANNELS_PER_PAGE);
  }, [channels, safeCurrentPage]);

  return (
    <>
      <title>Live Now — AfroVision</title>
      <meta name="description" content="Watch live streams on AfroVision right now." />
      <main className="min-h-screen pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
              Streaming Now
            </p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">
              Live Streams
            </h1>
            <p className="mt-2 text-sm text-av-light-orange">
              Jump into a live broadcast — watch, chat, and earn rewards.
            </p>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden bg-av-card border border-av-input-border/30"
                >
                  <div className="h-40 animate-pulse bg-av-input-fill" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-av-input-fill animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-av-input-fill animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : channels.length === 0 ? (
            <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-12 text-center">
              <span className="text-4xl mb-4 block">📡</span>
              <h2 className="text-lg font-semibold text-av-white mb-2">
                No one is live right now
              </h2>
              <p className="text-sm text-av-light-orange mb-6">
                Check back soon or browse all channels.
              </p>
              <Link
                href="/channels"
                className="inline-flex px-5 py-2 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue hover:opacity-90 transition-opacity"
              >
                Browse Channels
              </Link>
            </div>
          ) : (
            <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedChannels.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/live/${ch.id}`}
                  className="group rounded-2xl bg-av-card border border-av-input-border/30 overflow-hidden hover:border-av-orange/40 hover:shadow-lg hover:shadow-av-orange/10 transition-all hover:-translate-y-1"
                >
                  <div className="relative h-40 bg-gradient-to-br from-av-light-blue/40 to-av-dark-blue">
                    <div className="absolute inset-0 bg-gradient-to-t from-av-card to-transparent" />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-av-error/90 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>
                    {ch.viewer_count != null && (
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-[10px] font-medium text-av-light-orange">
                        👁 {ch.viewer_count >= 1000 ? `${(ch.viewer_count / 1000).toFixed(1)}K` : ch.viewer_count}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-av-white truncate group-hover:text-av-orange transition-colors">
                      {ch.name}
                    </h3>
                    <p className="text-xs text-av-light-orange mt-0.5">{ch.category}</p>
                  </div>
                </Link>
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
