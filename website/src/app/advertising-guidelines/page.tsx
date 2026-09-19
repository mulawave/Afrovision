import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advertising Guidelines — AfroVision",
  description: "AfroVision Advertising Guidelines — accepted ad content, review process, targeting rules, and billing basics for advertisers.",
};

export default function AdvertisingGuidelinesPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Advertising Guidelines</h1>
          <p className="mt-2 text-xs text-av-light-orange">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="1. Purpose and Scope">
            <p>These Advertising Guidelines (&quot;Guidelines&quot;) apply to any advertiser, agency, or sponsor (&quot;Advertiser,&quot; &quot;you,&quot; or &quot;your&quot;) that submits or runs an advertising campaign (&quot;Campaign&quot;) on AfroVision Media Ltd&apos;s (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) platform (&quot;the Platform&quot;). These Guidelines supplement our{" "}
            <a href="/terms" className="text-av-orange hover:underline">Terms of Service</a>.</p>
          </Section>

          <Section title="2. Accepted Campaign Content">
            <p>All ad creative, landing pages, and offers submitted for a Campaign must comply with applicable law and these Guidelines. We do not accept Campaigns that:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Promote illegal products or services in the jurisdictions where the Campaign will run.</li>
              <li>Advertise counterfeit, replica, or unauthorised goods, or infringe any third party&apos;s intellectual property.</li>
              <li>Contain deceptive, misleading, or unsubstantiated claims, including fabricated urgency, fake endorsements, or exaggerated performance/financial claims.</li>
              <li>Contain adult, sexually explicit, or mature content, except where placed exclusively within age-gated placements approved in advance by AfroVision.</li>
              <li>Constitute political advertising (advocating for a candidate, party, or ballot measure) without the required political-ad disclosure, funding-source attribution, and any jurisdiction-specific authorisation.</li>
              <li>Promote weapons, illegal drugs, tobacco to minors, or other regulated products without proof of required licensing and age-gating.</li>
              <li>Contain malware, deceptive download prompts, or auto-redirect/clickbait techniques.</li>
              <li>Discriminate against or disparage individuals or groups on a protected basis.</li>
            </ul>
          </Section>

          <Section title="3. Ad Review and Approval Process">
            <p>All Campaigns are subject to review before going live and may be re-reviewed at any time while active:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Submitted creative, targeting parameters, and landing pages are checked against these Guidelines and applicable law.</li>
              <li>AfroVision may request supporting documentation for claims made in ad creative (e.g., certifications, licences, substantiation for performance claims).</li>
              <li>Approval times vary by Campaign complexity; standard review typically completes within three (3) business days.</li>
              <li>AfroVision may approve, reject, or request changes to a Campaign at its sole discretion, and may suspend a live Campaign pending re-review if a concern is identified.</li>
            </ul>
          </Section>

          <Section title="4. Prohibited Targeting Practices">
            <p>Advertisers may not:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Target users based on inferred sensitive categories such as health conditions, sexual orientation, religion, or immigration status.</li>
              <li>Use targeting to exclude protected groups from access to housing, employment, or credit-related offers, where such exclusion would violate anti-discrimination law.</li>
              <li>Upload or use personally identifiable customer lists for targeting without a lawful basis and appropriate consent from those individuals.</li>
              <li>Attempt to re-identify or de-anonymise AfroVision&apos;s aggregated audience data.</li>
            </ul>
          </Section>

          <Section title="5. Advertiser Data Handling">
            <p>Any data AfroVision collects or processes in connection with a Campaign (including aggregated performance analytics shared with you) is handled in accordance with our{" "}
            <a href="/privacy" className="text-av-orange hover:underline">Privacy Policy</a>. AfroVision does not share personally identifiable viewer information with Advertisers; performance reporting is provided in aggregated, anonymised form. Advertisers are responsible for their own compliance with applicable data protection law with respect to any data they collect through their own landing pages or pixels.</p>
          </Section>

          <Section title="6. Pricing and Billing">
            <p><strong className="text-av-white">6.1 Pricing Models.</strong> Campaigns may be priced on a cost-per-impression, cost-per-click, cost-per-view, flat sponsorship fee, or other model as agreed at the time of booking.</p>
            <p className="mt-2"><strong className="text-av-white">6.2 Billing.</strong> Campaigns are billed in advance, on a recurring basis, or on delivery, as specified in your advertising order or agreement. Payments are processed through AfroVision&apos;s designated payment providers.</p>
            <p className="mt-2"><strong className="text-av-white">6.3 Refunds.</strong> Fees for Campaign time or impressions already delivered are non-refundable. Where AfroVision rejects or removes a Campaign for a Guidelines violation before delivery is complete, any undelivered, pre-paid balance will be credited or refunded at AfroVision&apos;s discretion.</p>
          </Section>

          <Section title="7. Right to Reject or Remove Ads">
            <p>AfroVision reserves the right, at its sole discretion and without liability, to reject, pause, modify placement of, or remove any Campaign or creative that violates these Guidelines, applicable law, or that we reasonably believe poses reputational, legal, or safety risk to the Platform or its users, at any stage of the Campaign lifecycle.</p>
          </Section>

          <Section title="8. Changes to These Guidelines">
            <p>We may update these Guidelines from time to time to reflect new ad formats, regulatory requirements, or platform policies. Continued submission or running of Campaigns after an update constitutes acceptance of the revised Guidelines.</p>
          </Section>

          <Section title="9. Contact Us">
            <p>For advertising enquiries or to report a policy concern about a Campaign, please contact:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">Advertising Sales:</strong>{" "}<a href="mailto:ads@afrovision.online" className="text-av-orange hover:underline">ads@afrovision.online</a></li>
              <li><strong className="text-av-white">Ad Policy:</strong>{" "}<a href="mailto:adpolicy@afrovision.online" className="text-av-orange hover:underline">adpolicy@afrovision.online</a></li>
            </ul>
          </Section>
        </article>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
      <h2 className="text-base font-semibold text-av-white mb-3">{title}</h2>
      <div className="text-sm text-av-light-orange leading-relaxed">{children}</div>
    </section>
  );
}
