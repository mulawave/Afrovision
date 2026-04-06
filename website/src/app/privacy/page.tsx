import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — AfroVision",
  description: "AfroVision Privacy Policy — how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Privacy Policy</h1>
          <p className="mt-2 text-xs text-av-hint">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="1. Introduction">
            AfroVision Media Ltd (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, share, and protect your personal information when you use the AfroVision platform, website, and related services (collectively, &quot;the Platform&quot;). By using the Platform, you consent to the practices described in this policy.
          </Section>

          <Section title="2. Information We Collect">
            <p><strong className="text-av-white">2.1 Information You Provide Directly</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Account registration data: email address, password (stored as a cryptographic hash), display name, and profile information.</li>
              <li>Payment and transaction data: billing details processed through our third-party payment providers.</li>
              <li>Communications: messages you send to us via email, support tickets, or forms.</li>
              <li>Content and uploads: videos, streams, images, comments, and other content you create.</li>
              <li>Verification data: identity documents submitted for creator verification or withdrawal processing.</li>
            </ul>
            <p className="mt-3"><strong className="text-av-white">2.2 Information Collected Automatically</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Device and browser information: device type, operating system, browser type and version, screen resolution.</li>
              <li>Usage data: pages visited, features used, content viewed, viewing duration, interaction patterns.</li>
              <li>Network information: IP address, approximate geographic location (city/region level), connection type.</li>
              <li>Cookies and tracking technologies: as described in our <a href="/cookies" className="text-av-orange hover:underline">Cookie Policy</a>.</li>
            </ul>
            <p className="mt-3"><strong className="text-av-white">2.3 Information from Third Parties</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Authentication providers: if you log in via third-party services (e.g., PAK login).</li>
              <li>Payment processors: transaction confirmation, fraud prevention signals.</li>
              <li>Analytics services: aggregated usage insights.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use your personal information for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-av-white">Platform Operation:</strong> Authenticate your identity, maintain your account, process transactions, and deliver services.</li>
              <li><strong className="text-av-white">Personalisation:</strong> Customise your experience, recommend content, and remember your preferences.</li>
              <li><strong className="text-av-white">Communication:</strong> Send service notifications, security alerts, support responses, and (with your consent) promotional messages.</li>
              <li><strong className="text-av-white">Safety and Security:</strong> Detect and prevent fraud, abuse, spam, and security threats.</li>
              <li><strong className="text-av-white">Legal Compliance:</strong> Fulfil legal obligations, respond to lawful requests, and enforce our Terms of Service.</li>
              <li><strong className="text-av-white">Analytics and Improvement:</strong> Analyse usage patterns to improve Platform performance, features, and user experience.</li>
            </ul>
          </Section>

          <Section title="4. Data Sharing">
            <p><strong className="text-av-white">4.1 We Do Not Sell Your Data.</strong> AfroVision does not sell, rent, or trade your personal information to third parties.</p>
            <p className="mt-3"><strong className="text-av-white">4.2 Service Providers.</strong> We share data with trusted third-party service providers who perform services on our behalf, including hosting infrastructure, payment processing, email delivery, and analytics. These providers are contractually bound to use your data only for the purposes we specify and in compliance with this policy.</p>
            <p className="mt-3"><strong className="text-av-white">4.3 Sponsors and Partners — Aggregated Data Only.</strong> We may share aggregated, anonymised data and statistics with sponsors, advertising partners, and business collaborators. <strong className="text-av-white">This data never includes personally identifiable information (PII).</strong> No names, email addresses, phone numbers, IP addresses, payment details, or any information that could identify an individual user will be disclosed. Only aggregate metrics such as total viewership, engagement rates, demographic summaries, and content performance trends are shared.</p>
            <p className="mt-3"><strong className="text-av-white">4.4 Legal Requirements.</strong> We may disclose your information when required by law, court order, or governmental authority, or when we believe disclosure is necessary to protect our rights, safety, or property, or that of our users.</p>
            <p className="mt-3"><strong className="text-av-white">4.5 Business Transfers.</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>We retain your personal information for as long as your account is active or as needed to provide services, comply with legal obligations, resolve disputes, and enforce our agreements. Specific retention periods include:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-av-white">Account data:</strong> Retained for the lifetime of your account plus 30 days after deletion request.</li>
              <li><strong className="text-av-white">Transaction records:</strong> Retained for a minimum of 7 years for financial and regulatory compliance.</li>
              <li><strong className="text-av-white">Usage logs:</strong> Retained for up to 24 months for analytics and security monitoring.</li>
              <li><strong className="text-av-white">Support communications:</strong> Retained for up to 3 years after resolution.</li>
            </ul>
            <p className="mt-2">When data is no longer needed, it is securely deleted or anonymised.</p>
          </Section>

          <Section title="6. Data Security">
            <p>We implement industry-standard security measures to protect your information, including:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Encryption of data in transit (TLS/SSL) and at rest (AES-256).</li>
              <li>Secure password hashing using bcrypt with strong salt rounds.</li>
              <li>Rate limiting and automated threat detection on API endpoints.</li>
              <li>Role-based access controls restricting employee access to personal data.</li>
              <li>Regular security audits and vulnerability assessments.</li>
            </ul>
            <p className="mt-2">While we strive to protect your data, no system is 100% secure. We encourage you to use strong, unique passwords and enable available security features.</p>
          </Section>

          <Section title="7. Cookies and Tracking Technologies">
            <p>We use cookies and similar technologies for authentication, session management, analytics, and personalisation. For detailed information about the cookies we use and how to manage them, please refer to our <a href="/cookies" className="text-av-orange hover:underline">Cookie Policy</a>.</p>
          </Section>

          <Section title="8. Your Rights">
            <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-av-white">Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-av-white">Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong className="text-av-white">Erasure:</strong> Request deletion of your personal data, subject to legal retention requirements.</li>
              <li><strong className="text-av-white">Data Portability:</strong> Request your data in a structured, machine-readable format.</li>
              <li><strong className="text-av-white">Restriction:</strong> Request that we restrict processing of your data in certain circumstances.</li>
              <li><strong className="text-av-white">Objection:</strong> Object to processing of your data for direct marketing purposes.</li>
              <li><strong className="text-av-white">Withdraw Consent:</strong> Where processing is based on consent, withdraw your consent at any time.</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact us at <a href="mailto:privacy@afrovision.tv" className="text-av-orange hover:underline">privacy@afrovision.tv</a>. We will respond within 30 days.</p>
          </Section>

          <Section title="9. International Data Transfers">
            <p>Your information may be stored and processed in countries other than your own. When we transfer data internationally, we ensure appropriate safeguards are in place, including standard contractual clauses and data processing agreements that comply with applicable data protection laws.</p>
          </Section>

          <Section title="10. Children&apos;s Privacy">
            <p>AfroVision is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we discover that we have inadvertently collected data from a child, we will promptly delete that information. If you believe a child has provided us with personal data, please contact us at <a href="mailto:privacy@afrovision.tv" className="text-av-orange hover:underline">privacy@afrovision.tv</a>.</p>
          </Section>

          <Section title="11. Third-Party Links and Services">
            <p>The Platform may contain links to third-party websites and services that are not operated by AfroVision. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information.</p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. Material changes will be communicated via email or a prominent notice on the Platform at least fourteen (14) days before they take effect. The &quot;Last Reviewed&quot; date at the top will be updated accordingly.</p>
          </Section>

          <Section title="13. Contact Us">
            <p>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">Privacy Officer:</strong>{" "}<a href="mailto:privacy@afrovision.tv" className="text-av-orange hover:underline">privacy@afrovision.tv</a></li>
              <li><strong className="text-av-white">General Support:</strong>{" "}<a href="mailto:support@afrovision.tv" className="text-av-orange hover:underline">support@afrovision.tv</a></li>
              <li><strong className="text-av-white">Legal:</strong>{" "}<a href="mailto:legal@afrovision.tv" className="text-av-orange hover:underline">legal@afrovision.tv</a></li>
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
