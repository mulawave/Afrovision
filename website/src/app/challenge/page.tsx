import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getChallengePageContent, type ChallengePageContent } from "@/lib/challenge-content";
import ChallengeRouteGate from "./ChallengeRouteGate";

const DEFAULT_CHALLENGE: ChallengePageContent = {
  page_meta_title: "AfroVision Challenge: Amazons - Build. Compete. Win.",
  page_meta_description:
    "AfroVision Challenge: Amazons - a high-stakes entrepreneurial reality competition where Nigeria's most promising individuals are transformed into business leaders under real funding, real stakes, and national visibility.",
  hero_enabled: true,
  hero_badge_icon: "🏆",
  hero_badge: "Pitch 1 - Amazons",
  hero_title_primary: "AfroVision",
  hero_title_highlight: "Challenge",
  hero_intro:
    "A high-stakes entrepreneurial reality competition where Nigeria's most promising individuals are transformed into business leaders under intense pressure, real funding conditions, and national visibility.",
  hero_note: "This is not theory. This is not classroom learning. This is real-world business creation under fire.",
  hero_cta_label: "Create Account to Join",
  hero_cta_href: "/register",
  hero_secondary_label: "View Full Rules",
  hero_secondary_href: "/challenge/rules",
  hero_stats: [
    { id: "hero-stat-1", value: "10M+", label: "Prize Pool" },
    { id: "hero-stat-2", value: "14-15", label: "Contestants" },
    { id: "hero-stat-3", value: "12+", label: "Episodes" },
    { id: "hero-stat-4", value: "Free", label: "Entry" },
  ],
  season_enabled: true,
  season_eyebrow: "Season Identity",
  season_title: "The Amazons",
  season_description:
    "This is not just a name. Core themes include female strength, economic independence, leadership under pressure, and collaboration.",
  themes: [
    { id: "theme-1", icon: "💪", label: "Female Strength", sort_order: 1 },
    { id: "theme-2", icon: "💸", label: "Economic Independence", sort_order: 2 },
    { id: "theme-3", icon: "👩‍💼", label: "Leadership Under Pressure", sort_order: 3 },
    { id: "theme-4", icon: "🤝", label: "Collaboration vs Ego", sort_order: 4 },
    { id: "theme-5", icon: "🌍", label: "African Excellence", sort_order: 5 },
    { id: "theme-6", icon: "🏢", label: "Real Business Creation", sort_order: 6 },
  ],
  lifecycle_enabled: true,
  lifecycle_title: "Challenge Lifecycle",
  lifecycle_subtitle: "Each challenge progresses through five distinct phases",
  lifecycle_current_badge_label: "Current Phase",
  lifecycle_phase_prefix: "Phase",
  lifecycle_phases: [
    {
      id: "phase-1",
      icon: "📋",
      phase: "Pre-register",
      subtitle: "Early Access",
      desc: "Create your verified AfroVision account and express intent to participate.",
      status: "active",
      sort_order: 1,
    },
    {
      id: "phase-2",
      icon: "🎤",
      phase: "Registration & Audition",
      subtitle: "Apply and Submit",
      desc: "Complete registration and submit your audition in one continuous flow.",
      status: "upcoming",
      sort_order: 2,
    },
    {
      id: "phase-3",
      icon: "🚀",
      phase: "Kickoff",
      subtitle: "Program Start",
      desc: "Selected participants are onboarded and the challenge officially begins.",
      status: "upcoming",
      sort_order: 3,
    },
    {
      id: "phase-4",
      icon: "🎬",
      phase: "Running",
      subtitle: "Live Competition",
      desc: "Finalists compete, build, defend, and prove ideas under pressure.",
      status: "upcoming",
      sort_order: 4,
    },
    {
      id: "phase-5",
      icon: "🌱",
      phase: "Incubation",
      subtitle: "Support & Growth",
      desc: "Top participants receive incubation support to scale into durable ventures.",
      status: "upcoming",
      sort_order: 5,
    },
  ],
  unstoppable_enabled: true,
  unstoppable_title: "What Makes It Unstoppable",
  unstoppable_subtitle: "No other African show is doing this",
  unstoppable_layout: "grid",
  unstoppable_text_align: "left",
  unstoppable_items: [
    {
      id: "unstoppable-1",
      icon: "🎲",
      title: "Randomized Destiny",
      desc: "Nobody comes with a pre-built idea. Business concepts are assigned randomly.",
      sort_order: 1,
    },
    {
      id: "unstoppable-2",
      icon: "💰",
      title: "Real Stakes",
      desc: "High-stakes competition with funding and national visibility.",
      sort_order: 2,
    },
    {
      id: "unstoppable-3",
      icon: "🧠",
      title: "AI Simulation Engine",
      desc: "Businesses are stress-tested over simulated years.",
      sort_order: 3,
    },
  ],
  structure_enabled: true,
  structure_title: "Show Structure",
  structure_subtitle: "How the season unfolds across episodes",
  structure_phases: [
    { id: "structure-1", ep: "Ep 1-2", title: "Selection & Assignment", desc: "Contestants introduced and assigned ideas.", sort_order: 1 },
    { id: "structure-2", ep: "Ep 3-5", title: "Immersion & Foundation", desc: "Crash learning and early simulations.", sort_order: 2 },
    { id: "structure-3", ep: "Ep 6-8", title: "Build & Strategize", desc: "Financial models and strategy refinement.", sort_order: 3 },
    { id: "structure-4", ep: "Final", title: "The Merge", desc: "Finalists build one company together.", sort_order: 4 },
  ],
  prizes_enabled: true,
  prizes_title: "Prizes & Rewards",
  prizes_subtitle: "On this show, even losing is winning",
  prizes: [
    { id: "prize-1", icon: "👑", place: "Grand Winner", amount: "10,000,000", desc: "Seed funding + national visibility", sort_order: 1 },
    { id: "prize-2", icon: "🥈", place: "Runner Up", amount: "3,000,000", desc: "Incubation and brand deals", sort_order: 2 },
    { id: "prize-3", icon: "🥉", place: "3rd Place", amount: "1,500,000", desc: "Grant and introductions", sort_order: 3 },
  ],
  join_enabled: true,
  join_title: "How To Join",
  join_subtitle: "Four simple steps to enter the competition",
  join_layout: "grid",
  join_single_item_position: "auto",
  join_steps: [
    { id: "join-step-1", step: "1", title: "Register", desc: "Create your account and verify your email.", sort_order: 1 },
    { id: "join-step-2", step: "2", title: "Record", desc: "Film a short pitch video.", sort_order: 2 },
    { id: "join-step-3", step: "3", title: "Submit", desc: "Upload your pitch on the challenge flow.", sort_order: 3 },
    { id: "join-step-4", step: "4", title: "Engage", desc: "Share and grow engagement.", sort_order: 4 },
  ],
  platform_enabled: true,
  platform_eyebrow: "Platform Integration",
  platform_title: "More Than A Show",
  platform_body:
    "AfroVision Challenge connects content, community, and entrepreneurship into one ecosystem.",
  platform_features: [
    { id: "platform-1", icon: "📺", title: "Watch Inside App", desc: "Episodes stream on AfroVision.", sort_order: 1 },
    { id: "platform-2", icon: "👤", title: "Follow Contestants", desc: "Support your favourites with engagement.", sort_order: 2 },
    { id: "platform-3", icon: "💬", title: "Join Discussions", desc: "Real-time chat for episodes.", sort_order: 3 },
    { id: "platform-4", icon: "📚", title: "Learn Business", desc: "Business lessons tied to episodes.", sort_order: 4 },
  ],
  faq_enabled: true,
  faq_title: "Frequently Asked Questions",
  faq_subtitle: "Everything you need to know",
  faqs: [
    { id: "faq-1", q: "How do I join the Challenge?", a: "Create an account and complete registration steps.", sort_order: 1 },
    { id: "faq-2", q: "What is the pitch requirement?", a: "Submit a short business pitch video.", sort_order: 2 },
  ],
  bottom_cta_enabled: true,
  bottom_cta_title: "Ready to Build Your Empire?",
  bottom_cta_body: "Create your account and submit your pitch when registration opens.",
  bottom_cta_primary_label: "Create Account Now",
  bottom_cta_primary_href: "/register",
  bottom_cta_secondary_label: "Read Full Rules",
  bottom_cta_secondary_href: "/challenge/rules",
};

