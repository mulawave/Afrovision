import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — AfroVision",
  description: "AfroVision Terms of Service — the rules and guidelines for using our platform.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Terms of Service</h1>
          <p className="mt-2 text-xs text-av-hint">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="prose-av space-y-8">
          <Section title="1. Acceptance of Terms">
            By accessing, browsing, or using AfroVision (&quot;the Platform&quot;), operated by AfroVision Media Ltd (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service (&quot;Terms&quot;), our{" "}
            <a href="/privacy" className="text-av-orange hover:underline">Privacy Policy</a>,{" "}
            <a href="/cookies" className="text-av-orange hover:underline">Cookie Policy</a>,{" "}
            <a href="/aml" className="text-av-orange hover:underline">Anti-Money Laundering Policy</a>,{" "}
            <a href="/refund" className="text-av-orange hover:underline">Refund Policy</a>, and{" "}
            <a href="/copyright" className="text-av-orange hover:underline">Copyright Infringement Policy</a>. If you do not agree to these Terms, you must not access or use the Platform.
          </Section>

          <Section title="2. Eligibility">
            <p>You must be at least 18 years old, or the age of majority in your jurisdiction, whichever is higher, to create an account and use AfroVision. By registering, you represent and warrant that:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>You meet the minimum age requirement.</li>
              <li>You have the legal capacity to enter into a binding agreement.</li>
              <li>You are not barred from using the Platform under any applicable law.</li>
              <li>The information you provide during registration is accurate and complete.</li>
            </ul>
          </Section>

          <Section title="3. Account Registration and Security">
            <p>When you create an account, you agree to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide accurate, current, and complete registration information.</li>
              <li>Maintain the security and confidentiality of your login credentials.</li>
              <li>Accept responsibility for all activities that occur under your account.</li>
              <li>Notify us immediately at <a href="mailto:security@afrovision.tv" className="text-av-orange hover:underline">security@afrovision.tv</a> if you suspect unauthorised access.</li>
              <li>Not share, transfer, or sell your account to any other person.</li>
            </ul>
            <p className="mt-2">We reserve the right to suspend or disable accounts that we reasonably believe have been compromised or are being used in violation of these Terms.</p>
          </Section>

          <Section title="4. User Content and Conduct">
            <p><strong className="text-av-white">4.1 Ownership.</strong> You retain all ownership rights in the content you create and upload to AfroVision (&quot;User Content&quot;).</p>
            <p className="mt-2"><strong className="text-av-white">4.2 License Grant.</strong> By posting User Content, you grant AfroVision a worldwide, non-exclusive, royalty-free, sublicensable, and transferable license to use, reproduce, distribute, display, stream, and perform your User Content solely in connection with operating, promoting, and improving the Platform.</p>
            <p className="mt-2"><strong className="text-av-white">4.3 Prohibited Content.</strong> You agree not to upload, stream, or distribute content that:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Infringes any copyright, trademark, or other intellectual property right.</li>
              <li>Is defamatory, obscene, pornographic, violent, or promotes hatred or discrimination.</li>
              <li>Contains malware, viruses, or any harmful code.</li>
              <li>Promotes illegal activities, fraud, or financial scams.</li>
              <li>Impersonates another person or entity.</li>
              <li>Violates any applicable local, national, or international law.</li>
            </ul>
            <p className="mt-2"><strong className="text-av-white">4.4 Enforcement.</strong> We may remove or restrict access to any User Content that violates these Terms without prior notice.</p>
          </Section>

          <Section title="5. Virtual Tokens (vPT)">
            <p>vPT tokens are digital reward units issued and managed exclusively within the AfroVision Platform. They are <strong className="text-av-white">not</strong> legal tender, securities, cryptocurrencies, or investment instruments.</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>vPT may be earned through platform activities such as watching, engaging, and creating content.</li>
              <li>vPT may be spent or converted within the Platform according to rules published in your wallet dashboard.</li>
              <li>AfroVision reserves the right to modify vPT conversion rates, earning rules, and redemption options at any time with reasonable notice.</li>
              <li>vPT balances are non-transferable between users except through Platform-sanctioned mechanisms (e.g., gifting).</li>
              <li>Accumulated vPT carry no guaranteed monetary value outside the Platform.</li>
            </ul>
          </Section>

          <Section title="6. Payments, Subscriptions, and Withdrawals">
            <p><strong className="text-av-white">6.1 Subscriptions.</strong> Certain features require a paid subscription. Subscription terms, pricing, and billing cycles are displayed at the time of purchase. All prices are in the currency shown at checkout.</p>
            <p className="mt-2"><strong className="text-av-white">6.2 Payment Processing.</strong> Payments are processed by third-party payment providers. AfroVision does not store your full payment card details. By making a payment, you agree to the payment provider&apos;s terms of service.</p>
            <p className="mt-2"><strong className="text-av-white">6.3 Withdrawals.</strong> Withdrawal requests for earnings or vPT conversions are subject to identity verification, minimum thresholds, and processing timelines. AfroVision is not liable for delays caused by third-party payment providers, banking institutions, or regulatory compliance procedures.</p>
            <p className="mt-2"><strong className="text-av-white">6.4 Refunds.</strong> Refund eligibility is governed by our <a href="/refund" className="text-av-orange hover:underline">Refund Policy</a>.</p>
          </Section>

          <Section title="7. Data Sharing with Sponsors and Partners">
            <p>AfroVision may share aggregated, anonymised data and statistics with sponsors, advertising partners, and business collaborators for the purposes of analytics, reporting, and service improvement. This data may include:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Aggregate viewership and engagement metrics.</li>
              <li>Platform usage trends and demographic summaries.</li>
              <li>Content performance and category analytics.</li>
              <li>Campaign reach and conversion statistics.</li>
            </ul>
            <p className="mt-3"><strong className="text-av-white">We will never share, sell, or disclose any personally identifiable information (PII) — including names, email addresses, phone numbers, IP addresses, or payment details — with sponsors or partners.</strong> All shared data is aggregated and anonymised so that no individual user can be identified.</p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>The AfroVision name, logo, trademarks, design elements, source code, and all proprietary content are the exclusive property of AfroVision Media Ltd and are protected by applicable intellectual property laws. You may not reproduce, distribute, modify, or create derivative works from any Platform materials without our prior written consent.</p>
          </Section>

          <Section title="9. Third-Party Services and Links">
            <p>The Platform may contain links to or integrations with third-party websites and services. AfroVision does not endorse, control, or assume responsibility for any third-party content, products, or services. Your use of third-party services is at your own risk and subject to their respective terms.</p>
          </Section>

          <Section title="10. Prohibited Activities">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Use bots, scrapers, or automated tools to access the Platform.</li>
              <li>Circumvent any security, rate-limiting, or access control measures.</li>
              <li>Engage in fraudulent activities, including artificial inflation of views, follows, or earnings.</li>
              <li>Attempt to reverse-engineer, decompile, or disassemble any Platform technology.</li>
              <li>Use the Platform for money laundering, terrorist financing, or any illegal purpose.</li>
              <li>Harass, threaten, or bully other users.</li>
              <li>Create multiple accounts for the purpose of circumventing bans or gaining unfair advantages.</li>
            </ul>
          </Section>

          <Section title="11. Suspension and Termination">
            <p><strong className="text-av-white">11.1 By AfroVision.</strong> We may suspend, restrict, or permanently terminate your account if you violate these Terms, engage in conduct harmful to the Platform or its community, or as required by law. Where possible, we will provide notice and an opportunity to cure the violation before termination.</p>
            <p className="mt-2"><strong className="text-av-white">11.2 By You.</strong> You may close your account at any time by contacting <a href="mailto:support@afrovision.tv" className="text-av-orange hover:underline">support@afrovision.tv</a>. Account closure does not automatically entitle you to a refund of any paid subscription fees.</p>
            <p className="mt-2"><strong className="text-av-white">11.3 Effect of Termination.</strong> Upon termination, your license to use the Platform ceases immediately. We may retain data as required by law or for legitimate business purposes, subject to our Privacy Policy.</p>
          </Section>

          <Section title="12. Disclaimers">
            <p>The Platform is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express, implied, or statutory, including but not limited to warranties of merchantability, fitness for a particular purpose, title, and non-infringement. AfroVision does not warrant that the Platform will be uninterrupted, secure, or error-free.</p>
          </Section>

          <Section title="13. Limitation of Liability">
            <p>To the maximum extent permitted by applicable law, AfroVision, its directors, officers, employees, agents, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising out of or in connection with your use of or inability to use the Platform, even if advised of the possibility of such damages.</p>
            <p className="mt-2">Our total aggregate liability for all claims arising under these Terms shall not exceed the greater of (a) the amounts you paid to AfroVision in the twelve (12) months preceding the claim, or (b) one hundred US dollars ($100).</p>
          </Section>

          <Section title="14. Indemnification">
            <p>You agree to indemnify, defend, and hold harmless AfroVision and its officers, directors, employees, and agents from and against any claims, damages, liabilities, costs, and expenses (including reasonable legal fees) arising from your violation of these Terms, your User Content, or your use of the Platform.</p>
          </Section>

          <Section title="15. Dispute Resolution">
            <p>Any disputes arising from these Terms or your use of the Platform shall first be resolved through good-faith negotiation. If the dispute cannot be resolved within thirty (30) days, it shall be submitted to binding arbitration in accordance with the applicable arbitration rules in the jurisdiction where AfroVision is incorporated. You agree to waive any right to participate in a class action lawsuit or class-wide arbitration.</p>
          </Section>

          <Section title="16. Governing Law">
            <p>These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to conflict of law principles. You consent to the exclusive jurisdiction of the courts in Lagos, Nigeria for any legal action arising from these Terms.</p>
          </Section>

          <Section title="17. Changes to These Terms">
            <p>We may update these Terms from time to time. Material changes will be notified via email or a prominent notice on the Platform at least fourteen (14) days before they take effect. Your continued use of the Platform after the effective date constitutes acceptance of the revised Terms. If you do not agree, you should stop using the Platform and close your account.</p>
          </Section>

          <Section title="18. Severability">
            <p>If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will remain in full force and effect.</p>
          </Section>

          <Section title="19. Entire Agreement">
            <p>These Terms, together with our Privacy Policy, Cookie Policy, Anti-Money Laundering Policy, Refund Policy, and Copyright Infringement Policy, constitute the entire agreement between you and AfroVision regarding your use of the Platform and supersede all prior agreements and understandings.</p>
          </Section>

          <Section title="20. Contact Us">
            <p>If you have questions, concerns, or feedback about these Terms, please contact us:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">General Legal:</strong>{" "}<a href="mailto:legal@afrovision.tv" className="text-av-orange hover:underline">legal@afrovision.tv</a></li>
              <li><strong className="text-av-white">Support:</strong>{" "}<a href="mailto:support@afrovision.tv" className="text-av-orange hover:underline">support@afrovision.tv</a></li>
              <li><strong className="text-av-white">Privacy Enquiries:</strong>{" "}<a href="mailto:privacy@afrovision.tv" className="text-av-orange hover:underline">privacy@afrovision.tv</a></li>
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
      <div className="text-sm text-av-hint leading-relaxed">{children}</div>
    </section>
  );
}
