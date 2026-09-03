export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { HeroSlider } from "@/components/HeroSlider";
import { FeaturedChannels } from "@/components/FeaturedChannels";
import { LiveNowRow } from "@/components/LiveNowRow";
import { UpcomingShows } from "@/components/UpcomingShows";
import { ChallengeSection } from "@/components/ChallengeSection";
import { UpdatesSection } from "@/components/UpdatesSection";
import { BannerAd } from "@/components/BannerAd";
import { PromoModal } from "@/components/PromoModal";
import { GracePeriodBanner } from "@/components/GracePeriodBanner";
import { MySubscriptionsRow } from "@/components/MySubscriptionsRow";
import { RecentlyViewedRow } from "@/components/RecentlyViewedRow";
import { HeroToggleWrapper } from "@/components/HeroToggleWrapper";
import { getHomepageContent, type HomepageSection } from "@/lib/homepage";

function renderSection(section: HomepageSection) {
  switch (section.key) {
    case "hero":
      return <HeroSlider key={section.key} slides={section.slides} autoRotateMs={section.auto_rotate_ms} />;
    case "featured_channels":
      return <FeaturedChannels key={section.key} section={section} />;
    case "live_now":
      return <LiveNowRow key={section.key} section={section} />;
    case "upcoming_shows":
      return <UpcomingShows key={section.key} section={section} />;
    case "challenge":
      return <ChallengeSection key={section.key} section={section} />;
    case "updates":
      return <UpdatesSection key={section.key} section={section} />;
    default:
      return null;
  }
}

/** Skeleton shown instantly while the API data streams in */
function HomepageSkeleton() {
  return (
    <>
      {/* Hero skeleton */}
      <section className="relative min-h-[600px] lg:min-h-[700px] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-av-light-blue/20 via-av-dark-blue to-av-dark-blue" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full pt-24 lg:pt-32 pb-16">
          <div className="max-w-2xl space-y-6">
            <div className="h-6 w-48 rounded-full bg-av-card/80 animate-pulse" />
            <div className="h-12 w-96 max-w-full rounded-lg bg-av-card/60 animate-pulse" />
            <div className="h-4 w-80 max-w-full rounded bg-av-card/40 animate-pulse" />
            <div className="h-4 w-64 rounded bg-av-card/40 animate-pulse" />
            <div className="flex gap-4 pt-4">
              <div className="h-12 w-44 rounded-full bg-av-orange/20 animate-pulse" />
              <div className="h-12 w-36 rounded-full bg-av-card/30 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-av-dark-blue to-transparent pointer-events-none" />
      </section>

      {/* Featured channels skeleton */}
      <section className="py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="h-7 w-56 rounded bg-av-card/60 animate-pulse mb-2" />
          <div className="h-4 w-72 rounded bg-av-card/40 animate-pulse mb-8" />
          <div className="flex gap-5 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-[280px] sm:w-[320px] rounded-2xl overflow-hidden">
                <div className="h-36 bg-av-card/40 animate-pulse" />
                <div className="p-4 bg-av-card/30">
                  <div className="h-4 w-3/4 rounded bg-av-card/50 animate-pulse mb-2" />
                  <div className="h-3 w-1/2 rounded bg-av-card/40 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live now skeleton */}
      <section className="py-10 lg:py-14">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="h-6 w-48 rounded bg-av-card/60 animate-pulse mb-6" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex-shrink-0 w-[220px] sm:w-[260px] rounded-xl overflow-hidden">
                <div className="h-32 bg-av-card/40 animate-pulse" />
                <div className="p-3 bg-av-card/30">
                  <div className="h-3 w-3/4 rounded bg-av-card/50 animate-pulse mb-1" />
                  <div className="h-2.5 w-1/2 rounded bg-av-card/40 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

async function HomepageContent() {
  const homepage = await getHomepageContent();

  if (!homepage?.sections?.length) {
    return (
      <>
        <HeroToggleWrapper>
          <HeroSlider />
        </HeroToggleWrapper>
        <FeaturedChannels />
        <MySubscriptionsRow />
        <RecentlyViewedRow />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4"><BannerAd placement="home" /></div>
        <LiveNowRow />
        <UpcomingShows />
        <ChallengeSection />
        <UpdatesSection />
      </>
    );
  }

  const sorted = homepage.sections
    .filter((section) => section.enabled)
    .sort((left, right) => left.sort_order - right.sort_order);

  return (
    <>
      {sorted.map((section, i) => (
        <div key={section.key}>
          {section.key === "hero" ? (
            <HeroToggleWrapper>{renderSection(section)}</HeroToggleWrapper>
          ) : (
            renderSection(section)
          )}
          {section.key === "featured_channels" && (
            <>
              <MySubscriptionsRow />
              <RecentlyViewedRow />
            </>
          )}
          {i === 1 && <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4"><BannerAd placement="home" /></div>}
        </div>
      ))}
    </>
  );
}

export default function Home() {
  return (
    <>
      <PromoModal />
      <GracePeriodBanner />
      <Suspense fallback={<HomepageSkeleton />}>
        <HomepageContent />
      </Suspense>
    </>
  );
}
