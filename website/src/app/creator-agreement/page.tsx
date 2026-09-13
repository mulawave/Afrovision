import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Agreement — AfroVision",
  description: "AfroVision Creator Agreement — eligibility, content licensing, revenue share, payouts, and creator obligations.",
};

export default function CreatorAgreementPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Creator Agreement</h1>
          <p className="mt-2 text-xs text-av-light-orange">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="1. Acceptance and Scope">
            <p>This Creator Agreement (&quot;Agreement&quot;) is entered into between you (&quot;Creator,&quot; &quot;you,&quot; or &quot;your&quot;) and AfroVision Media Ltd (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) when you enable creator features on the AfroVision platform (&quot;the Platform&quot;). This Agreement supplements, and does not replace, our{" "}
            <a href="/terms" className="text-av-orange hover:underline">Terms of Service</a>. By enabling creator features, uploading content, or receiving payouts on the Platform, you agree to this Agreement.</p>
          </Section>

          <Section title="2. Eligibility">
            <p>To become a Creator, you must:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Be at least 18 years old, or the age of majority in your jurisdiction, whichever is higher.</li>
              <li>Hold a valid, verified AfroVision account in good standing.</li>
              <li>Complete any identity verification (KYC) required for monetisation or payouts.</li>
              <li>Not be subject to a current suspension, ban, or unresolved policy violation on the Platform.</li>
              <li>Comply with all applicable laws in your jurisdiction relating to content creation, taxation, and online commerce.</li>
            </ul>
          </Section>

          <Section title="3. Content Ownership and License Grant">
            <p><strong className="text-av-white">3.1 Ownership.</strong> You retain ownership of the content you create and upload (&quot;Creator Content&quot;), subject to the licence granted below and any rights of featured third parties.</p>
            <p className="mt-2"><strong className="text-av-white">3.2 License to AfroVision.</strong> By uploading or streaming Creator Content, you grant AfroVision a worldwide, non-exclusive, royalty-free, sublicensable, and transferable licence to host, reproduce, distribute, transmit, publicly perform and display, and create technical copies (e.g., transcodes, thumbnails, clips) of your Creator Content solely for the purpose of operating, promoting, securing, and improving the Platform, including making it available to viewers and, where applicable, sponsors or partners as described in the Terms of Service.</p>
            <p className="mt-2"><strong className="text-av-white">3.3 Survival.</strong> This licence continues for content already distributed to viewers (e.g., clips shared or cached) even after you delete the content or close your account, to the extent necessary to give effect to distributions that already occurred.</p>
          </Section>

          <Section title="4. Intellectual Property Warranties">
            <p>You represent and warrant that:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>You own, or hold all necessary rights, licences, consents, and clearances to use and upload, your Creator Content.</li>
              <li>Your Creator Content does not infringe the copyright, trademark, publicity, privacy, or other rights of any third party.</li>
              <li>You have obtained appropriate consent from any identifiable individuals featured in your Creator Content, where required.</li>
              <li>Your use of any music, footage, branding, or other third-party material is properly licensed.</li>
            </ul>
            <p className="mt-2">You agree to indemnify AfroVision against any claims, damages, or costs arising from a breach of these warranties.</p>
          </Section>

          <Section title="5. Revenue Share and vPT Token Economy">
            <p>AfroVision operates a virtual token (vPT) economy through which viewers can support Creators (e.g., gifting, tipping, paid subscriptions to Exclusive Channels). Revenue share terms are as follows:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>AfroVision publishes the applicable Creator revenue share percentage and vPT conversion rate in your Creator dashboard, which may vary by monetisation feature (e.g., gifting vs. exclusive membership).</li>
              <li>AfroVision retains a platform fee from gross revenue generated through Creator monetisation features before Creator earnings are calculated.</li>
              <li>Revenue share percentages and vPT conversion rates may be updated from time to time, with reasonable advance notice for material reductions.</li>
              <li>vPT tokens themselves are not legal tender, securities, or cryptocurrency, as described in the Terms of Service.</li>
            </ul>
          </Section>

          <Section title="6. Payout Schedule and Minimum Thresholds">
            <p>Payouts of convertible earnings are subject to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Completion of identity verification (KYC) before any payout request is processed.</li>
              <li>A minimum payout threshold, published in your Creator dashboard, below which funds carry over to the next payout cycle.</li>
              <li>A standard payout processing window (typically within thirty (30) days of a successful request), subject to delays caused by payment providers, banking partners, or compliance review.</li>
              <li>Applicable withholding, fraud, or compliance holds where AfroVision reasonably suspects irregular activity.</li>
            </ul>
          </Section>

          <Section title="7. Tax Responsibility">
            <p>You are solely responsible for determining and satisfying any tax obligations (including income tax, VAT, or equivalent) arising from your earnings on the Platform. AfroVision does not act as your employer, agent, or tax advisor, and Creators operate as independent parties in relation to AfroVision. Where required by law, AfroVision may issue tax reporting documentation and withhold amounts for remittance to tax authorities.</p>
          </Section>

          <Section title="8. Content Standards">
            <p>All Creator Content must comply with our{" "}
            <a href="/community-rules" className="text-av-orange hover:underline">Community Rules</a> and Terms of Service. This includes prohibitions on illegal content, hate speech, harassment, child sexual abuse material, and non-consensual intimate imagery. Repeated or severe violations may result in demonetisation, suspension of creator features, or termination of this Agreement in accordance with the enforcement ladder described in the Community Rules.</p>
          </Section>

          <Section title="9. Account Suspension and Termination">
            <p><strong className="text-av-white">9.1 By AfroVision.</strong> We may suspend or terminate your creator features or this Agreement if you violate this Agreement, the Terms of Service, or the Community Rules, or where required by law. Where feasible, we will provide notice of the reason and an opportunity to respond before permanent termination, except in cases of severe violations.</p>
            <p className="mt-2"><strong className="text-av-white">9.2 By You.</strong> You may stop using creator features or close your account at any time. Outstanding earnings owed to you above the minimum payout threshold will be paid out in accordance with Section 6, subject to any pending compliance review.</p>
            <p className="mt-2"><strong className="text-av-white">9.3 Effect.</strong> Upon termination, the licence granted in Section 3 survives to the extent necessary to give effect to content already distributed, and any unresolved financial obligations between you and AfroVision remain enforceable.</p>
          </Section>

          <Section title="10. Term">
            <p>This Agreement takes effect when you enable creator features and continues until terminated by either party in accordance with Section 9.</p>
          </Section>

          <Section title="11. Changes to This Agreement">
            <p>We may update this Agreement from time to time. Material changes will be notified via email or your Creator dashboard at least fourteen (14) days before taking effect. Continuing to use creator features after that date constitutes acceptance of the revised Agreement.</p>
          </Section>

          <Section title="12. Contact Us">
            <p>If you have questions about this Creator Agreement, please contact:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">Creator Support:</strong>{" "}<a href="mailto:creators@afrovision.online" className="text-av-orange hover:underline">creators@afrovision.online</a></li>
              <li><strong className="text-av-white">Payouts:</strong>{" "}<a href="mailto:payouts@afrovision.online" className="text-av-orange hover:underline">payouts@afrovision.online</a></li>
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
