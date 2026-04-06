import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Anti-Money Laundering Policy — AfroVision",
  description: "AfroVision Anti-Money Laundering (AML) and Counter-Terrorism Financing (CTF) Policy.",
};

export default function AmlPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Anti-Money Laundering Policy</h1>
          <p className="mt-2 text-xs text-av-hint">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="1. Purpose and Scope">
            <p>AfroVision Media Ltd (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to complying with all applicable anti-money laundering (AML), counter-terrorism financing (CTF), and know-your-customer (KYC) laws and regulations. This Anti-Money Laundering Policy (&quot;AML Policy&quot;) outlines the measures we implement to prevent the use of our platform for money laundering, terrorist financing, or any other illicit financial activity.</p>
            <p className="mt-2">This policy applies to all users, employees, contractors, and third-party service providers who interact with AfroVision&apos;s financial systems, including payments, withdrawals, virtual token (vPT) transactions, and any value transfer mechanisms on the Platform.</p>
          </Section>

          <Section title="2. Regulatory Framework">
            <p>Our AML programme is designed in accordance with:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>The Money Laundering (Prohibition) Act, 2011 (as amended) — Federal Republic of Nigeria.</li>
              <li>The Terrorism (Prevention) Act, 2011 (as amended) — Federal Republic of Nigeria.</li>
              <li>Central Bank of Nigeria (CBN) AML/CFT Regulations.</li>
              <li>Financial Action Task Force (FATF) Recommendations.</li>
              <li>Applicable international anti-money laundering directives and sanctions regimes.</li>
            </ul>
          </Section>

          <Section title="3. Know Your Customer (KYC) Procedures">
            <p><strong className="text-av-white">3.1 Identity Verification.</strong> Before users can access financial features (withdrawals, paid subscriptions, vPT conversions), we require identity verification. This may include:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Full legal name and date of birth.</li>
              <li>Government-issued photo identification (national ID, passport, or driver&apos;s licence).</li>
              <li>Proof of address (utility bill, bank statement, or government correspondence dated within 3 months).</li>
              <li>Selfie or liveness verification to confirm document authenticity.</li>
            </ul>
            <p className="mt-3"><strong className="text-av-white">3.2 Enhanced Due Diligence (EDD).</strong> Higher-risk situations require additional scrutiny, including:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Users with high transaction volumes or unusual activity patterns.</li>
              <li>Users from jurisdictions with elevated money laundering or terrorism financing risk.</li>
              <li>Politically Exposed Persons (PEPs) and their immediate associates.</li>
              <li>Transactions that appear inconsistent with a user&apos;s stated profile or activity history.</li>
            </ul>
            <p className="mt-3"><strong className="text-av-white">3.3 Ongoing Monitoring.</strong> KYC is not a one-time event. We conduct continuous monitoring of user accounts and transactions to ensure ongoing compliance, including periodic re-verification of high-risk accounts.</p>
          </Section>

          <Section title="4. Transaction Monitoring">
            <p>AfroVision employs automated and manual monitoring systems to detect suspicious transactions. Monitored indicators include:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Unusually large or frequent transactions inconsistent with user profile.</li>
              <li>Rapid cycling of funds (depositing and immediately withdrawing).</li>
              <li>Multiple accounts linked to the same identity or payment method.</li>
              <li>Transactions involving jurisdictions under international sanctions.</li>
              <li>Structuring of transactions to avoid reporting thresholds.</li>
              <li>Sudden changes in transaction patterns or funding sources.</li>
              <li>Attempts to convert vPT tokens in patterns suggesting layering or integration.</li>
            </ul>
            <p className="mt-2">When suspicious activity is detected, the relevant account and transactions may be frozen pending investigation.</p>
          </Section>

          <Section title="5. Sanctions Screening">
            <p>We screen users and transactions against applicable sanctions lists, including:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>United Nations Security Council Consolidated List.</li>
              <li>United States OFAC (Office of Foreign Assets Control) Specially Designated Nationals (SDN) List.</li>
              <li>European Union Sanctions List.</li>
              <li>United Kingdom HM Treasury Financial Sanctions Targets.</li>
              <li>Nigerian Financial Intelligence Unit (NFIU) watchlists.</li>
            </ul>
            <p className="mt-2">Users and transactions that match or closely resemble sanctioned entities will be blocked and reported to the relevant authorities.</p>
          </Section>

          <Section title="6. Suspicious Activity Reporting">
            <p>AfroVision is committed to reporting suspicious activities to the appropriate regulatory authorities, including the Nigerian Financial Intelligence Unit (NFIU) and the Economic and Financial Crimes Commission (EFCC), as required by law.</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Suspicious Transaction Reports (STRs) are filed promptly when indicators of money laundering, terrorism financing, or fraud are identified.</li>
              <li>We maintain confidentiality of all STRs — users are not informed that a report has been filed (&quot;tipping off&quot; is prohibited).</li>
              <li>All internal and external reports are retained for a minimum of 5 years.</li>
            </ul>
          </Section>

          <Section title="7. Record Keeping">
            <p>In compliance with regulatory requirements, AfroVision maintains comprehensive records, including:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>KYC identification and verification documents — retained for a minimum of 5 years after account closure.</li>
              <li>Transaction records — retained for a minimum of 7 years.</li>
              <li>Internal investigation and SAR records — retained for a minimum of 5 years.</li>
              <li>Correspondence related to compliance enquiries.</li>
            </ul>
          </Section>

          <Section title="8. Virtual Token (vPT) Compliance">
            <p>Although vPT tokens are not legal tender or cryptocurrency, we apply AML principles to vPT transactions to prevent abuse:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>vPT conversion to fiat currency (withdrawals) requires completed KYC verification.</li>
              <li>Withdrawal limits and velocity controls are enforced to prevent rapid value extraction.</li>
              <li>Gifting of vPT between users is monitored for unusual patterns.</li>
              <li>Accounts with unexplained accumulation of vPT relative to their activity level may be flagged for review.</li>
            </ul>
          </Section>

          <Section title="9. Employee Training and Awareness">
            <p>All AfroVision employees, contractors, and agents who handle financial transactions, user verification, or compliance functions receive:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Initial AML/CTF/KYC training upon onboarding.</li>
              <li>Annual refresher training on current regulatory requirements and emerging risks.</li>
              <li>Role-specific training for compliance officers and financial operations staff.</li>
              <li>Updates whenever significant regulatory changes occur.</li>
            </ul>
          </Section>

          <Section title="10. Compliance Officer">
            <p>AfroVision designates a Compliance Officer responsible for:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Overseeing the AML programme and ensuring regulatory compliance.</li>
              <li>Reviewing and filing Suspicious Transaction Reports.</li>
              <li>Liaising with regulatory authorities and law enforcement.</li>
              <li>Conducting periodic internal audits and risk assessments.</li>
              <li>Updating policies and procedures in response to regulatory changes.</li>
            </ul>
          </Section>

          <Section title="11. User Obligations">
            <p>By using the AfroVision Platform, you agree to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide accurate and truthful identification information.</li>
              <li>Not use the Platform for any illegal purpose, including money laundering or terrorism financing.</li>
              <li>Cooperate with any verification or compliance enquiries.</li>
              <li>Report any suspicious activity observed on the Platform to <a href="mailto:compliance@afrovision.tv" className="text-av-orange hover:underline">compliance@afrovision.tv</a>.</li>
            </ul>
            <p className="mt-2">Failure to comply may result in account suspension, fund seizure, and referral to law enforcement authorities.</p>
          </Section>

          <Section title="12. Consequences of Non-Compliance">
            <p>Users found to be engaging in money laundering, terrorism financing, or other financial crimes on or through the Platform will face:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Immediate account suspension and freezing of all associated funds.</li>
              <li>Reporting to relevant law enforcement and regulatory agencies.</li>
              <li>Permanent ban from the Platform.</li>
              <li>Civil and criminal prosecution as permitted by applicable law.</li>
            </ul>
          </Section>

          <Section title="13. Policy Review">
            <p>This AML Policy is reviewed at least annually and updated as necessary to reflect changes in law, regulation, risk assessment findings, or business operations. The &quot;Last Reviewed&quot; date at the top of this page reflects the most recent review.</p>
          </Section>

          <Section title="14. Contact Us">
            <p>If you have questions about this AML Policy or wish to report suspicious activity, please contact:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">Compliance Team:</strong>{" "}<a href="mailto:compliance@afrovision.tv" className="text-av-orange hover:underline">compliance@afrovision.tv</a></li>
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
