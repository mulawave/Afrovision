import type { Metadata } from "next";
import Link from "next/link";
import { getStaticPageContent } from "@/lib/static-page-content";

export const metadata: Metadata = {
  title: "Contact Us — AfroVision",
  description:
    "Get in touch with AfroVision. Reach our support, partnerships, and press teams.",
};

const CONTACT_DEFAULT = {
  eyebrow: "Get in Touch",
  title: "Contact Us",
  intro: "Have a question, partnership proposal, or need help? Reach out using any of the channels below.",
  contacts: [
    { icon: "📨", title: "General Inquiries", detail: "hello@afrovision.online", href: "mailto:hello@afrovision.online" },
    { icon: "🛠️", title: "Support", detail: "support@afrovision.online", href: "mailto:support@afrovision.online" },
    { icon: "🤝", title: "Partnerships", detail: "partners@afrovision.online", href: "mailto:partners@afrovision.online" },
    { icon: "📰", title: "Press & Media", detail: "press@afrovision.online", href: "mailto:press@afrovision.online" },
  ],
  social_cta_title: "Prefer social media?",
  social_cta_body: "Follow us on our social channels for updates and direct messages.",
  social_links: [
    { label: "Twitter", href: "https://twitter.com/AfroVisionTV" },
    { label: "Instagram", href: "https://instagram.com/AfroVisionTV" },
  ],
};

export default async function ContactPage() {
  const managed = await getStaticPageContent<typeof CONTACT_DEFAULT>("contact");
  const content = managed || CONTACT_DEFAULT;

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

        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {(content.contacts || []).map((c) => (
            <a
              key={c.title}
              href={c.href}
              className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 hover:border-av-orange/40 transition-colors group"
            >
              <span className="text-2xl">{c.icon}</span>
              <h3 className="mt-3 text-sm font-semibold text-av-white group-hover:text-av-orange transition-colors">
                {c.title}
              </h3>
              <p className="mt-1 text-xs text-av-light-orange">{c.detail}</p>
            </a>
          ))}
        </div>

        <section className="rounded-2xl bg-gradient-to-r from-av-orange/10 to-av-light-orange/10 border border-av-orange/20 p-8 text-center">
          <h2 className="text-lg font-bold text-av-white mb-2">
            {content.social_cta_title}
          </h2>
          <p className="text-sm text-av-light-orange mb-4">
            {content.social_cta_body}
          </p>
          <div className="flex justify-center gap-4">
            {(content.social_links || []).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-av-card border border-av-input-border/30 text-sm text-av-light-orange hover:text-av-white hover:border-av-orange/40 transition-all"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
