"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAppLinkConfig, type AppLinkConfig } from "@/lib/homepage";

export default function DownloadPage() {
  const [config, setConfig] = useState<AppLinkConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAppLinkConfig()
      .then((cfg) => {
        setConfig(cfg);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const androidUrl = config?.android?.play_store_url || "";
  const androidEnabled = config?.android?.enabled && androidUrl.length > 0;

  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            Get the App
          </p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">
            ADTv Go on Mobile
          </h1>
          <p className="mt-4 text-base text-av-light-orange leading-relaxed max-w-xl mx-auto">
            Take AfroVision with you everywhere. Download the ADTv Go app for the
            best mobile experience — watch live streams, earn rewards, and connect
            with creators on the go.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-lg mx-auto mb-16">
          {/* Android */}
          <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 flex flex-col items-center">
            <span className="text-4xl mb-4">🤖</span>
            <h3 className="text-sm font-semibold text-av-white mb-1">Android</h3>
            <p className="text-xs text-av-light-orange mb-4">
              {androidEnabled
                ? "Available now on Google Play"
                : "Coming soon to Google Play"}
            </p>
            {loading ? (
              <div className="h-10 w-32 animate-pulse rounded-xl bg-av-input-fill" />
            ) : androidEnabled ? (
              <a
                href={androidUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue hover:opacity-90 transition-opacity"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 20.5V3.5c0-.41.17-.79.44-1.06L13.5 12 3.44 21.56C3.17 21.29 3 20.91 3 20.5zM14.21 12.71l2.86 2.86-9.57 5.52 6.71-8.38zm6.35-3.66l-2.35 1.36-3.06-3.06 2.35-1.36c.5-.29 1.14-.12 1.43.38l1.64 2.84c.29.5.12 1.14-.38 1.43zM14.21 11.29l-9.57-5.52 9.57-5.52 3.06 3.06-3.06 7.98z" />
                </svg>
                Get it on Google Play
              </a>
            ) : (
              <span className="inline-flex px-5 py-2 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue opacity-80 cursor-default">
                Coming Soon
              </span>
            )}
          </div>

          {/* iOS */}
          <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 flex flex-col items-center">
            <span className="text-4xl mb-4">🍎</span>
            <h3 className="text-sm font-semibold text-av-white mb-1">iOS</h3>
            <p className="text-xs text-av-light-orange mb-4">
              Release preparation and store submission queue
            </p>
            <span className="inline-flex px-5 py-2 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue opacity-80 cursor-default">
              Coming Soon
            </span>
          </div>
        </div>

        <section className="rounded-2xl bg-gradient-to-r from-av-orange/10 to-av-light-orange/10 border border-av-orange/20 p-8">
          <h2 className="text-lg font-bold text-av-white mb-2">
            Use AfroVision right now
          </h2>
          <p className="text-sm text-av-light-orange mb-6">
            The browser experience is fully available. You can watch streams,
            chat, top up, subscribe, and manage your account immediately.
          </p>
          <Link
            href="/channels"
            className="inline-flex px-6 py-2.5 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue hover:opacity-90 transition-opacity"
          >
            Browse Channels
          </Link>
        </section>
      </div>
    </main>
  );
}
