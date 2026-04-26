import type { Metadata } from "next";
import { getStaticPageContent } from "@/lib/static-page-content";

export const metadata: Metadata = {
  title: "Press — AfroVision",
  description:
    "AfroVision press resources, media kit, and press contact information.",
};

const PRESS_DEFAULT = {
  eyebrow: "Media",
  title: "Press & Media",
  intro: "For press inquiries, interviews, and media resources, please reach out to our communications team.",
  press_contact_title: "Press Contact",
  press_contact_body: "For all media and press inquiries, please contact:",
  press_email: "press@afrovision.online",
  about_title: "About AfroVision",
  about_paragraphs: [
    "AfroVision is Africa's premier live streaming platform, connecting creators with audiences through live entertainment, interactive features, and a viewer reward economy powered by vPT tokens.",
    "Founded with the mission to amplify African voices and stories, AfroVision provides creators with powerful broadcast tools, direct monetization, and a global stage — while rewarding viewers for their engagement.",
  ],
};

export default async function PressPage() {
  const managed = await getStaticPageContent<typeof PRESS_DEFAULT>("press");
  const content = managed || PRESS_DEFAULT;

  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            {content.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">
            {content.title}
          </h1>
          <p className="mt-4 text-base text-av-light-orange leading-relaxed max-w-2xl">
            {content.intro}
          </p>
        </div>

        <section className="mb-12 rounded-2xl bg-av-card border border-av-input-border/30 p-8">
          <h2 className="text-xl font-bold text-av-white mb-4">{content.press_contact_title}</h2>
          <p className="text-sm text-av-light-orange leading-relaxed mb-4">
            {content.press_contact_body}
          </p>
          <a
            href={`mailto:${content.press_email || "press@afrovision.online"}`}
            className="text-av-orange font-semibold text-sm hover:underline"
          >
            {content.press_email || "press@afrovision.online"}
          </a>
        </section>

        <section className="rounded-2xl bg-av-card border border-av-input-border/30 p-8">
          <h2 className="text-xl font-bold text-av-white mb-4">{content.about_title}</h2>
          <div className="space-y-3 text-sm text-av-light-orange leading-relaxed">
            {(content.about_paragraphs || []).map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