function bySortOrder<T extends { sort_order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function getTextAlignClass(value: string | undefined): string {
  return value === "justify" ? "text-justify" : "text-left";
}

function renderRichText(text: string | undefined, className: string) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  if (!source) return null;

  const lines = source.split("\n");
  const nodes: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushParagraph(keyPrefix: string) {
    if (!paragraphBuffer.length) return;
    nodes.push(
      <p key={`${keyPrefix}-${nodes.length}`} className={className}>
        {paragraphBuffer.join(" ")}
      </p>
    );
    paragraphBuffer = [];
  }

  function flushList(keyPrefix: string) {
    if (!listBuffer.length || !listType) return;
    if (listType === "ol") {
      nodes.push(
        <ol key={`${keyPrefix}-${nodes.length}`} className={`${className} list-decimal pl-5 space-y-1`}>
          {listBuffer.map((item, index) => <li key={`${keyPrefix}-ol-${index}`}>{item}</li>)}
        </ol>
      );
    } else {
      nodes.push(
        <ul key={`${keyPrefix}-${nodes.length}`} className={`${className} list-disc pl-5 space-y-1`}>
          {listBuffer.map((item, index) => <li key={`${keyPrefix}-ul-${index}`}>{item}</li>)}
        </ul>
      );
    }
    listBuffer = [];
    listType = null;
  }

  lines.forEach((raw) => {
    const line = raw.trim();
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);

    if (!line) {
      flushParagraph("p");
      flushList("l");
      return;
    }

    if (orderedMatch) {
      flushParagraph("p");
      if (listType && listType !== "ol") flushList("l");
      listType = "ol";
      listBuffer.push(orderedMatch[1]);
      return;
    }

    if (unorderedMatch) {
      flushParagraph("p");
      if (listType && listType !== "ul") flushList("l");
      listType = "ul";
      listBuffer.push(unorderedMatch[1]);
      return;
    }

    flushList("l");
    paragraphBuffer.push(line);
  });

  flushParagraph("p");
  flushList("l");

  return nodes;
}

