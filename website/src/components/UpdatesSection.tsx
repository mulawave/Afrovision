import { NavLink } from "@/components/NavLink";
import type { HomepageUpdatesSection } from "@/lib/homepage";

interface Update {
  id: number;
  title: string;
  summary: string;
  date: string;
  icon: string;
  tag: string;
}

const DEMO_UPDATES: Update[] = [
  {
    id: 1,
    title: "Premium Streams Launched",
    summary:
      "Exclusive premium content is now available. Subscribe to channels for ad-free viewing and creator-only perks.",
    date: "Mar 28, 2026",
    icon: "⭐",
    tag: "New Feature",
  },
  {
    id: 2,
    title: "Creator Subscriptions Added",
    summary:
      "Support your favorite creators with monthly subscriptions. Unlock badges, emotes, and exclusive streams.",
    date: "Mar 15, 2026",
    icon: "💎",
    tag: "Monetization",
  },
  {
    id: 3,
    title: "Real-Time Gifting Upgraded",
    summary:
      "Send animated gifts during live streams. New gift tiers and effects make every stream more exciting.",
    date: "Mar 02, 2026",
    icon: "🎁",
    tag: "Enhancement",
  },
  {
    id: 4,
    title: "VPT Wallet Integration",
    summary:
      "Earn and spend VPT tokens across the platform. Seamless wallet experience with instant transfers.",
    date: "Feb 18, 2026",
    icon: "💰",
    tag: "Economy",
  },
  {
    id: 5,
    title: "Multi-Language Support",
    summary:
      "AfroVision now supports Swahili, Yoruba, Hausa, Zulu, French, and Portuguese alongside English.",
    date: "Feb 05, 2026",
    icon: "🌐",
    tag: "Platform",
  },
  {
    id: 6,
    title: "Enhanced Stream Quality",
    summary:
      "Adaptive bitrate streaming with up to 4K quality. Lower latency for real-time interactions.",
    date: "Jan 20, 2026",
    icon: "📺",
    tag: "Performance",
  },
];

function tagColor(tag: string): string {
  const map: Record<string, string> = {
    "New Feature": "bg-av-orange/15 text-av-orange border-av-orange/30",
    Monetization: "bg-green-500/15 text-green-400 border-green-500/30",
    Enhancement: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    Economy: "bg-av-light-orange/15 text-av-light-orange border-av-light-orange/30",
    Platform: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    Performance: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  };
  return map[tag] ?? "bg-av-card text-av-hint border-av-input-border/30";
}

export function UpdatesSection({ section }: { section?: HomepageUpdatesSection }) {
  const updates = section?.items?.length
    ? section.items.map((item) => ({
        id: Number(item.id.replace(/\D/g, "")) || item.id.length,
        title: item.title,
        summary: item.summary,
        date: item.date,
        icon: item.icon,
        tag: item.tag,
      }))
    : DEMO_UPDATES;
  const isEmpty = updates.length === 0;

  return (
    <section id="updates" className="py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-av-white tracking-tight">
              {section?.title || "✨ Latest Updates"}
            </h2>
            <p className="text-sm text-av-hint mt-1">
              {section?.subtitle || "What&apos;s new on the platform — features, fixes, and milestones"}
            </p>
          </div>
          <NavLink
            href={section?.cta_href || "/updates"}
            className="hidden sm:inline-flex text-xs font-semibold text-av-orange hover:text-av-light-orange transition-colors"
          >
            {section?.cta_label || "All Updates →"}
          </NavLink>
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="text-center py-16 rounded-2xl bg-av-card/50 border border-av-input-border/20">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-av-hint text-sm">No updates yet. Stay tuned!</p>
          </div>
        )}

        {/* Grid */}
        {!isEmpty && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {updates.map((u) => (
              <article
                key={u.id}
                className="group rounded-2xl bg-av-card border border-av-input-border/30 p-5 transition-all duration-300 hover:border-av-orange/30 hover:shadow-lg hover:shadow-av-orange/5 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="text-2xl">{u.icon}</span>
                  <span
                    className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${tagColor(u.tag)}`}
                  >
                    {u.tag}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-av-white mb-1.5 group-hover:text-av-orange transition-colors">
                  {u.title}
                </h3>
                <p className="text-xs text-av-hint leading-relaxed mb-3 line-clamp-2">
                  {u.summary}
                </p>
                <time className="text-[10px] text-av-hint/60 uppercase tracking-wider font-medium">
                  {u.date}
                </time>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
