import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Platform Updates — AfroVision",
  description:
    "Stay up to date with the latest features, improvements, and milestones on AfroVision.",
};

interface Update {
  date: string;
  tag: string;
  tagColor: string;
  icon: string;
  title: string;
  summary: string;
  details?: string[];
}

const UPDATES: Update[] = [
  {
    date: "April 4, 2026",
    tag: "Legal",
    tagColor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    icon: "📜",
    title: "Comprehensive Legal Policies Published",
    summary: "We've published full, Google-compliant legal policies including Terms of Service, Privacy Policy, Cookie Policy, Anti-Money Laundering Policy, Refund Policy, and Copyright Infringement Policy.",
    details: [
      "Terms of Service — 20 sections covering all platform rules, vPT tokens, payments, and dispute resolution.",
      "Privacy Policy — 13 sections with GDPR-style user rights, data retention timelines, and sponsor data sharing clause.",
      "Cookie Policy — 9 sections explaining all cookie types, third-party cookies, and management options.",
      "Anti-Money Laundering Policy — 14 sections covering KYC, transaction monitoring, and sanctions screening.",
      "Refund Policy — 11 sections with 48-hour cooling-off, vPT exceptions, and clear refund process.",
      "Copyright Infringement Policy — 11 sections with DMCA takedown process and counter-notification procedure.",
    ],
  },
  {
    date: "April 4, 2026",
    tag: "Security",
    tagColor: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: "🔒",
    title: "CAPTCHA Protection on Login & Registration",
    summary: "We've added Google reCAPTCHA verification to both login and registration forms, along with mandatory terms acceptance before account creation.",
  },
  {
    date: "April 4, 2026",
    tag: "New Feature",
    tagColor: "bg-av-orange/15 text-av-orange border-av-orange/30",
    icon: "🛡️",
    title: "Copyright Report System Launched",
    summary: "Content owners can now report copyright infringements with the new report form. Each report gets a unique tracking ID for follow-up, and our team reviews all submissions.",
  },
  {
    date: "March 28, 2026",
    tag: "New Feature",
    tagColor: "bg-av-orange/15 text-av-orange border-av-orange/30",
    icon: "⭐",
    title: "Premium Streams Launched",
    summary: "Exclusive premium content is now available. Subscribe to creator channels for ad-free viewing, creator-only perks, and access to exclusive streams.",
  },
  {
    date: "March 15, 2026",
    tag: "Monetization",
    tagColor: "bg-green-500/15 text-green-400 border-green-500/30",
    icon: "💎",
    title: "Creator Subscriptions Added",
    summary: "Support your favourite creators with monthly subscriptions. Unlock custom badges, emotes, subscriber-only chat, and exclusive streams.",
  },
  {
    date: "March 2, 2026",
    tag: "Enhancement",
    tagColor: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: "🎁",
    title: "Real-Time Gifting Upgraded",
    summary: "Send animated gifts during live streams with new gift tiers and visual effects. Creators earn vPT from every gift received.",
  },
  {
    date: "February 18, 2026",
    tag: "Economy",
    tagColor: "bg-av-light-orange/15 text-av-light-orange border-av-light-orange/30",
    icon: "💰",
    title: "VPT Wallet Integration",
    summary: "Earn and spend VPT tokens across the platform. The integrated wallet supports instant transfers, staking rewards, and detailed transaction history.",
    details: [
      "In-app wallet with real-time balance updates.",
      "Send and receive vPT tokens instantly.",
      "Detailed transaction history with export options.",
      "Staking rewards for long-term holders.",
    ],
  },
  {
    date: "February 5, 2026",
    tag: "Platform",
    tagColor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    icon: "🌐",
    title: "Multi-Language Support",
    summary: "AfroVision now supports Swahili, Yoruba, Hausa, Zulu, French, and Portuguese alongside English. More languages coming soon.",
  },
  {
    date: "January 20, 2026",
    tag: "Performance",
    tagColor: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    icon: "📺",
    title: "Enhanced Stream Quality",
    summary: "Adaptive bitrate streaming with up to 4K quality. Lower latency for real-time interactions and smoother playback on all devices and network conditions.",
  },
  {
    date: "January 5, 2026",
    tag: "Platform",
    tagColor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    icon: "🚀",
    title: "AfroVision Beta Launch",
    summary: "AfroVision launches in beta with live streaming, channel creation, real-time chat, reactions, and the foundation of the vPT economy. Welcome to the future of African streaming.",
  },
];

export default function UpdatesPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">What&apos;s New</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Platform Updates</h1>
          <p className="mt-4 text-base text-av-hint leading-relaxed max-w-2xl">
            The latest features, improvements, and milestones on AfroVision. We ship often — here&apos;s what&apos;s changed.
          </p>
        </div>

        {/* Updates timeline */}
        <div className="space-y-6">
          {UPDATES.map((u, i) => (
            <article
              key={i}
              className="group rounded-2xl bg-av-card border border-av-input-border/30 p-6 transition-all hover:border-av-orange/30 hover:shadow-lg hover:shadow-av-orange/5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{u.icon}</span>
                  <div>
                    <h2 className="text-base font-semibold text-av-white group-hover:text-av-orange transition-colors">
                      {u.title}
                    </h2>
                    <p className="text-xs text-av-hint mt-0.5">{u.date}</p>
                  </div>
                </div>
                <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${u.tagColor}`}>
                  {u.tag}
                </span>
              </div>
              <p className="text-sm text-av-hint leading-relaxed">{u.summary}</p>
              {u.details && (
                <ul className="mt-3 space-y-1.5">
                  {u.details.map((d, j) => (
                    <li key={j} className="flex gap-2 text-xs text-av-hint">
                      <span className="text-av-orange mt-0.5">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 text-center">
          <p className="text-sm text-av-hint mb-4">Want to suggest a feature or report a bug?</p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-full border border-av-white/20 text-av-white hover:bg-av-white/5 transition-all"
          >
            Get in Touch →
          </Link>
        </div>
      </div>
    </main>
  );
}