export async function generateMetadata(): Promise<Metadata> {
  const managed = await getChallengePageContent();
  const content = managed || DEFAULT_CHALLENGE;
  return {
    title: content.page_meta_title || DEFAULT_CHALLENGE.page_meta_title,
    description: content.page_meta_description || DEFAULT_CHALLENGE.page_meta_description,
  };
}

export default async function ChallengePage() {
  const managed = await getChallengePageContent();
  const content = managed || DEFAULT_CHALLENGE;

  // If no active challenge, show "Starting soon" message
  if (content.no_active_challenge) {
    return (
      <main className="min-h-screen pt-20 pb-16">
        <ChallengeRouteGate />
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center py-32">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-av-orange/15 border border-av-orange/30 text-xs font-bold uppercase tracking-[0.15em] text-av-orange mb-6">
              <span>🏆</span>
              <span>AfroVision Challenge</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">
              <span className="text-av-white">Starting </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-av-orange to-av-light-orange">
                Soon
              </span>
            </h1>
            <p className="text-lg lg:text-xl text-av-light-orange leading-relaxed max-w-3xl mx-auto mb-4">
              A new challenge season is coming soon. Stay tuned for updates on the next AfroVision Challenge.
            </p>
            <p className="text-sm text-av-light-orange max-w-2xl mx-auto mb-10">
              Check back later for registration details, prize announcements, and contestant information.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const heroStats = content.hero_stats?.length ? content.hero_stats : DEFAULT_CHALLENGE.hero_stats;
  const themes = content.themes?.length ? bySortOrder(content.themes) : DEFAULT_CHALLENGE.themes;
  const lifecyclePhases = content.lifecycle_phases?.length
    ? bySortOrder(content.lifecycle_phases)
    : DEFAULT_CHALLENGE.lifecycle_phases;
  const unstoppableItems = content.unstoppable_items?.length
    ? bySortOrder(content.unstoppable_items)
    : DEFAULT_CHALLENGE.unstoppable_items;
  const structurePhases = content.structure_phases?.length
    ? bySortOrder(content.structure_phases)
    : DEFAULT_CHALLENGE.structure_phases;
  const prizes = content.prizes?.length ? bySortOrder(content.prizes) : DEFAULT_CHALLENGE.prizes;
  const joinSteps = content.join_steps?.length ? bySortOrder(content.join_steps) : DEFAULT_CHALLENGE.join_steps;
  const platformFeatures = content.platform_features?.length
    ? bySortOrder(content.platform_features)
    : DEFAULT_CHALLENGE.platform_features;
  const faqs = content.faqs?.length ? bySortOrder(content.faqs) : DEFAULT_CHALLENGE.faqs;
  const unstoppableCardsClass = "space-y-5";
  const unstoppableTextClass = `text-xs text-av-light-orange leading-relaxed ${getTextAlignClass(content.unstoppable_text_align)}`;
  const joinLayout = content.join_layout || DEFAULT_CHALLENGE.join_layout;
  const joinCardsClass = joinLayout === "rows" ? "space-y-5" : "grid sm:grid-cols-2 lg:grid-cols-4 gap-5";
  const isSingleJoinCard = joinSteps.length === 1;
  const singleJoinPosition = content.join_single_item_position || DEFAULT_CHALLENGE.join_single_item_position;
  const singleJoinWrapperClass =
    !isSingleJoinCard || joinLayout !== "grid" || singleJoinPosition === "left" || singleJoinPosition === "auto"
      ? ""
      : singleJoinPosition === "center"
        ? "flex justify-center"
        : "flex justify-end";

  return (
    <main className="min-h-screen pt-20 pb-16">
      <ChallengeRouteGate />
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        {content.hero_enabled !== false ? (
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-av-orange/15 border border-av-orange/30 text-xs font-bold uppercase tracking-[0.15em] text-av-orange mb-6">
            <span>{content.hero_badge_icon || DEFAULT_CHALLENGE.hero_badge_icon}</span>
            <span>{content.hero_badge || DEFAULT_CHALLENGE.hero_badge}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">
            <span className="text-av-white">{content.hero_title_primary || DEFAULT_CHALLENGE.hero_title_primary} </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-av-orange to-av-light-orange">
              {content.hero_title_highlight || DEFAULT_CHALLENGE.hero_title_highlight}
            </span>
          </h1>

          <p className="text-lg lg:text-xl text-av-light-orange leading-relaxed max-w-3xl mx-auto mb-4">
            {content.hero_intro || DEFAULT_CHALLENGE.hero_intro}
          </p>
          <p className="text-sm text-av-light-orange max-w-2xl mx-auto mb-10">
            {content.hero_note || DEFAULT_CHALLENGE.hero_note}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-10 mb-12">
            {heroStats.map((s) => (
              <div key={s.id} className="text-center">
                <p className="text-3xl lg:text-4xl font-extrabold text-av-orange">{s.value}</p>
                <p className="text-[10px] uppercase tracking-[0.15em] text-av-light-orange font-semibold mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href={content.hero_cta_href || DEFAULT_CHALLENGE.hero_cta_href}
              className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-xl hover:shadow-av-orange/30 hover:scale-105 active:scale-95"
            >
              {content.hero_cta_label || DEFAULT_CHALLENGE.hero_cta_label}
            </Link>
            <Link
              href={content.hero_secondary_href || DEFAULT_CHALLENGE.hero_secondary_href}
              className="inline-flex items-center gap-2 px-8 py-4 text-sm font-medium rounded-full border border-av-white/20 text-av-white hover:bg-av-white/5 transition-all"
            >
              {content.hero_secondary_label || DEFAULT_CHALLENGE.hero_secondary_label}
            </Link>
          </div>
        </div>
        ) : null}

        {content.season_enabled !== false ? (
        <section className="mb-20">
          <div className="rounded-3xl bg-gradient-to-br from-av-orange/10 via-av-card to-purple-900/10 border border-av-orange/20 p-8 lg:p-12 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-av-light-orange font-bold mb-3">{content.season_eyebrow || DEFAULT_CHALLENGE.season_eyebrow}</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-av-white mb-4">{content.season_title || DEFAULT_CHALLENGE.season_title}</h2>
            <div className="text-sm text-av-light-orange max-w-2xl mx-auto mb-8 space-y-3">
              {renderRichText(content.season_description || DEFAULT_CHALLENGE.season_description, "text-sm text-av-light-orange text-center")}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {themes.map((t) => (
                <div key={t.id} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-av-dark-blue/60 border border-av-input-border/40 text-xs font-semibold text-av-light-orange">
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {content.lifecycle_enabled !== false ? (
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">{content.lifecycle_title || DEFAULT_CHALLENGE.lifecycle_title}</h2>
          <p className="text-sm text-av-light-orange text-center mb-8">{content.lifecycle_subtitle || DEFAULT_CHALLENGE.lifecycle_subtitle}</p>
          <div className="grid md:grid-cols-2 gap-5">
            {lifecyclePhases.map((p, i) => (
              <div
                key={p.id}
                className={`relative rounded-2xl bg-av-card border p-6 transition-all hover:shadow-lg hover:shadow-av-orange/5 ${
                  p.status === "active" ? "border-av-orange/50 shadow-lg shadow-av-orange/10" : "border-av-input-border/30 hover:border-av-orange/30"
                }`}
              >
                {p.status === "active" ? (
                  <div className="absolute -top-2.5 right-4 px-3 py-0.5 rounded-full bg-av-orange text-[10px] font-bold text-av-dark-blue uppercase tracking-wider">
                    {content.lifecycle_current_badge_label || DEFAULT_CHALLENGE.lifecycle_current_badge_label}
                  </div>
                ) : null}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-av-orange/15 border border-av-orange/30 flex items-center justify-center text-xl">
                    {p.icon}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-av-orange font-bold">{content.lifecycle_phase_prefix || DEFAULT_CHALLENGE.lifecycle_phase_prefix} {i + 1}</span>
                    <h3 className="text-base font-bold text-av-white mb-0.5">{p.phase}</h3>
                    <p className="text-xs text-av-light-orange font-medium mb-2">{p.subtitle}</p>
                    <div className="space-y-2">
                      {renderRichText(p.desc, "text-xs text-av-light-orange leading-relaxed text-left")}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {content.unstoppable_enabled !== false ? (
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">{content.unstoppable_title || DEFAULT_CHALLENGE.unstoppable_title}</h2>
          <p className="text-sm text-av-light-orange text-center mb-8">{content.unstoppable_subtitle || DEFAULT_CHALLENGE.unstoppable_subtitle}</p>
          <div className={unstoppableCardsClass}>
            {unstoppableItems.map((item) => (
              <div key={item.id} className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 transition-all hover:border-av-orange/30 hover:shadow-lg hover:shadow-av-orange/5">
                <span className="text-3xl block mb-3">{item.icon}</span>
                <h3 className="text-sm font-bold text-av-white mb-2">{item.title}</h3>
                <div className="space-y-2">
                  {renderRichText(item.desc, unstoppableTextClass)}
                </div>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {content.structure_enabled !== false ? (
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">{content.structure_title || DEFAULT_CHALLENGE.structure_title}</h2>
          <p className="text-sm text-av-light-orange text-center mb-8">{content.structure_subtitle || DEFAULT_CHALLENGE.structure_subtitle}</p>
          <div className="space-y-4">
            {structurePhases.map((sp, i) => (
              <div key={sp.id} className="flex gap-4 items-start rounded-2xl bg-av-card border border-av-input-border/30 p-5 transition-all hover:border-av-orange/30">
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-av-orange/15 border border-av-orange/30 flex items-center justify-center text-sm font-bold text-av-orange">
                    {i + 1}
                  </div>
                  <p className="text-[9px] text-av-orange font-bold mt-1 uppercase tracking-wide">{sp.ep}</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-av-white mb-1">{sp.title}</h3>
                  <div className="space-y-2">
                    {renderRichText(sp.desc, "text-xs text-av-light-orange leading-relaxed text-left")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {content.prizes_enabled !== false ? (
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">{content.prizes_title || DEFAULT_CHALLENGE.prizes_title}</h2>
          <p className="text-sm text-av-light-orange text-center mb-8">{content.prizes_subtitle || DEFAULT_CHALLENGE.prizes_subtitle}</p>
          <div className="space-y-4">
            {prizes.map((p) => (
              <div key={p.id} className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 transition-all hover:border-av-orange/30">
                <div className="flex items-start gap-4">
                  <span className="text-3xl flex-shrink-0">{p.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                      <h3 className="text-sm font-bold text-av-white">{p.place}</h3>
                      <span className="text-lg font-extrabold text-av-orange">{p.amount}</span>
                    </div>
                    <div className="space-y-2">
                      {renderRichText(p.desc, "text-xs text-av-light-orange leading-relaxed text-left")}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {content.join_enabled !== false ? (
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">{content.join_title || DEFAULT_CHALLENGE.join_title}</h2>
          <p className="text-sm text-av-light-orange text-center mb-8">{content.join_subtitle || DEFAULT_CHALLENGE.join_subtitle}</p>
          <div className={singleJoinWrapperClass}>
          <div className={isSingleJoinCard && joinLayout === "grid" ? "" : joinCardsClass}>
            {joinSteps.map((s) => (
              <div key={s.id} className={`rounded-2xl bg-av-card border border-av-input-border/30 p-6 text-center transition-all hover:border-av-orange/30 ${isSingleJoinCard && joinLayout === "grid" ? "w-full max-w-sm" : ""}`}>
                <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-lg font-extrabold text-av-dark-blue mb-4">
                  {s.step}
                </div>
                <h3 className="text-sm font-bold text-av-white mb-2">{s.title}</h3>
                <div className="space-y-2">
                  {renderRichText(s.desc, "text-xs text-av-light-orange leading-relaxed text-center")}
                </div>
              </div>
            ))}
          </div>
          </div>
        </section>
        ) : null}

        {content.platform_enabled !== false ? (
        <section className="mb-20">
          <div className="rounded-3xl bg-gradient-to-br from-purple-900/20 via-av-card to-av-orange/5 border border-av-input-border/30 p-8 lg:p-12">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-[0.2em] text-av-light-orange font-bold mb-2">{content.platform_eyebrow || DEFAULT_CHALLENGE.platform_eyebrow}</p>
              <h2 className="text-2xl font-bold text-av-white mb-3">{content.platform_title || DEFAULT_CHALLENGE.platform_title}</h2>
              <div className="text-sm text-av-light-orange max-w-2xl mx-auto space-y-3">
                {renderRichText(content.platform_body || DEFAULT_CHALLENGE.platform_body, "text-sm text-av-light-orange text-center")}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {platformFeatures.map((f) => (
                <div key={f.id} className="rounded-xl bg-av-dark-blue/50 border border-av-input-border/20 p-5 text-center">
                  <span className="text-2xl block mb-2">{f.icon}</span>
                  <h3 className="text-xs font-bold text-av-white mb-1">{f.title}</h3>
                  <div className="space-y-1">
                    {renderRichText(f.desc, "text-[11px] text-av-light-orange leading-relaxed text-center")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {content.faq_enabled !== false ? (
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">{content.faq_title || DEFAULT_CHALLENGE.faq_title}</h2>
          <p className="text-sm text-av-light-orange text-center mb-8">{content.faq_subtitle || DEFAULT_CHALLENGE.faq_subtitle}</p>
          <div className="space-y-4 max-w-3xl mx-auto">
            {faqs.map((f) => (
              <div key={f.id} className="rounded-2xl bg-av-card border border-av-input-border/30 p-5">
                <h3 className="text-sm font-semibold text-av-white mb-2">{f.q}</h3>
                <div className="space-y-2">
                  {renderRichText(f.a, "text-xs text-av-light-orange leading-relaxed text-left")}
                </div>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {content.bottom_cta_enabled !== false ? (
        <section>
          <div className="rounded-3xl bg-gradient-to-br from-av-orange/10 via-av-card to-purple-900/10 border border-av-orange/20 p-10 lg:p-14 text-center">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-av-white mb-4">{content.bottom_cta_title || DEFAULT_CHALLENGE.bottom_cta_title}</h2>
            <div className="text-sm text-av-light-orange max-w-xl mx-auto mb-8 space-y-3">
              {renderRichText(content.bottom_cta_body || DEFAULT_CHALLENGE.bottom_cta_body, "text-sm text-av-light-orange text-center")}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href={content.bottom_cta_primary_href || DEFAULT_CHALLENGE.bottom_cta_primary_href}
                className="inline-flex items-center gap-2 px-10 py-4 text-sm font-bold rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-xl hover:shadow-av-orange/30 hover:scale-105 active:scale-95"
              >
                {content.bottom_cta_primary_label || DEFAULT_CHALLENGE.bottom_cta_primary_label}
              </Link>
              <Link
                href={content.bottom_cta_secondary_href || DEFAULT_CHALLENGE.bottom_cta_secondary_href}
                className="inline-flex items-center gap-2 px-8 py-4 text-sm font-medium rounded-full border border-av-white/20 text-av-white hover:bg-av-white/5 transition-all"
              >
                {content.bottom_cta_secondary_label || DEFAULT_CHALLENGE.bottom_cta_secondary_label}
              </Link>
            </div>
          </div>
        </section>
        ) : null}
      </div>
    </main>
  );
}
