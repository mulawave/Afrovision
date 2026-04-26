import type { Metadata } from "next";
import Link from "next/link";
import { getStaticPageContent } from "@/lib/static-page-content";

export const metadata: Metadata = {
  title: "About Us — AfroVision",
  description:
    "Learn about AfroVision — Africa's premier live streaming platform empowering creators and connecting communities.",
};

const ABOUT_DEFAULT = {
  eyebrow: "Our Story",
  title: "About AfroVision",
  intro:
    "AfroVision is Africa's premier live streaming platform — built to amplify African creators, connect vibrant communities, and reward everyone who participates.",
  mission_title: "Our Mission",
  mission_body:
    "We believe the next generation of global entertainment will come from Africa. AfroVision exists to give African creators the stage, tools, and economic infrastructure they need to build sustainable careers — while rewarding viewers for their attention and participation.",
  values_title: "What We Stand For",
  values: [
    { icon: "🌍", title: "Africa First", desc: "Built by Africans, for Africans — and open to the world." },
    { icon: "💡", title: "Creator Economy", desc: "Every creator deserves fair compensation, powerful tools, and direct access to their audience." },
    { icon: "🤝", title: "Community", desc: "Live streaming is social. We build for real-time connection, not passive consumption." },
    { icon: "💰", title: "Shared Value", desc: "When the platform wins, creators and viewers win too — through vPT rewards and transparent economics." },
  ],
  cta_title: "Ready to join AfroVision?",
  cta_body: "Start watching, earning, and creating today.",
  cta_label: "Get Started",
  cta_href: "/register",
};

export default async function AboutPage() {
  const managed = await getStaticPageContent<typeof ABOUT_DEFAULT>("about");
  const content = managed || ABOUT_DEFAULT;

  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            {content.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">
            {content.title}
          </h1>
          <p className="mt-4 text-base text-av-light-orange leading-relaxed max-w-2xl">
            {content.intro}
          </p>
        </div>

        {/* Mission */}
        <section className="mb-12 rounded-2xl bg-av-card border border-av-input-border/30 p-8">
          <h2 className="text-xl font-bold text-av-white mb-4">{content.mission_title}</h2>
          <p className="text-sm text-av-light-orange leading-relaxed">
            {content.mission_body}
          </p>
        </section>

        {/* Values grid */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-av-white mb-6">{content.values_title}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {(content.values || []).map((v) => (
              <div
                key={v.title}
                className="rounded-xl bg-av-card border border-av-input-border/30 p-6"
              >
                <span className="text-2xl">{v.icon}</span>
                <h3 className="mt-3 text-sm font-semibold text-av-white">
                  {v.title}
                </h3>
                <p className="mt-1 text-xs text-av-light-orange leading-relaxed">
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl bg-gradient-to-r from-av-orange/10 to-av-light-orange/10 border border-av-orange/20 p-8 text-center">
          <h2 className="text-lg font-bold text-av-white mb-2">
            {content.cta_title}
          </h2>
          <p className="text-sm text-av-light-orange mb-6">
            {content.cta_body}
          </p>
          <Link
            href={content.cta_href || "/register"}
            className="inline-flex px-6 py-2.5 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue hover:opacity-90 transition-opacity"
          >
            {content.cta_label}
          </Link>
        </section>
      </div>
    </main>
  );
}
