import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exclusive Channel Policy — AfroVision",
  description: "AfroVision Exclusive Channel Policy — how exclusive channel membership, billing, and access works.",
};

export default function ExclusiveChannelPolicyPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Exclusive Channel Policy</h1>
          <p className="mt-2 text-xs text-av-light-orange">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="1. What Is an Exclusive Channel">
            <p>An &quot;Exclusive Channel&quot; is a creator channel on AfroVision (&quot;the Platform&quot;), operated by AfroVision Media Ltd (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), that gates some or all of its content behind a paid membership (&quot;Membership&quot;). Exclusive Channels may offer member-only livestreams, videos, chat, or other content not available to non-members. This policy explains how Membership, access, billing, and enforcement work for Exclusive Channels, and supplements our{" "}
            <a href="/terms" className="text-av-orange hover:underline">Terms of Service</a>.</p>
          </Section>

          <Section title="2. Membership and Subscription Access">
            <p>Access to an Exclusive Channel&apos;s member-only area requires an active, paid subscription to that specific channel. Subscribing to one creator&apos;s Exclusive Channel does not grant access to any other creator&apos;s Exclusive Channel unless explicitly bundled and disclosed at checkout.</p>
          </Section>

          <Section title="3. Binary Access Model — No Partial Unlocking">
            <p>AfroVision&apos;s Exclusive Channel access is <strong className="text-av-white">binary</strong>: at any given time you are either a member in good standing with full access to that channel&apos;s member-only area, or you are not a member and are blocked from that area entirely.</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>The Platform does <strong className="text-av-white">not</strong> support partial unlocking of individual member-only videos, streams, or posts on a pay-per-item basis.</li>
              <li>There is no tiered &quot;preview&quot; unlock within the member-only area beyond whatever free preview a creator chooses to make public outside that area.</li>
              <li>Once your Membership lapses or is cancelled, access to the entire member-only area is revoked at the same time — not item by item.</li>
            </ul>
          </Section>

          <Section title="4. Billing Cycle and Auto-Renewal">
            <p><strong className="text-av-white">4.1 Billing Cycle.</strong> Exclusive Channel Memberships are billed on a recurring cycle (e.g., monthly) as disclosed at the time of purchase. The price and billing frequency for a given channel are shown before you confirm your subscription.</p>
            <p className="mt-2"><strong className="text-av-white">4.2 Auto-Renewal.</strong> Memberships renew automatically at the end of each billing cycle using your saved payment method, unless you cancel before the renewal date. You will not receive a separate confirmation for each successful renewal beyond your standard payment receipt.</p>
            <p className="mt-2"><strong className="text-av-white">4.3 Cancellation.</strong> You may cancel auto-renewal at any time through your account&apos;s subscription settings. Cancellation stops future billing but does not automatically issue a refund for the current billing cycle already paid for.</p>
          </Section>

          <Section title="5. Expiry and Loss of Access">
            <p>If a Membership payment fails, is cancelled, or otherwise lapses, access to that channel&apos;s member-only area is revoked as soon as the current billing period ends. Previously accessed member-only content does not remain available after expiry, and downloaded or cached content (where technically possible) may also become unplayable. To regain access, you must resubscribe at the then-current price.</p>
          </Section>

          <Section title="6. Refund Eligibility">
            <p>Refunds for Exclusive Channel Memberships are governed by our{" "}
            <a href="/refund" className="text-av-orange hover:underline">Refund Policy</a>. In general, membership fees are non-refundable once the billing period has begun, except where required by applicable consumer protection law or expressly stated in the Refund Policy.</p>
          </Section>

          <Section title="7. Creator Obligations">
            <p>Creators operating an Exclusive Channel agree to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Maintain a reasonable and consistent cadence of member-only content as represented to subscribers (e.g., in the channel description or membership tier details).</li>
              <li>Ensure member-only content meets a baseline quality and production standard consistent with what was advertised.</li>
              <li>Not materially misrepresent what Membership includes.</li>
              <li>Comply with our{" "}
              <a href="/community-rules" className="text-av-orange hover:underline">Community Rules</a> and Terms of Service in all Exclusive Channel content.</li>
            </ul>
          </Section>

          <Section title="8. Removal of Exclusive Status">
            <p>AfroVision reserves the right to suspend or permanently remove a channel&apos;s Exclusive Channel status, including for:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Violations of the Community Rules or Terms of Service.</li>
              <li>Repeated failure to deliver member-only content as represented.</li>
              <li>Fraudulent, deceptive, or misleading membership practices.</li>
              <li>Chargeback or payment-abuse patterns associated with the channel.</li>
            </ul>
            <p className="mt-2">Where Exclusive Channel status is removed for cause, active subscribers may be notified and, depending on the circumstances, may be entitled to a pro-rated refund for the remaining unused portion of their current billing cycle.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this Exclusive Channel Policy from time to time. Material changes affecting active subscribers will be communicated in advance where practicable.</p>
          </Section>

          <Section title="10. Contact Us">
            <p>If you have questions about Exclusive Channels or your Membership, please contact:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">Support:</strong>{" "}<a href="mailto:support@afrovision.online" className="text-av-orange hover:underline">support@afrovision.online</a></li>
              <li><strong className="text-av-white">Billing:</strong>{" "}<a href="mailto:billing@afrovision.online" className="text-av-orange hover:underline">billing@afrovision.online</a></li>
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
