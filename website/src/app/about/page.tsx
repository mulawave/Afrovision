import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us — AfroVision",
  description:
    "Learn about AfroVision — Africa's premier live streaming platform empowering creators and connecting communities.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            Our Story
          </p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">
            About AfroVision
          </h1>
          <p className="mt-4 text-base text-av-hint leading-relaxed max-w-2xl">
            AfroVision is Africa&apos;s premier live streaming platform — built
            to amplify African creators, connect vibrant communities, and reward
            everyone who participates.
          </p>
        </div>

        {/* Mission */}
        <section className="mb-12 rounded-2xl bg-av-card border border-av-input-border/30 p-8">
          <h2 className="text-xl font-bold text-av-white mb-4">Our Mission</h2>
          <p className="text-sm text-av-hint leading-relaxed">
            We believe the next generation of global entertainment will come from
            Africa. AfroVision exists to give African creators the stage, tools,
            and economic infrastructure they need to build sustainable careers —
            while rewarding viewers for their attention and participation.
          </p>
        </section>

        {/* Values grid */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-av-white mb-6">What We Stand For</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: "🌍",
                title: "Africa First",
                desc: "Built by Africans, for Africans — and open to the world.",
              },
              {
                icon: "💡",
                title: "Creator Economy",
                desc: "Every creator deserves fair compensation, powerful tools, and direct access to their audience.",
              },
              {
                icon: "🤝",
                title: "Community",
                desc: "Live streaming is social. We build for real-time connection, not passive consumption.",
              },
              {
                icon: "💰",
                title: "Shared Value",
                desc: "When the platform wins, creators and viewers win too — through vPT rewards and transparent economics.",
              },
            ].map((v) => (
              <div
                key={v.title}
                className="rounded-xl bg-av-card border border-av-input-border/30 p-6"
              >
                <span className="text-2xl">{v.icon}</span>
                <h3 className="mt-3 text-sm font-semibold text-av-white">
                  {v.title}
                </h3>
                <p className="mt-1 text-xs text-av-hint leading-relaxed">
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl bg-gradient-to-r from-av-orange/10 to-av-light-orange/10 border border-av-orange/20 p-8 text-center">
          <h2 className="text-lg font-bold text-av-white mb-2">
            Ready to join AfroVision?
          </h2>
          <p className="text-sm text-av-hint mb-6">
            Start watching, earning, and creating today.
          </p>
          <Link
            href="/register"
            className="inline-flex px-6 py-2.5 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </section>
      </div>
    </main>
  );
}
