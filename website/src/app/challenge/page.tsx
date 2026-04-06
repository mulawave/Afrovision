import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AfroVision Challenge: Amazons — Build. Compete. Win.",
  description:
    "AfroVision Challenge: Amazons — a high-stakes entrepreneurial reality competition where Nigeria's most promising individuals are transformed into business leaders under real funding, real stakes, and national visibility.",
};

/* ── Data ──────────────────────────────────────────────────────── */

const PHASES = [
  {
    icon: "📋",
    phase: "Registration",
    subtitle: "Open Call",
    desc: "Create your verified AfroVision account and submit a 30–60 second pitch video explaining what business you would build if given ₦10,000,000. Videos are published on the Challenge page and broadcast on our official channel on a scheduled rotation.",
    status: "active",
  },
  {
    icon: "🎭",
    phase: "Audition",
    subtitle: "Screening & Selection",
    desc: "Our panel screens all submissions based on presentation quality, business viability, mental capacity, and social influence — including how many referrals you bring to engage with your pitch. The shortlist of finalists is announced publicly.",
    status: "upcoming",
  },
  {
    icon: "🎬",
    phase: "Running",
    subtitle: "Live Competition",
    desc: "Shortlisted finalists enter the main competition. Activities are broadcast live on AfroVision's official public and private channels. Contestants build, defend, and prove their business ideas under real-world pressure.",
    status: "upcoming",
  },
  {
    icon: "🏆",
    phase: "Completed",
    subtitle: "Cooling Off & Launch",
    desc: "Winners are rewarded, their businesses are launched, and we actively support their growth for 6 months. Their journey and achievements are showcased on the Challenge page and broadcast channels.",
    status: "upcoming",
  },
];

const SHOW_PHASES = [
  { ep: "Ep 1–2", title: "Selection & Assignment", desc: "Contestants introduced. Business ideas assigned via randomizer. First impressions and emotional reactions captured." },
  { ep: "Ep 3–5", title: "Immersion & Foundation", desc: "24-hour crash learning. First business masterclass. Team simulations and mini challenges." },
  { ep: "Ep 6–8", title: "Build & Strategize", desc: "Business model development. Financial projections. Branding, positioning, and mentor critiques." },
  { ep: "Ep 9–10", title: "The Pitch", desc: "Formal pitch to judges panel. Real-time questioning and pressure testing of every idea." },
  { ep: "Ep 11", title: "AI Reality Simulation", desc: "Each business is stress-tested through AfroVision's AI Engine — survival probability, profit trajectory, and risk exposure revealed." },
  { ep: "Ep 12", title: "Elimination & Elevation", desc: "Top 5 selected. Others exit with cash rewards, brand deals, investor interest, and national exposure." },
  { ep: "Final", title: "The Merge", desc: "The legendary twist — top 5 must abandon individual dreams and build ONE company together using the strongest idea. Real company. Real seed funding. Real execution." },
];

const PRIZES_DATA = [
  { icon: "👑", place: "Grand Winner", amount: "₦10,000,000", desc: "Seed funding for real company launch + national visibility + premium business mentorship" },
  { icon: "🥈", place: "Runner Up", amount: "₦3,000,000", desc: "Business incubation support + brand deals + AfroVision premium creator status" },
  { icon: "🥉", place: "3rd Place", amount: "₦1,500,000", desc: "Startup grant + 1 year premium + investor introductions" },
  { icon: "🌟", place: "Top 5 Merge Pool", amount: "Funded Company", desc: "Top 5 finalists unite to build ONE real company with full seed funding and support" },
  { icon: "💡", place: "All Eliminated", amount: "Cash + Exposure", desc: "Cash rewards, brand deals, investor interest, and national exposure — even losers win" },
];

