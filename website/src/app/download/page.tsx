import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mobile Rollout — AfroVision",
  description:
    "Track the AfroVision mobile rollout for Android and iOS while the browser experience remains fully available.",
};

export default function DownloadPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            Mobile Rollout
          </p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">
            AfroVision on Mobile
          </h1>
          <p className="mt-4 text-base text-av-light-orange leading-relaxed max-w-xl mx-auto">
            The mobile apps are moving through staged release, not full public
            store distribution yet. Use AfroVision in your browser today while
            Android validation and iOS release steps continue.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-lg mx-auto mb-16">
          {/* Android */}
          <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 flex flex-col items-center">
            <span className="text-4xl mb-4">🤖</span>
            <h3 className="text-sm font-semibold text-av-white mb-1">Android</h3>
            <p className="text-xs text-av-light-orange mb-4">
              Limited rollout and device validation in progress
            </p>
            <span className="inline-flex px-5 py-2 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue opacity-80 cursor-default">
              Rollout In Progress
            </span>
          </div>

          {/* iOS */}
          <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 flex flex-col items-center">
            <span className="text-4xl mb-4">🍎</span>
            <h3 className="text-sm font-semibold text-av-white mb-1">iOS</h3>
            <p className="text-xs text-av-light-orange mb-4">
              Release preparation and store submission queue
            </p>
            <span className="inline-flex px-5 py-2 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue opacity-80 cursor-default">
              Release Preparation
            </span>
          </div>
        </div>

        <section className="rounded-2xl bg-gradient-to-r from-av-orange/10 to-av-light-orange/10 border border-av-orange/20 p-8">
          <h2 className="text-lg font-bold text-av-white mb-2">
            Use AfroVision right now
          </h2>
          <p className="text-sm text-av-light-orange mb-6">
            The browser experience remains the primary live environment while
            mobile rollout continues. You can watch streams, chat, top up,
            subscribe, and manage your account immediately.
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
