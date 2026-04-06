import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers — AfroVision",
  description:
    "Join the AfroVision team. Explore open positions and help build Africa's premier streaming platform.",
};

const PERKS = [
  { icon: "🌍", text: "Remote-first — work from anywhere in Africa" },
  { icon: "📈", text: "Early-stage equity and growth opportunity" },
  { icon: "🎯", text: "Direct impact on millions of African creators" },
  { icon: "🛠️", text: "Modern stack — Flutter, Next.js, Node, GCP" },
];

export default function CareersPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            Join Us
          </p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">
            Careers at AfroVision
          </h1>
          <p className="mt-4 text-base text-av-hint leading-relaxed max-w-2xl">
            We&apos;re building Africa&apos;s premier live streaming platform.
            If you&apos;re passionate about creators, community, and cutting-edge
            technology — we want to hear from you.
          </p>
        </div>

        {/* Perks */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-av-white mb-6">Why AfroVision?</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {PERKS.map((p) => (
              <div
                key={p.text}
                className="flex items-start gap-3 rounded-xl bg-av-card border border-av-input-border/30 p-5"
              >
                <span className="text-xl">{p.icon}</span>
                <p className="text-sm text-av-hint">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Open roles */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-av-white mb-6">Open Positions</h2>
          <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 text-center">
            <p className="text-sm text-av-hint leading-relaxed">
              We don&apos;t have any open positions right now, but we&apos;re always
              looking for exceptional talent. Send your CV and a note about what
              excites you about AfroVision to:
            </p>
            <a
              href="mailto:careers@afrovision.tv"
              className="inline-block mt-4 text-av-orange font-semibold text-sm hover:underline"
            >
              careers@afrovision.tv
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
