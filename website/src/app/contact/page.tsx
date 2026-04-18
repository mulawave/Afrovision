import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Us — AfroVision",
  description:
    "Get in touch with AfroVision. Reach our support, partnerships, and press teams.",
};

const CONTACTS = [
  {
    icon: "??",
    title: "General Inquiries",
    detail: "hello@afrovision.online",
    href: "mailto:hello@afrovision.online",
  },
  {
    icon: "??",
    title: "Support",
    detail: "support@afrovision.online",
    href: "mailto:support@afrovision.online",
  },
  {
    icon: "??",
    title: "Partnerships",
    detail: "partners@afrovision.online",
    href: "mailto:partners@afrovision.online",
  },
  {
    icon: "??",
    title: "Press & Media",
    detail: "press@afrovision.online",
    href: "mailto:press@afrovision.online",
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            Get in Touch
          </p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">
            Contact Us
          </h1>
          <p className="mt-4 text-base text-av-light-orange leading-relaxed max-w-2xl">
            Have a question, partnership proposal, or need help? Reach out using
            any of the channels below.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {CONTACTS.map((c) => (
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
            Prefer social media?
          </h2>
          <p className="text-sm text-av-light-orange mb-4">
            Follow us on our social channels for updates and direct messages.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="https://twitter.com/AfroVisionTV"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-av-card border border-av-input-border/30 text-sm text-av-light-orange hover:text-av-white hover:border-av-orange/40 transition-all"
            >
              ?? Twitter
            </Link>
            <Link
              href="https://instagram.com/AfroVisionTV"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-av-card border border-av-input-border/30 text-sm text-av-light-orange hover:text-av-white hover:border-av-orange/40 transition-all"
            >
              Instagram
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
