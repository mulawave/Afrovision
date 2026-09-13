import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Rules — AfroVision",
  description: "AfroVision Community Rules — conduct expectations for chat, streams, comments, and DMs, and how we enforce them.",
};

export default function CommunityRulesPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Community Rules</h1>
          <p className="mt-2 text-xs text-av-light-orange">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="1. Purpose">
            <p>These Community Rules (&quot;Rules&quot;) set out the standards of conduct expected of everyone who uses AfroVision Media Ltd&apos;s (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) platform (&quot;the Platform&quot;), including in live chat, streams, comments, direct messages (DMs), and any other interactive feature. These Rules apply in addition to our{" "}
            <a href="/terms" className="text-av-orange hover:underline">Terms of Service</a>. Violating these Rules may result in content removal, feature restrictions, or account suspension or termination.</p>
          </Section>

          <Section title="2. General Conduct Expectations">
            <p>When using chat, streams, comments, DMs, or any other interactive feature, you agree to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Treat other users, creators, and AfroVision staff with respect.</li>
              <li>Engage in good faith — genuine feedback and criticism are welcome; abuse is not.</li>
              <li>Follow the specific rules a creator or moderator sets for their own channel or stream, where those rules do not conflict with these Rules.</li>
              <li>Report content or behaviour you believe violates these Rules rather than retaliating.</li>
            </ul>
          </Section>

          <Section title="3. Harassment, Hate Speech, and Bullying">
            <p>We have zero tolerance for:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Harassment, threats, intimidation, stalking, or targeted abuse of any user or creator.</li>
              <li>Hate speech or content that attacks, demeans, or incites violence against a person or group on the basis of race, ethnicity, national origin, religion, disability, gender, gender identity, sexual orientation, age, or veteran status.</li>
              <li>Bullying, dogpiling, or organising others to harass a specific person.</li>
              <li>Doxxing — sharing another person&apos;s private information (address, phone number, financial details, etc.) without consent.</li>
              <li>Encouraging self-harm, suicide, or violence against any person or group.</li>
            </ul>
          </Section>

          <Section title="4. Spam and Manipulation">
            <p>The following are prohibited across chat, comments, and DMs:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Repetitive, unsolicited, or bulk messaging (spam), including copy-pasted chat flooding.</li>
              <li>Unauthorised advertising, referral links, or solicitation for other platforms or services.</li>
              <li>Use of bots, scripts, or automation to inflate views, followers, chat activity, or engagement.</li>
              <li>Phishing links or attempts to obtain another user&apos;s login credentials or payment details.</li>
              <li>Impersonating AfroVision staff, moderators, other users, or public figures.</li>
            </ul>
          </Section>

          <Section title="5. Prohibited Content">
            <p><strong className="text-av-white">5.1 Illegal Content.</strong> Content that violates applicable law is strictly prohibited, including content that facilitates fraud, the sale of illegal goods or services, or incitement to violence.</p>
            <p className="mt-3"><strong className="text-av-white">5.2 Child Sexual Abuse Material (CSAM) — Zero Tolerance.</strong> AfroVision has absolute zero tolerance for child sexual abuse material and any content that sexualises, exploits, or endangers minors. Any account found to upload, stream, distribute, or request such content will be immediately and permanently banned, and the content and account details will be reported to the National Center for Missing &amp; Exploited Children (NCMEC), the Nigerian Financial Intelligence Unit and Nigeria Police Force, and/or other relevant law enforcement and regulatory authorities as required by law. We cooperate fully with law enforcement investigations into such content.</p>
            <p className="mt-3"><strong className="text-av-white">5.3 Non-Consensual Intimate Imagery (NCII).</strong> Sharing or threatening to share intimate images or videos of a person without their consent is strictly prohibited and will result in immediate content removal and account action, regardless of how the content was obtained.</p>
            <p className="mt-3"><strong className="text-av-white">5.4 Other Prohibited Content.</strong> We also prohibit content depicting graphic violence for shock value, promotion of terrorism or violent extremism, and content that facilitates human trafficking or exploitation.</p>
          </Section>

          <Section title="6. Creator Conduct On-Stream">
            <p>Creators broadcasting on AfroVision are held to a higher standard of responsibility and must:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Moderate their own chat reasonably and remove or report Rule-violating content promptly.</li>
              <li>Not use their stream to harass, dox, or incite action against any individual.</li>
              <li>Disclose sponsored or paid content in line with applicable advertising standards.</li>
              <li>Avoid broadcasting illegal activity, dangerous stunts, or content that endangers themselves or others.</li>
              <li>Comply with age-appropriate content placement and any content warnings AfroVision requires.</li>
            </ul>
            <p className="mt-2">Repeated or severe violations by a creator may result in loss of monetisation, exclusive channel status (see our{" "}
            <a href="/exclusive-channel-policy" className="text-av-orange hover:underline">Exclusive Channel Policy</a>), or account termination.</p>
          </Section>

          <Section title="7. Enforcement Ladder">
            <p>AfroVision applies enforcement proportionate to the severity and frequency of a violation. A typical enforcement path is:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-av-white">Warning.</strong> A notice explaining the violation, issued for minor or first-time infractions.</li>
              <li><strong className="text-av-white">Content Removal.</strong> Removal of the specific violating message, comment, clip, or stream.</li>
              <li><strong className="text-av-white">Temporary Restriction.</strong> Time-limited suspension of chat, streaming, commenting, or DM privileges, or of the account itself.</li>
              <li><strong className="text-av-white">Permanent Ban.</strong> Permanent removal of account access for severe violations (including CSAM, NCII, credible threats of violence, or repeated serious infractions).</li>
            </ul>
            <p className="mt-2">AfroVision reserves the right to skip directly to permanent ban for severe violations without progressing through earlier steps, and to take these actions without prior notice where necessary to protect user safety.</p>
          </Section>

          <Section title="8. Appeals">
            <p>If you believe an enforcement action was applied in error, you may appeal by contacting <a href="mailto:appeals@afrovision.online" className="text-av-orange hover:underline">appeals@afrovision.online</a> within thirty (30) days of the action, including your account details and an explanation of why you believe the action was incorrect. We will review appeals in good faith and respond within a reasonable time. Appeals are not available for accounts banned for CSAM, NCII, or other severe safety violations.</p>
          </Section>

          <Section title="9. Reporting a User or Content">
            <p>If you encounter content or behaviour that violates these Rules, please report it using the in-app &quot;Report&quot; option on the relevant stream, comment, message, or profile, or by contacting <a href="mailto:trust@afrovision.online" className="text-av-orange hover:underline">trust@afrovision.online</a>. Please include as much detail as possible (links, screenshots, timestamps, usernames). Reports involving imminent risk to life or child safety should also be reported directly to local law enforcement.</p>
          </Section>

          <Section title="10. Changes to These Rules">
            <p>We may update these Rules from time to time to reflect new features, emerging risks, or regulatory requirements. Continued use of the Platform after an update constitutes acceptance of the revised Rules.</p>
          </Section>

          <Section title="11. Contact Us">
            <p>If you have questions about these Community Rules, please contact us:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">Trust &amp; Safety:</strong>{" "}<a href="mailto:trust@afrovision.online" className="text-av-orange hover:underline">trust@afrovision.online</a></li>
              <li><strong className="text-av-white">Appeals:</strong>{" "}<a href="mailto:appeals@afrovision.online" className="text-av-orange hover:underline">appeals@afrovision.online</a></li>
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
