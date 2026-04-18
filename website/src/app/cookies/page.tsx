import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy — AfroVision",
  description: "AfroVision Cookie Policy — how and why we use cookies and similar tracking technologies.",
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Cookie Policy</h1>
          <p className="mt-2 text-xs text-av-light-orange">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="1. Introduction">
            This Cookie Policy explains how AfroVision Media Ltd (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) uses cookies and similar tracking technologies when you visit and use the AfroVision platform (&quot;the Platform&quot;). This policy should be read alongside our{" "}
            <a href="/privacy" className="text-av-orange hover:underline">Privacy Policy</a>.
          </Section>

          <Section title="2. What Are Cookies?">
            Cookies are small text files stored on your device (computer, smartphone, or tablet) when you visit a website. They help the site recognise your device, remember your preferences, and understand how you interact with the site. Cookies may be &quot;session&quot; cookies (deleted when you close your browser) or &quot;persistent&quot; cookies (remaining until they expire or you delete them).
          </Section>

          <Section title="3. Types of Cookies We Use">
            <div className="space-y-4 mt-2">
              <div>
                <p><strong className="text-av-white">3.1 Strictly Necessary Cookies</strong></p>
                <p className="mt-1">These cookies are essential for the Platform to function properly and cannot be disabled. They enable core functionality such as:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>User authentication and secure session management.</li>
                  <li>CSRF (Cross-Site Request Forgery) protection.</li>
                  <li>Load balancing and security threat detection.</li>
                  <li>CAPTCHA verification to prevent automated abuse.</li>
                </ul>
              </div>
              <div>
                <p><strong className="text-av-white">3.2 Preference Cookies (Functional)</strong></p>
                <p className="mt-1">These cookies remember your choices and settings to provide a more personalised experience, including:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>Language and region preferences.</li>
                  <li>Theme and display settings.</li>
                  <li>Volume and playback preferences.</li>
                </ul>
              </div>
              <div>
                <p><strong className="text-av-white">3.3 Analytics and Performance Cookies</strong></p>
                <p className="mt-1">These cookies help us understand how visitors interact with the Platform so we can measure performance and improve the user experience. They collect data such as:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>Pages and features most frequently visited.</li>
                  <li>Errors encountered during use.</li>
                  <li>Loading times and performance metrics.</li>
                </ul>
                <p className="mt-1">Analytics data is aggregated and anonymised. No personally identifiable information is included in analytics reports.</p>
              </div>
              <div>
                <p><strong className="text-av-white">3.4 Marketing and Advertising Cookies</strong></p>
                <p className="mt-1">We may use these cookies in the future to deliver relevant advertisements and measure campaign effectiveness. If implemented, these cookies will only be activated with your explicit consent. Currently, AfroVision does not use advertising cookies.</p>
              </div>
            </div>
          </Section>

          <Section title="4. Third-Party Cookies">
            <p>Certain third-party services integrated into the Platform may set their own cookies. These include:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-av-white">Google reCAPTCHA:</strong> Used to protect forms from automated abuse. Subject to Google&apos;s <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-av-orange hover:underline">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-av-orange hover:underline">Terms of Service</a>.</li>
              <li><strong className="text-av-white">Analytics providers:</strong> May set cookies for usage measurement and performance monitoring.</li>
              <li><strong className="text-av-white">Payment processors:</strong> May set cookies for secure transaction processing and fraud prevention.</li>
            </ul>
            <p className="mt-2">Third-party cookies are governed by the respective third-party privacy policies, not by this Cookie Policy.</p>
          </Section>

          <Section title="5. How Long Do Cookies Last?">
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li><strong className="text-av-white">Session cookies:</strong> Automatically deleted when you close your browser.</li>
              <li><strong className="text-av-white">Persistent cookies:</strong> Remain on your device for a set period (typically 30 days to 2 years) or until you manually delete them.</li>
              <li><strong className="text-av-white">Authentication tokens:</strong> Expire based on session duration settings (typically 7 days for remembered sessions).</li>
            </ul>
          </Section>

          <Section title="6. Managing Cookies">
            <p>You can control and manage cookies through your browser settings. Most browsers allow you to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>View and delete existing cookies.</li>
              <li>Block cookies from specific or all websites.</li>
              <li>Set preferences for first-party and third-party cookies.</li>
              <li>Enable notifications when a cookie is set.</li>
            </ul>
            <p className="mt-2"><strong className="text-av-white">Please note:</strong> Disabling strictly necessary cookies may prevent you from using essential features of the Platform, including logging in, streaming content, and processing transactions.</p>
            <p className="mt-2">Common browser cookie management guides:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-av-orange hover:underline">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="text-av-orange hover:underline">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/en-us/105082" target="_blank" rel="noopener noreferrer" className="text-av-orange hover:underline">Safari</a></li>
              <li><a href="https://support.microsoft.com/en-us/microsoft-edge/manage-cookies-in-microsoft-edge-view-allow-block-delete-and-use-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer" className="text-av-orange hover:underline">Microsoft Edge</a></li>
            </ul>
          </Section>

          <Section title="7. Do Not Track Signals">
            <p>Some browsers send &quot;Do Not Track&quot; (DNT) signals. There is currently no universally accepted standard for how websites should respond to DNT signals. At this time, AfroVision does not alter its data collection practices in response to DNT signals. If an industry standard is adopted in the future, we will update this policy accordingly.</p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>We may update this Cookie Policy to reflect changes in technology, regulation, or our practices. Material changes will be communicated via a notice on the Platform. The &quot;Last Reviewed&quot; date at the top will be updated with each revision.</p>
          </Section>

          <Section title="9. Contact Us">
            <p>If you have questions about our use of cookies or this Cookie Policy, please contact us at:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">Privacy Officer:</strong>{" "}<a href="mailto:privacy@afrovision.online" className="text-av-orange hover:underline">privacy@afrovision.online</a></li>
              <li><strong className="text-av-white">General Support:</strong>{" "}<a href="mailto:support@afrovision.online" className="text-av-orange hover:underline">support@afrovision.online</a></li>
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