const WHAT_MAKES_IT = [
  { icon: "🎲", title: "Randomized Destiny", desc: "Nobody comes with a pre-built idea. Business concepts are assigned randomly — levelling the playing field." },
  { icon: "💰", title: "Real Stakes", desc: "₦10M simulation-backed funding per pitch. This is not theory — this is real-world business creation under fire." },
  { icon: "🧠", title: "AI Simulation Engine", desc: "Businesses are stress-tested over 3 simulated years. Survival probability, profit trajectory, and risk exposure — all revealed." },
  { icon: "⚔️", title: "Elimination with Opportunity", desc: "Even eliminated contestants win — cash rewards, brand deals, investor connections, and national exposure." },
  { icon: "👑", title: "The Merge Twist", desc: "Top 5 must abandon individual dreams and unite to build ONE real company. The ultimate test of collaboration vs ego." },
  { icon: "📺", title: "Platform Integration", desc: "Viewers watch inside AfroVision. Follow contestants, join discussions, access business lessons, and eventually invest via tokenized micro-investments." },
];

const THEMES = [
  { icon: "💪", label: "Female Strength" },
  { icon: "💸", label: "Economic Independence" },
  { icon: "👩‍💼", label: "Leadership Under Pressure" },
  { icon: "🤝", label: "Collaboration vs Ego" },
  { icon: "🌍", label: "African Excellence" },
  { icon: "🏢", label: "Real Business Creation" },
];

const FAQS = [
  { q: "How do I join the Challenge?", a: "Create an AfroVision account, verify your email, then visit the Challenge page while logged in. You'll see the registration form where you submit your 30–60 second pitch video." },
  { q: "What is the pitch video requirement?", a: "Record a 30 to 60 second video explaining what kind of business you would build if given ₦10,000,000. The video is published on the Challenge page and broadcast on our official channel." },
  { q: "Do I need a specific background or qualification?", a: "No. The Challenge is open to all Nigerians 18+. Business ideas are assigned randomly — what matters is how you think, adapt, and execute under pressure." },
  { q: "What happens after registration closes?", a: "During the Audition phase, our panel screens submissions based on presentation quality, business viability, mental capacity, and social influence (referrals). Finalists are announced publicly." },
  { q: "What is The Merge?", a: "The show's signature twist. The top 5 finalists must abandon their individual business concepts and unite to build ONE real company together using the strongest idea from the group." },
  { q: "Do eliminated contestants get anything?", a: "Absolutely. Every eliminated contestant leaves with cash rewards, brand deal opportunities, investor interest, and national exposure. On this show, even losing is winning." },
  { q: "When is Pitch 1: Amazons?", a: "Season dates will be announced once registration opens. Follow AfroVision's official channels and turn on notifications to stay updated." },
  { q: "Is KYC verification required?", a: "Yes. Winners must complete identity verification (KYC) before prize disbursement. We recommend completing KYC early in your account settings." },
];

/* ── Page ──────────────────────────────────────────────────────── */

