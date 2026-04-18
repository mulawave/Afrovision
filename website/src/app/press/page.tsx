import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Press — AfroVision",
  description:
    "AfroVision press resources, media kit, and press contact information.",
};

export default function PressPage() {
  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            Media
          </p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">
            Press &amp; Media
          </h1>
          <p className="mt-4 text-base text-av-light-orange leading-relaxed max-w-2xl">
            For press inquiries, interviews, and media resources, please reach
            out to our communications team.
          </p>
        </div>

        <section className="mb-12 rounded-2xl bg-av-card border border-av-input-border/30 p-8">
          <h2 className="text-xl font-bold text-av-white mb-4">Press Contact</h2>
          <p className="text-sm text-av-light-orange leading-relaxed mb-4">
            For all media and press inquiries, please contact:
          </p>
          <a
            href="mailto:press@afrovision.online"
            className="text-av-orange font-semibold text-sm hover:underline"
          >
            press@afrovision.online
          </a>
        </section>

        <section className="rounded-2xl bg-av-card border border-av-input-border/30 p-8">
          <h2 className="text-xl font-bold text-av-white mb-4">About AfroVision</h2>
          <div className="space-y-3 text-sm text-av-light-orange leading-relaxed">
            <p>
              AfroVision is Africa&apos;s premier live streaming platform,
              connecting creators with audiences through live entertainment,
              interactive features, and a viewer reward economy powered by vPT
              tokens.
            </p>
            <p>
              Founded with the mission to amplify African voices and stories,
              AfroVision provides creators with powerful broadcast tools, direct
              monetization, and a global stage — while rewarding viewers for
              their engagement.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
