import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licences & Attributions — AfroVision",
  description: "Open-source software and third-party libraries used by AfroVision's apps and website, and licensing attributions.",
};

export default function LicensesAttributionsPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Licences &amp; Attributions</h1>
          <p className="mt-2 text-xs text-av-light-orange">Effective Date: April 4, 2026 &nbsp;|&nbsp; Last Reviewed: April 4, 2026</p>
        </div>

        <article className="space-y-8">
          <Section title="1. Overview">
            <p>AfroVision Media Ltd&apos;s (&quot;AfroVision,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) mobile apps, TV app, and website are built using a combination of proprietary code and open-source software and third-party libraries. We are grateful to the open-source community and are committed to complying with the licence terms of every third-party component we use.</p>
          </Section>

          <Section title="2. Ongoing Nature of This List">
            <p>Maintaining a complete, fully up-to-date list of every open-source component and its exact version across all AfroVision applications (mobile, TV, and web) is an ongoing process, especially as we ship updates and add features. The table below is a representative, non-exhaustive sample of key components in active use, provided for transparency. It does not capture every dependency, transitive dependency, or version currently shipping in production.</p>
          </Section>

          <Section title="3. Sample Attributions">
            <p>Representative open-source components used across AfroVision&apos;s applications include:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-av-input-border/30">
                    <th className="py-2 pr-4 font-semibold text-av-white">Component</th>
                    <th className="py-2 pr-4 font-semibold text-av-white">Used In</th>
                    <th className="py-2 pr-4 font-semibold text-av-white">Licence</th>
                    <th className="py-2 font-semibold text-av-white">Copyright</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-av-input-border/10">
                    <td className="py-2 pr-4">Flutter</td>
                    <td className="py-2 pr-4">Mobile apps</td>
                    <td className="py-2 pr-4">BSD 3-Clause</td>
                    <td className="py-2">Google LLC and contributors</td>
                  </tr>
                  <tr className="border-b border-av-input-border/10">
                    <td className="py-2 pr-4">React</td>
                    <td className="py-2 pr-4">Website</td>
                    <td className="py-2 pr-4">MIT</td>
                    <td className="py-2">Meta Platforms, Inc. and contributors</td>
                  </tr>
                  <tr className="border-b border-av-input-border/10">
                    <td className="py-2 pr-4">Next.js</td>
                    <td className="py-2 pr-4">Website</td>
                    <td className="py-2 pr-4">MIT</td>
                    <td className="py-2">Vercel, Inc. and contributors</td>
                  </tr>
                  <tr className="border-b border-av-input-border/10">
                    <td className="py-2 pr-4">ExoPlayer / Media3</td>
                    <td className="py-2 pr-4">Android &amp; TV apps</td>
                    <td className="py-2 pr-4">Apache License 2.0</td>
                    <td className="py-2">Google LLC and contributors</td>
                  </tr>
                  <tr className="border-b border-av-input-border/10">
                    <td className="py-2 pr-4">Retrofit</td>
                    <td className="py-2 pr-4">TV app</td>
                    <td className="py-2 pr-4">Apache License 2.0</td>
                    <td className="py-2">Square, Inc.</td>
                  </tr>
                  <tr className="border-b border-av-input-border/10">
                    <td className="py-2 pr-4">Coil</td>
                    <td className="py-2 pr-4">TV app</td>
                    <td className="py-2 pr-4">Apache License 2.0</td>
                    <td className="py-2">Coil Contributors</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Tailwind CSS</td>
                    <td className="py-2 pr-4">Website</td>
                    <td className="py-2 pr-4">MIT</td>
                    <td className="py-2">Tailwind Labs Inc.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="4. Respecting Third-Party Licences">
            <p>We aim to comply with the terms of every open-source licence under which our third-party components are distributed, including common licence families such as the MIT License, the Apache License 2.0, and BSD-style licences. Depending on the licence, this may include preserving copyright notices, including licence text within application binaries or repositories, and, where required, making corresponding source available. Where an in-app &quot;Open Source Licences&quot; screen is available on a given platform (mobile or TV), it provides an auto-generated, more complete list of components bundled in that specific build.</p>
          </Section>

          <Section title="5. No Endorsement">
            <p>Listing a third-party component on this page does not imply that its authors, maintainers, or copyright holders endorse AfroVision or its products.</p>
          </Section>

          <Section title="6. Licensing Questions and Corrections">
            <p>If you are a copyright holder or maintainer of an open-source project used by AfroVision and believe an attribution is missing, incorrect, or that your licence terms are not being met, please contact us so we can investigate and correct the record.</p>
          </Section>

          <Section title="7. Contact Us">
            <ul className="list-none space-y-1 mt-2">
              <li><strong className="text-av-white">Licensing Enquiries:</strong>{" "}<a href="mailto:legal@afrovision.online" className="text-av-orange hover:underline">legal@afrovision.online</a></li>
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
