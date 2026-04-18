import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — AfroVision",
  description: "AfroVision Refund Policy — eligibility, process, and timelines for refund requests.",
};

export default function RefundPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Refund Policy</h1>
          <p className="mt-2 text-xs text-av-light-orange">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="1. Overview">
            <p>AfroVision Media Ltd (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to fair and transparent billing practices. This Refund Policy outlines the circumstances under which refunds may be granted for purchases and subscriptions made on the AfroVision platform (&quot;the Platform&quot;).</p>
          </Section>

          <Section title="2. Subscription Refunds">
            <p><strong className="text-av-white">2.1 Cooling-Off Period.</strong> If you purchase a subscription and request a cancellation within <strong className="text-av-white">48 hours</strong> of the initial purchase, you are eligible for a full refund, provided you have not used any premium features during that period.</p>
            <p className="mt-2"><strong className="text-av-white">2.2 After the Cooling-Off Period.</strong> Subscription fees are generally non-refundable after the 48-hour cooling-off period. Subscriptions remain active until the end of the current billing cycle after cancellation. You will retain access to premium features until the subscription period expires.</p>
            <p className="mt-2"><strong className="text-av-white">2.3 Recurring Subscription Renewals.</strong> If a recurring subscription automatically renews and you did not intend to continue, you may request a refund within <strong className="text-av-white">7 days</strong> of the renewal charge, provided you have not significantly used premium features since the renewal date.</p>
            <p className="mt-2"><strong className="text-av-white">2.4 Service Disruption.</strong> If AfroVision experiences a significant service outage or disruption that prevents you from accessing paid features for an extended period (more than 72 consecutive hours), you may be eligible for a pro-rata credit or refund for the affected period.</p>
          </Section>

          <Section title="3. Virtual Tokens (vPT) and In-Platform Purchases">
            <p><strong className="text-av-white">3.1 Non-Refundable by Default.</strong> vPT token purchases, gifts, tips, and other in-platform transactions are generally non-refundable once completed. vPT tokens are consumed upon use and cannot be reversed.</p>
            <p className="mt-2"><strong className="text-av-white">3.2 Exceptions.</strong> Refunds for vPT-related transactions may be considered in the following cases:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Unauthorised transactions resulting from account compromise (with evidence of the breach).</li>
              <li>Duplicate charges caused by technical errors on our end.</li>
              <li>Failure to receive purchased vPT tokens due to a Platform error.</li>
            </ul>
          </Section>

          <Section title="4. Creator Subscription Refunds">
            <p>Subscriptions to individual creator channels are subject to the same cooling-off period as platform subscriptions (48 hours). After the cooling-off period, creator subscription fees are non-refundable. If a creator&apos;s channel is disabled or removed by AfroVision, remaining subscription time will be credited to your account or refunded on a case-by-case basis.</p>
          </Section>

          <Section title="5. How to Request a Refund">
            <p>To request a refund, follow these steps:</p>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li><strong className="text-av-white">Email us</strong> at <a href="mailto:billing@afrovision.online" className="text-av-orange hover:underline">billing@afrovision.online</a> with the subject line &quot;Refund Request.&quot;</li>
              <li><strong className="text-av-white">Include the following information:</strong>
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>Your registered email address.</li>
                  <li>The transaction ID or receipt number.</li>
                  <li>The date of the transaction.</li>
                  <li>The reason for the refund request.</li>
                  <li>Any supporting documentation (screenshots, error messages, etc.).</li>
                </ul>
              </li>
              <li><strong className="text-av-white">Await confirmation.</strong> Our billing team will review your request and respond within <strong className="text-av-white">5 business days</strong>.</li>
            </ol>
          </Section>

          <Section title="6. Refund Processing">
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Approved refunds will be credited to the original payment method.</li>
              <li>Refund processing typically takes <strong className="text-av-white">5–14 business days</strong> depending on your payment provider and banking institution.</li>
              <li>Refunds in local currencies may be subject to exchange rate fluctuations between the date of purchase and the date of refund.</li>
              <li>Partial refunds may be issued where appropriate (e.g., pro-rata for service disruption or partial usage).</li>
            </ul>
          </Section>

          <Section title="7. Denied Refund Requests">
            <p>Refund requests may be denied in the following circumstances:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>The request falls outside the applicable cooling-off or claim period.</li>
              <li>Significant use of premium features or vPT has occurred since the purchase.</li>
              <li>The account has been terminated for violations of our <a href="/terms" className="text-av-orange hover:underline">Terms of Service</a>.</li>
              <li>The request is deemed fraudulent or made in bad faith.</li>
              <li>The charge was initiated by a third-party payment platform and must be disputed through that provider.</li>
            </ul>
          </Section>

          <Section title="8. Chargebacks and Disputes">
            <p>If you dispute a charge with your bank or payment provider (chargeback) instead of contacting us directly, we may:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Suspend your account pending investigation.</li>
              <li>Provide transaction evidence to your payment provider.</li>
              <li>Permanently disable accounts associated with repeated fraudulent chargebacks.</li>
            </ul>
            <p className="mt-2">We strongly encourage you to contact our billing team first before initiating a chargeback, as we can typically resolve issues faster.</p>
          </Section>

          <Section title="9. Free Trial Conversions">
            <p>If you sign up for a free trial that converts to a paid subscription:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>You will receive a reminder notification before the trial ends and billing begins.</li>
              <li>If you cancel during the trial period, you will not be charged.</li>
              <li>If the first charge occurs after a trial, the standard 48-hour cooling-off period applies to that initial charge.</li>
            </ul>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>AfroVision reserves the right to update this Refund Policy at any time. Material changes will be communicated through the Platform or via email. The &quot;Last Reviewed&quot; date at the top will be updated with each revision. Continued use of paid services after a policy update constitutes acceptance of the revised terms.</p>
          </Section>

          <Section title="11. Contact Us">
            <p>For refund requests, billing enquiries, or questions about this policy:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">Billing:</strong>{" "}<a href="mailto:billing@afrovision.online" className="text-av-orange hover:underline">billing@afrovision.online</a></li>
              <li><strong className="text-av-white">General Support:</strong>{" "}<a href="mailto:support@afrovision.online" className="text-av-orange hover:underline">support@afrovision.online</a></li>
              <li><strong className="text-av-white">Legal:</strong>{" "}<a href="mailto:legal@afrovision.online" className="text-av-orange hover:underline">legal@afrovision.online</a></li>
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
