import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Copyright Infringement Policy — AfroVision",
  description: "AfroVision Copyright Infringement Policy — how we handle copyright claims and DMCA takedown requests.",
};

export default function CopyrightPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Copyright Infringement Policy</h1>
          <p className="mt-2 text-xs text-av-hint">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="1. Commitment to Intellectual Property Rights">
            <p>AfroVision Media Ltd (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects the intellectual property rights of all creators, artists, and rights holders. We are committed to responding promptly to notices of alleged copyright infringement in accordance with the Digital Millennium Copyright Act (DMCA), the Nigerian Copyright Act, and other applicable intellectual property laws.</p>
          </Section>

          <Section title="2. Notification of Copyright Infringement">
            <p>If you believe that content on the AfroVision platform infringes your copyright, you may submit a formal notice of infringement. Your notice must include the following information:</p>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li><strong className="text-av-white">Identification of the copyrighted work</strong> — A description or link to the original copyrighted work that you claim has been infringed.</li>
              <li><strong className="text-av-white">Identification of the infringing content</strong> — The URL(s) or sufficient detail to locate the content on AfroVision that you believe infringes your rights.</li>
              <li><strong className="text-av-white">Your contact information</strong> — Full name, email address, phone number, and postal address.</li>
              <li><strong className="text-av-white">Good-faith statement</strong> — A statement that you have a good-faith belief that the use of the content is not authorised by the copyright owner, its agent, or the law.</li>
              <li><strong className="text-av-white">Accuracy statement</strong> — A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorised to act on the owner&apos;s behalf.</li>
              <li><strong className="text-av-white">Signature</strong> — Your physical or electronic signature.</li>
            </ol>
            <p className="mt-3">Incomplete or fraudulent notices may be rejected.</p>
          </Section>

          <Section title="3. How to Submit a Notice">
            <p>You can submit a copyright infringement notice through the following methods:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li><strong className="text-av-white">Online Form (Recommended):</strong>{" "}
                <Link href="/report-copyright" className="text-av-orange hover:underline">Submit a Copyright Infringement Report</Link>
              </li>
              <li><strong className="text-av-white">Email:</strong>{" "}
                <a href="mailto:copyright@afrovision.tv" className="text-av-orange hover:underline">copyright@afrovision.tv</a>
              </li>
              <li><strong className="text-av-white">Mail:</strong> AfroVision Media Ltd, Attn: Copyright Agent, [Address to be provided].</li>
            </ul>
          </Section>

          <Section title="4. AfroVision&apos;s Response Process">
            <p>Upon receiving a valid copyright infringement notice, AfroVision will:</p>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li><strong className="text-av-white">Acknowledge receipt</strong> — We will confirm receipt of your notice via email and provide a tracking reference number.</li>
              <li><strong className="text-av-white">Review the claim</strong> — Our team will review the notice for completeness and validity.</li>
              <li><strong className="text-av-white">Take action</strong> — If the notice is valid, we will remove or disable access to the allegedly infringing content promptly (typically within 24–72 hours).</li>
              <li><strong className="text-av-white">Notify the uploader</strong> — We will notify the user who posted the content about the takedown, providing them with a copy of the notice (excluding your personal contact information where applicable) and information about filing a counter-notification.</li>
              <li><strong className="text-av-white">Record the action</strong> — We maintain records of all notices and actions taken for compliance and transparency purposes.</li>
            </ol>
          </Section>

          <Section title="5. Counter-Notification">
            <p>If you are a user whose content was removed and you believe the takedown was made in error or that you have the right to use the content, you may submit a counter-notification. Your counter-notification must include:</p>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li>Identification of the removed content and the URL where it previously appeared.</li>
              <li>A statement under penalty of perjury that you have a good-faith belief that the content was removed as a result of mistake or misidentification.</li>
              <li>Your full name, address, phone number, and email address.</li>
              <li>A statement that you consent to the jurisdiction of the courts in Nigeria (or your local jurisdiction) and will accept service of process from the original complainant.</li>
              <li>Your physical or electronic signature.</li>
            </ol>
            <p className="mt-3">If we receive a valid counter-notification, we will forward it to the original complainant. If the complainant does not file a court action within 10–14 business days, we may restore the removed content.</p>
          </Section>

          <Section title="6. Repeat Infringer Policy">
            <p>AfroVision maintains a <strong className="text-av-white">repeat infringer policy</strong>. Users who receive multiple valid copyright strikes will face escalating consequences:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-av-white">First strike:</strong> Content removed. Warning issued. Educational notice about copyright compliance.</li>
              <li><strong className="text-av-white">Second strike:</strong> Content removed. Account restricted from uploading new content for 7 days.</li>
              <li><strong className="text-av-white">Third strike:</strong> Content removed. Account permanently suspended. Remaining balances and earnings may be forfeited.</li>
            </ul>
            <p className="mt-2">Strikes expire after 12 months if no further violations occur. Fraudulent or abusive takedown requests may result in the complainant being banned from our reporting system.</p>
          </Section>

          <Section title="7. Fair Use and Exceptions">
            <p>AfroVision recognises that certain uses of copyrighted material may qualify as fair use (or fair dealing) under applicable law. We consider fair use factors in our review process. However, fair use determinations are ultimately matters of law — if a dispute cannot be resolved informally, it may need to be addressed through the legal system.</p>
          </Section>

          <Section title="8. Content ID and Proactive Measures">
            <p>AfroVision may implement automated content identification systems to detect potentially infringing content before or after publication. These systems are supplementary tools and do not replace the formal notice and counter-notification process described in this policy.</p>
          </Section>

          <Section title="9. Misuse of the Copyright Process">
            <p>Filing a false or misleading copyright notice is a serious matter. Under the DMCA, knowingly making material misrepresentations in a copyright notice may expose the complainant to liability for damages, including attorneys&apos; fees and costs. AfroVision reserves the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Reject or dismiss notices that appear fraudulent, incomplete, or made in bad faith.</li>
              <li>Restore content that was improperly taken down.</li>
              <li>Report abusive use of the process to relevant authorities.</li>
            </ul>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>AfroVision may update this Copyright Infringement Policy to reflect legislation changes, industry best practices, or platform improvements. Material changes will be announced on the Platform. The &quot;Last Reviewed&quot; date at the top will be updated accordingly.</p>
          </Section>

          <Section title="11. Contact Us">
            <p>For copyright-related enquiries, notices, or counter-notifications:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">Copyright Agent:</strong>{" "}<a href="mailto:copyright@afrovision.tv" className="text-av-orange hover:underline">copyright@afrovision.tv</a></li>
              <li><strong className="text-av-white">Online Report Form:</strong>{" "}<Link href="/report-copyright" className="text-av-orange hover:underline">Submit a Report</Link></li>
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
