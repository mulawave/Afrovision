import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Challenge Rules & Prizes — AfroVision",
  description:
    "Official rules, eligibility requirements, and prize breakdown for the AfroVision Challenge.",
};

export default function ChallengeRulesPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Challenge</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Rules &amp; Prizes</h1>
          <p className="mt-2 text-xs text-av-hint">Season 1 — Updated April 5, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="Eligibility">
            <ul className="list-disc list-inside space-y-1">
              <li>You must be at least 18 years old.</li>
              <li>You must reside in any African country.</li>
              <li>You must have a verified AfroVision account with a valid email.</li>
              <li>You must agree to AfroVision&apos;s <a href="/terms" className="text-av-orange underline">Terms of Service</a> and this set of rules.</li>
              <li>AfroVision employees, contractors, and their immediate family members are not eligible.</li>
            </ul>
          </Section>

          <Section title="Entry Process">
            <ol className="list-decimal list-inside space-y-1">
              <li>Create an AfroVision account or log in to your existing account.</li>
              <li>Set up a channel if you don&apos;t have one already.</li>
              <li>Navigate to the Challenge page and click &quot;Register for Challenge.&quot;</li>
              <li>Select up to two (2) categories.</li>
              <li>Confirm your registration — no entry fee is required.</li>
            </ol>
          </Section>

          <Section title="Streaming Requirements">
            <ul className="list-disc list-inside space-y-1">
              <li>All streams must be original content — no restreaming copyrighted material.</li>
              <li>Each qualifying stream must be at least 30 minutes long.</li>
              <li>Contestants must complete a minimum of 4 qualifying streams during the qualifying period.</li>
              <li>Streams must adhere to AfroVision&apos;s Community Guidelines at all times.</li>
              <li>Hate speech, nudity, graphic violence, or illegal activity results in immediate disqualification.</li>
            </ul>
          </Section>

          <Section title="Scoring Criteria">
            <div className="space-y-3">
              <p>Contestants are evaluated on a combined score:</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-av-dark-blue/50 border border-av-input-border/20 p-4">
                  <p className="text-2xl font-extrabold text-av-orange mb-1">60%</p>
                  <p className="text-xs font-semibold text-av-white mb-1">Engagement Metrics</p>
                  <p className="text-xs text-av-hint">Peak viewers, chat activity, reactions, gifts received, follower growth during competition.</p>
                </div>
                <div className="rounded-xl bg-av-dark-blue/50 border border-av-input-border/20 p-4">
                  <p className="text-2xl font-extrabold text-av-orange mb-1">40%</p>
                  <p className="text-xs font-semibold text-av-white mb-1">Judge Panel</p>
                  <p className="text-xs text-av-hint">Content quality, creativity, production value, audience connection, and consistency.</p>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Prize Breakdown">
            <div className="space-y-3">
              {[
                { place: "1st Place", amount: "₦2,000,000", extras: ["Verified creator badge", "1-year AfroVision Premium", "Brand partnership opportunities", "Featured on homepage for 30 days"] },
                { place: "2nd Place", amount: "₦1,500,000", extras: ["Verified creator badge", "6-month AfroVision Premium", "Featured spotlight"] },
                { place: "3rd Place", amount: "₦1,000,000", extras: ["Verified creator badge", "3-month AfroVision Premium"] },
                { place: "4th–10th Place", amount: "₦50,000 each", extras: ["3-month AfroVision Premium subscription"] },
              ].map((p) => (
                <div key={p.place} className="rounded-xl bg-av-dark-blue/50 border border-av-input-border/20 p-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs uppercase tracking-widest text-av-light-orange font-bold">{p.place}</span>
                    <span className="text-lg font-extrabold text-av-orange">{p.amount}</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-av-hint">
                    {p.extras.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Disqualification">
            <p>AfroVision reserves the right to disqualify any contestant who:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Violates the Terms of Service or Community Guidelines.</li>
              <li>Uses bots, fake accounts, or manipulated engagement.</li>
              <li>Streams copyrighted content without authorization.</li>
              <li>Engages in harassment, hate speech, or illegal activity.</li>
              <li>Submits false information during registration or KYC verification.</li>
            </ul>
          </Section>

          <Section title="Prize Disbursement">
            <ul className="list-disc list-inside space-y-1">
              <li>Winners will be announced during the Awards ceremony on June 21, 2026.</li>
              <li>Winners must complete KYC identity verification within 7 days of winning.</li>
              <li>Prizes are disbursed via bank transfer within 14 business days of KYC completion.</li>
              <li>Winners are responsible for all applicable taxes in their jurisdiction.</li>
              <li>Prizes are non-transferable and cannot be exchanged for vPT tokens.</li>
            </ul>
          </Section>

          <Section title="Intellectual Property">
            <p>Contestants retain full ownership of their content. By participating, you grant AfroVision a non-exclusive, royalty-free licence to use clips from your qualifying streams for promotional purposes (social media highlights, platform marketing, recap content) for a period of 12 months following the competition.</p>
          </Section>

          <Section title="Dispute Resolution">
            <p>Any disputes regarding scoring, disqualification, or prize disbursement will be resolved by AfroVision&apos;s Challenge Review Committee. Decisions made by the Committee are final and binding. Contestants may submit a written appeal within 7 days of the disputed decision.</p>
          </Section>

          <Section title="Amendments">
            <p>AfroVision reserves the right to modify these rules at any time. Changes will be communicated via email and in-app notification at least 7 days before they take effect. Continued participation after notification constitutes acceptance of the updated rules.</p>
          </Section>
        </article>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
      <h2 className="text-lg font-bold text-av-white mb-3">{title}</h2>
      <div className="text-sm text-av-hint leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