export default function ChallengePage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        {/* ── Hero ──────────────────────────────────────────── */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-av-orange/15 border border-av-orange/30 text-xs font-bold uppercase tracking-[0.15em] text-av-orange mb-6">
            <span>🏆</span>
            <span>Pitch 1 — Amazons</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">
            <span className="text-av-white">AfroVision </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-av-orange to-av-light-orange">
              Challenge
            </span>
          </h1>

          <p className="text-lg lg:text-xl text-av-white/80 leading-relaxed max-w-3xl mx-auto mb-4">
            A high-stakes entrepreneurial reality competition where Nigeria&apos;s most promising
            individuals are transformed into <strong className="text-av-orange">business leaders</strong> under
            intense pressure, real funding conditions, and national visibility.
          </p>
          <p className="text-sm text-av-hint max-w-2xl mx-auto mb-10">
            This is not theory. This is not classroom learning. This is real-world business creation under fire.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-10 mb-12">
            {[
              { value: "₦10M+", label: "Prize Pool" },
              { value: "14–15", label: "Contestants" },
              { value: "12+", label: "Episodes" },
              { value: "Free", label: "Entry" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl lg:text-4xl font-extrabold text-av-orange">{s.value}</p>
                <p className="text-[10px] uppercase tracking-[0.15em] text-av-hint font-semibold mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-xl hover:shadow-av-orange/30 hover:scale-105 active:scale-95"
            >
              🚀 Create Account to Join
            </Link>
            <Link
              href="/challenge/rules"
              className="inline-flex items-center gap-2 px-8 py-4 text-sm font-medium rounded-full border border-av-white/20 text-av-white hover:bg-av-white/5 transition-all"
            >
              View Full Rules →
            </Link>
          </div>
        </div>

        {/* ── Season Branding ──────────────────────────────── */}
        <section className="mb-20">
          <div className="rounded-3xl bg-gradient-to-br from-av-orange/10 via-av-card to-purple-900/10 border border-av-orange/20 p-8 lg:p-12 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-av-light-orange font-bold mb-3">Season Identity</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-av-white mb-4">
              &ldquo;Amazons&rdquo;
            </h2>
            <p className="text-sm text-av-white/70 max-w-2xl mx-auto mb-8">
              This isn&apos;t just a name — it&apos;s branding gold. Core themes of female strength, economic independence,
              leadership under pressure, and collaboration. Earth tones + gold accents. Strong African cultural aesthetics. Minimal glam, maximum authority.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {THEMES.map((t) => (
                <div
                  key={t.label}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-av-dark-blue/60 border border-av-input-border/40 text-xs font-semibold text-av-white/80"
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Challenge Lifecycle ──────────────────────────── */}
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">Challenge Lifecycle</h2>
          <p className="text-sm text-av-hint text-center mb-8">Each challenge progresses through four distinct phases</p>
          <div className="grid md:grid-cols-2 gap-5">
            {PHASES.map((p, i) => (
              <div
                key={p.phase}
                className={`relative rounded-2xl bg-av-card border p-6 transition-all hover:shadow-lg hover:shadow-av-orange/5 ${
                  p.status === "active"
                    ? "border-av-orange/50 shadow-lg shadow-av-orange/10"
                    : "border-av-input-border/30 hover:border-av-orange/30"
                }`}
              >
                {p.status === "active" && (
                  <div className="absolute -top-2.5 right-4 px-3 py-0.5 rounded-full bg-av-orange text-[10px] font-bold text-av-dark-blue uppercase tracking-wider">
                    Current Phase
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-av-orange/15 border border-av-orange/30 flex items-center justify-center text-xl">
                    {p.icon}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-widest text-av-orange font-bold">Phase {i + 1}</span>
                    </div>
                    <h3 className="text-base font-bold text-av-white mb-0.5">{p.phase}</h3>
                    <p className="text-xs text-av-light-orange font-medium mb-2">{p.subtitle}</p>
                    <p className="text-xs text-av-hint leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── What Makes It Addictive ─────────────────────── */}
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">What Makes It Unstoppable</h2>
          <p className="text-sm text-av-hint text-center mb-8">No other African show is doing this</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHAT_MAKES_IT.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 transition-all hover:border-av-orange/30 hover:shadow-lg hover:shadow-av-orange/5"
              >
                <span className="text-3xl block mb-3">{item.icon}</span>
                <h3 className="text-sm font-bold text-av-white mb-2">{item.title}</h3>
                <p className="text-xs text-av-hint leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Show Structure ──────────────────────────────── */}
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">Show Structure</h2>
          <p className="text-sm text-av-hint text-center mb-8">How the season unfolds across 12+ episodes</p>
          <div className="space-y-4">
            {SHOW_PHASES.map((sp, i) => (
              <div
                key={sp.title}
                className="flex gap-4 items-start rounded-2xl bg-av-card border border-av-input-border/30 p-5 transition-all hover:border-av-orange/30"
              >
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-av-orange/15 border border-av-orange/30 flex items-center justify-center text-sm font-bold text-av-orange">
                    {i + 1}
                  </div>
                  <p className="text-[9px] text-av-orange font-bold mt-1 uppercase tracking-wide">{sp.ep}</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-av-white mb-1">{sp.title}</h3>
                  <p className="text-xs text-av-hint leading-relaxed">{sp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Prizes ─────────────────────────────────────── */}
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">Prizes &amp; Rewards</h2>
          <p className="text-sm text-av-hint text-center mb-8">On this show, even losing is winning</p>
          <div className="space-y-4">
            {PRIZES_DATA.map((p) => (
              <div
                key={p.place}
                className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 transition-all hover:border-av-orange/30"
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl flex-shrink-0">{p.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                      <h3 className="text-sm font-bold text-av-white">{p.place}</h3>
                      <span className="text-lg font-extrabold text-av-orange">{p.amount}</span>
                    </div>
                    <p className="text-xs text-av-hint">{p.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How To Join ────────────────────────────────── */}
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">How To Join</h2>
          <p className="text-sm text-av-hint text-center mb-8">Four simple steps to enter the competition</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { step: "1", title: "Register", desc: "Create your AfroVision account and verify your email address." },
              { step: "2", title: "Record", desc: "Film a 30–60 second video pitching your business idea for ₦10M." },
              { step: "3", title: "Submit", desc: "Upload your pitch video on the Challenge registration page (account required)." },
              { step: "4", title: "Engage", desc: "Share your pitch, refer friends, and build engagement to boost your chances." },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 text-center transition-all hover:border-av-orange/30"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-lg font-extrabold text-av-dark-blue mb-4">
                  {s.step}
                </div>
                <h3 className="text-sm font-bold text-av-white mb-2">{s.title}</h3>
                <p className="text-xs text-av-hint">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Platform Vision ────────────────────────────── */}
        <section className="mb-20">
          <div className="rounded-3xl bg-gradient-to-br from-purple-900/20 via-av-card to-av-orange/5 border border-av-input-border/30 p-8 lg:p-12">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-[0.2em] text-av-light-orange font-bold mb-2">Platform Integration</p>
              <h2 className="text-2xl font-bold text-av-white mb-3">More Than A Show</h2>
              <p className="text-sm text-av-hint max-w-2xl mx-auto">
                AfroVision Challenge quietly integrates the entire platform ecosystem — turning AfroVision into
                <strong className="text-av-white"> Netflix + Shark Tank + LinkedIn + Startup Incubator</strong>, all in one.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: "📺", title: "Watch Inside App", desc: "All episodes stream exclusively on AfroVision" },
                { icon: "👤", title: "Follow Contestants", desc: "Support your favorites with reactions and gifts" },
                { icon: "💬", title: "Join Discussions", desc: "Real-time chat per episode in official channels" },
                { icon: "📚", title: "Learn Business", desc: "Access curated business lessons from each episode" },
              ].map((f) => (
                <div key={f.title} className="rounded-xl bg-av-dark-blue/50 border border-av-input-border/20 p-5 text-center">
                  <span className="text-2xl block mb-2">{f.icon}</span>
                  <h3 className="text-xs font-bold text-av-white mb-1">{f.title}</h3>
                  <p className="text-[11px] text-av-hint">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────── */}
        <section className="mb-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-2 text-center">Frequently Asked Questions</h2>
          <p className="text-sm text-av-hint text-center mb-8">Everything you need to know</p>
          <div className="space-y-4 max-w-3xl mx-auto">
            {FAQS.map((f) => (
              <div
                key={f.q}
                className="rounded-2xl bg-av-card border border-av-input-border/30 p-5"
              >
                <h3 className="text-sm font-semibold text-av-white mb-2">{f.q}</h3>
                <p className="text-xs text-av-hint leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ─────────────────────────────────── */}
        <section>
          <div className="rounded-3xl bg-gradient-to-br from-av-orange/10 via-av-card to-purple-900/10 border border-av-orange/20 p-10 lg:p-14 text-center">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-av-white mb-4">
              Ready to Build Your Empire?
            </h2>
            <p className="text-sm text-av-white/70 max-w-xl mx-auto mb-8">
              The stage is set. Real funding. Real pressure. Real results.
              Create your account and submit your pitch when registration opens.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-10 py-4 text-sm font-bold rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-xl hover:shadow-av-orange/30 hover:scale-105 active:scale-95"
              >
                🚀 Create Account Now
              </Link>
              <Link
                href="/challenge/rules"
                className="inline-flex items-center gap-2 px-8 py-4 text-sm font-medium rounded-full border border-av-white/20 text-av-white hover:bg-av-white/5 transition-all"
              >
                Read Full Rules →
              </Link>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
