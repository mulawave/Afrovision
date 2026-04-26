import type { Metadata } from "next";
import { getStaticPageContent } from "@/lib/static-page-content";

export const metadata: Metadata = {
  title: "Careers — AfroVision",
  description:
    "Join the AfroVision team. Explore open positions and help build Africa's premier streaming platform.",
};

const CAREERS_DEFAULT = {
  eyebrow: "Join Us",
  title: "Careers at AfroVision",
  intro:
    "We're building Africa's premier live streaming platform. If you're passionate about creators, community, and cutting-edge technology — we want to hear from you.",
  perks_title: "Why AfroVision?",
  perks: [
    { icon: "🌍", text: "Remote-first — work from anywhere in Africa" },
    { icon: "📈", text: "Early-stage equity and growth opportunity" },
    { icon: "🔥", text: "Direct impact on millions of African creators" },
    { icon: "🧰", text: "Modern stack — Flutter, Next.js, Node, GCP" },
  ],
  open_roles_title: "Open Positions",
  open_roles_body:
    "We don't have any open positions right now, but we're always looking for exceptional talent. Send your CV and a note about what excites you about AfroVision to:",
  careers_email: "careers@afrovision.online",
};

export default async function CareersPage() {
  const managed = await getStaticPageContent<typeof CAREERS_DEFAULT>("careers");
  const content = managed || CAREERS_DEFAULT;

  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
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

        {/* Perks */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-av-white mb-6">{content.perks_title}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {(content.perks || []).map((p) => (
              <div
                key={p.text}
                className="flex items-start gap-3 rounded-xl bg-av-card border border-av-input-border/30 p-5"
              >
                <span className="text-xl">{p.icon}</span>
                <p className="text-sm text-av-light-orange">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Open roles */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-av-white mb-6">{content.open_roles_title}</h2>
          <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 text-center">
            <p className="text-sm text-av-light-orange leading-relaxed">
              {content.open_roles_body}
            </p>
            <a
              href={`mailto:${content.careers_email || "careers@afrovision.online"}`}
              className="inline-block mt-4 text-av-orange font-semibold text-sm hover:underline"
            >
              {content.careers_email || "careers@afrovision.online"}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
