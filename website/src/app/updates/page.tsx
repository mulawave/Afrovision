import type { Metadata } from "next";
import Link from "next/link";
import { getStaticPageContent } from "@/lib/static-page-content";

export const metadata: Metadata = {
  title: "Platform Updates — AfroVision",
  description:
    "Stay up to date with the latest features, improvements, and milestones on AfroVision.",
};

interface Update {
  date: string;
  tag: string;
  tone: string;
  icon: string;
  title: string;
  summary: string;
  details?: string[];
}

interface UpdatesPageContent {
  eyebrow: string;
  title: string;
  intro: string;
  contact_title: string;
  contact_cta_label: string;
  contact_cta_href: string;
  items: Update[];
}

const UPDATE_TONE_CLASSES: Record<string, string> = {
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  orange: "bg-av-orange/15 text-av-orange border-av-orange/30",
  green: "bg-green-500/15 text-green-400 border-green-500/30",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  amber: "bg-av-light-orange/15 text-av-light-orange border-av-light-orange/30",
  cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const UPDATES_DEFAULT: UpdatesPageContent = {
  eyebrow: "What's New",
  title: "Platform Updates",
  intro:
    "The latest features, improvements, and milestones on AfroVision. We ship often — here's what's changed.",
  contact_title: "Want to suggest a feature or report a bug?",
  contact_cta_label: "Get in Touch",
  contact_cta_href: "/contact",
  items: [
    {
      date: "April 4, 2026",
      tag: "Legal",
      tone: "purple",
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
      tone: "red",
      icon: "🔒",
      title: "CAPTCHA Protection on Login & Registration",
      summary: "We've added Google reCAPTCHA verification to both login and registration forms, along with mandatory terms acceptance before account creation.",
    },
    {
      date: "April 4, 2026",
      tag: "New Feature",
      tone: "orange",
      icon: "🛡️",
      title: "Copyright Report System Launched",
      summary: "Content owners can now report copyright infringements with the new report form. Each report gets a unique tracking ID for follow-up, and our team reviews all submissions.",
    },
    {
      date: "March 28, 2026",
      tag: "New Feature",
      tone: "orange",
      icon: "⭐",
      title: "Premium Streams Launched",
      summary: "Exclusive premium content is now available. Subscribe to creator channels for ad-free viewing, creator-only perks, and access to exclusive streams.",
    },
    {
      date: "March 15, 2026",
      tag: "Monetization",
      tone: "green",
      icon: "💎",
      title: "Creator Subscriptions Added",
      summary: "Support your favourite creators with monthly subscriptions. Unlock custom badges, emotes, subscriber-only chat, and exclusive streams.",
    },
    {
      date: "March 2, 2026",
      tag: "Enhancement",
      tone: "blue",
      icon: "🎁",
      title: "Real-Time Gifting Upgraded",
      summary: "Send animated gifts during live streams with new gift tiers and visual effects. Creators earn vPT from every gift received.",
    },
    {
      date: "February 18, 2026",
      tag: "Economy",
      tone: "amber",
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
      tone: "purple",
      icon: "🌐",
      title: "Multi-Language Support",
      summary: "AfroVision now supports Swahili, Yoruba, Hausa, Zulu, French, and Portuguese alongside English. More languages coming soon.",
    },
    {
      date: "January 20, 2026",
      tag: "Performance",
      tone: "cyan",
      icon: "📺",
      title: "Enhanced Stream Quality",
      summary: "Adaptive bitrate streaming with up to 4K quality. Lower latency for real-time interactions and smoother playback on all devices and network conditions.",
    },
    {
      date: "January 5, 2026",
      tag: "Platform",
      tone: "purple",
      icon: "🚀",
      title: "AfroVision Beta Launch",
      summary: "AfroVision launches in beta with live streaming, channel creation, real-time chat, reactions, and the foundation of the vPT economy. Welcome to the future of African streaming.",
    },
  ],
};

const ITEMS_PER_PAGE = 10;

function getToneClasses(tone?: string) {
  if (!tone) return UPDATE_TONE_CLASSES.orange;
  return UPDATE_TONE_CLASSES[tone] || UPDATE_TONE_CLASSES.orange;
}

interface UpdatesPageProps {
  searchParams?: Promise<{ page?: string | string[] }>;
}

export default async function UpdatesPage({ searchParams }: UpdatesPageProps) {
  const managed = await getStaticPageContent<UpdatesPageContent>("updates");
  const content = managed || UPDATES_DEFAULT;
  const params = (await searchParams) || {};
  const totalItems = content.items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const pageParam = Number.parseInt(rawPage || "1", 10);
  const currentPage = Number.isNaN(pageParam) ? 1 : Math.min(Math.max(pageParam, 1), totalPages);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const visibleItems = content.items.slice(startIndex, endIndex);

  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">{content.eyebrow}</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">{content.title}</h1>
          <p className="mt-4 text-base text-av-light-orange leading-relaxed max-w-2xl">
            {content.intro}
          </p>
        </div>

        {/* Updates timeline */}
        <div className="space-y-6">
          {visibleItems.map((u, i) => (
            <article
              key={`${u.title}-${startIndex + i}`}
              className="group rounded-2xl bg-av-card border border-av-input-border/30 p-6 transition-all hover:border-av-orange/30 hover:shadow-lg hover:shadow-av-orange/5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{u.icon}</span>
                  <div>
                    <h2 className="text-base font-semibold text-av-white group-hover:text-av-orange transition-colors">
                      {u.title}
                    </h2>
                    <p className="text-xs text-av-light-orange mt-0.5">{u.date}</p>
                  </div>
                </div>
                <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getToneClasses(u.tone)}`}>
                  {u.tag}
                </span>
              </div>
              <p className="text-sm text-av-light-orange leading-relaxed">{u.summary}</p>
              {u.details && u.details.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {u.details.map((d, j) => (
                    <li key={j} className="flex gap-2 text-xs text-av-light-orange">
                      <span className="text-av-orange mt-0.5">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={`/updates?page=${Math.max(1, currentPage - 1)}`}
              aria-disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                currentPage === 1
                  ? "border-av-input-border/20 text-av-light-orange/40 pointer-events-none"
                  : "border-av-input-border/40 text-av-light-orange hover:text-av-white hover:border-av-orange/40"
              }`}
            >
              Previous
            </Link>

            {Array.from({ length: totalPages }, (_, index) => {
              const page = index + 1;
              const isActive = page === currentPage;
              return (
                <Link
                  key={page}
                  href={`/updates?page=${page}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold border inline-flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-av-orange/20 border-av-orange/40 text-av-orange"
                      : "border-av-input-border/40 text-av-light-orange hover:text-av-white hover:border-av-orange/40"
                  }`}
                >
                  {page}
                </Link>
              );
            })}

            <Link
              href={`/updates?page=${Math.min(totalPages, currentPage + 1)}`}
              aria-disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                currentPage === totalPages
                  ? "border-av-input-border/20 text-av-light-orange/40 pointer-events-none"
                  : "border-av-input-border/40 text-av-light-orange hover:text-av-white hover:border-av-orange/40"
              }`}
            >
              Next
            </Link>
          </div>
        )}

        {/* Bottom */}
        <div className="mt-12 text-center">
          <p className="text-sm text-av-light-orange mb-4">{content.contact_title}</p>
          <Link
            href={content.contact_cta_href || "/contact"}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-full border border-av-white/20 text-av-white hover:bg-av-white/5 transition-all"
          >
            {content.contact_cta_label} →
          </Link>
        </div>
      </div>
    </main>
  );
}
