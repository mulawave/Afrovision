import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Download — AfroVision",
  description:
    "Download the AfroVision app for Android and iOS. Watch live streams, earn rewards, and connect with creators on the go.",
};

export default function DownloadPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            Get the App
          </p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">
            Download AfroVision
          </h1>
          <p className="mt-4 text-base text-av-hint leading-relaxed max-w-xl mx-auto">
            Take AfroVision with you. Watch live streams, chat with your
            community, send gifts, and earn vPT rewards — all from your phone.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-lg mx-auto mb-16">
          {/* Android */}
          <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 flex flex-col items-center">
            <span className="text-4xl mb-4">🤖</span>
            <h3 className="text-sm font-semibold text-av-white mb-1">Android</h3>
            <p className="text-xs text-av-hint mb-4">
              Android 8.0 and above
            </p>
            <span className="inline-flex px-5 py-2 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue opacity-60 cursor-default">
              Coming Soon
            </span>
          </div>

          {/* iOS */}
          <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 flex flex-col items-center">
            <span className="text-4xl mb-4">🍎</span>
            <h3 className="text-sm font-semibold text-av-white mb-1">iOS</h3>
            <p className="text-xs text-av-hint mb-4">
              iOS 15.0 and above
            </p>
            <span className="inline-flex px-5 py-2 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue opacity-60 cursor-default">
              Coming Soon
            </span>
          </div>
        </div>

        <section className="rounded-2xl bg-gradient-to-r from-av-orange/10 to-av-light-orange/10 border border-av-orange/20 p-8">
          <h2 className="text-lg font-bold text-av-white mb-2">
            Use the web version now
          </h2>
          <p className="text-sm text-av-hint mb-6">
            While the mobile apps are on the way, enjoy the full AfroVision
            experience right in your browser.
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
