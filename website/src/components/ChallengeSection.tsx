import { NavLink } from "@/components/NavLink";
import type { HomepageChallengeSection as HomepageChallengeSectionData } from "@/lib/homepage";

const DEFAULT_STATS = [
  { id: "1", value: "₦5M+", label: "Prize Pool" },
  { id: "2", value: "200+", label: "Contestants" },
  { id: "3", value: "10", label: "Categories" },
  { id: "4", value: "30", label: "Days Left" },
];

export function ChallengeSection({ section }: { section?: HomepageChallengeSectionData }) {
  const stats = section?.stats?.length ? section.stats : DEFAULT_STATS;
  const highlightText = section?.highlight_text || "Challenge";
  const fullTitle = section?.title || "AfroVision Challenge";
  const baseTitle = highlightText && fullTitle.endsWith(highlightText)
    ? fullTitle.slice(0, fullTitle.length - highlightText.length).trimEnd()
    : fullTitle;

  return (
    <section
      id="challenge"
      className="relative py-16 lg:py-24 overflow-hidden"
    >
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-av-orange/10 via-av-dark-blue to-purple-900/20" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-av-orange/5 blur-3xl" />
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full border border-av-orange/10" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full border border-av-light-blue/20" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-av-orange/15 border border-av-orange/30 text-xs font-bold uppercase tracking-widest text-av-orange mb-6">
          <span>{section?.badge_icon || "🏆"}</span>
          <span>{section?.badge_text || "Season 1 — Now Open"}</span>
        </div>

        {/* Title */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
          <span className="text-av-white">{baseTitle}{highlightText ? " " : ""}</span>
          {highlightText ? (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-av-orange to-av-light-orange">
              {highlightText}
            </span>
          ) : null}
        </h2>

        {/* Subtitle */}
        <p className="text-base lg:text-lg text-av-white/70 leading-relaxed max-w-2xl mx-auto mb-8">
          {section?.description || "Compete with creators across Africa. Stream your best content, grow your audience, and win prizes that launch careers. The stage is yours."}
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-8 mb-10">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl lg:text-3xl font-extrabold text-av-orange">
                {stat.value}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-av-hint font-semibold mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <NavLink
            href={section?.cta_href || "/challenge"}
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-xl hover:shadow-av-orange/30 hover:scale-105 active:scale-95"
            spinnerClassName="w-4 h-4"
          >
            {section?.cta_label || "🚀 Join the Challenge"}
          </NavLink>
          <NavLink
            href={section?.secondary_cta_href || "/challenge/rules"}
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-medium rounded-full border border-av-white/20 text-av-white hover:bg-av-white/5 transition-all"
            spinnerClassName="w-4 h-4"
          >
            {section?.secondary_cta_label || "View Rules & Prizes"}
          </NavLink>
        </div>
      </div>
    </section>
  );
}
