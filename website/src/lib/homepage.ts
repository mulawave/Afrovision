import { API_BASE } from "@/lib/api";

export interface HomepageHeroSlide {
  id: string;
  type: string;
  icon: string;
  subtitle: string;
  title: string;
  description: string;
  cta: {
    label: string;
    href: string;
  };
  secondary_cta: {
    label: string;
    href: string;
  } | null;
  image_url: string | null;
  is_live: boolean;
  viewers: number | null;
  channel_name: string;
}

export interface HomepageHeroSection {
  key: "hero";
  enabled: boolean;
  sort_order: number;
  auto_rotate_ms: number;
  slides: HomepageHeroSlide[];
}

export interface HomepageFeaturedItem {
  id: string;
  channel_id: string;
  name: string;
  category: string;
  viewers: number;
  is_live: boolean;
  href: string;
  banner_url: string | null;
  logo_url: string | null;
}

export interface HomepageFeaturedSection {
  key: "featured_channels";
  enabled: boolean;
  sort_order: number;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  auto_slide: boolean;
  shuffle_items: boolean;
  items: HomepageFeaturedItem[];
}

export interface HomepageLiveItem {
  id: string;
  channel_id: string;
  title: string;
  channel: string;
  category: string;
  viewers: number;
  emoji: string;
  href: string;
  banner_url: string | null;
  logo_url: string | null;
}

export interface HomepageLiveSection {
  key: "live_now";
  enabled: boolean;
  sort_order: number;
  badge_text: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  auto_slide: boolean;
  shuffle_items: boolean;
  items: HomepageLiveItem[];
}

export interface HomepageUpcomingItem {
  id: string;
  title: string;
  channel: string;
  category: string;
  scheduled_at: string;
  icon: string;
}

export interface HomepageUpcomingSection {
  key: "upcoming_shows";
  enabled: boolean;
  sort_order: number;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  items: HomepageUpcomingItem[];
}

export interface HomepageChallengeStat {
  id: string;
  label: string;
  value: string;
}

export interface HomepageChallengeSection {
  key: "challenge";
  enabled: boolean;
  sort_order: number;
  badge_icon: string;
  badge_text: string;
  title: string;
  highlight_text: string;
  description: string;
  cta_label: string;
  cta_href: string;
  secondary_cta_label: string;
  secondary_cta_href: string;
  stats: HomepageChallengeStat[];
}

export interface HomepageUpdateItem {
  id: string;
  title: string;
  summary: string;
  date: string;
  icon: string;
  tag: string;
}

export interface HomepageUpdatesSection {
  key: "updates";
  enabled: boolean;
  sort_order: number;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  items: HomepageUpdateItem[];
}

export type HomepageSection =
  | HomepageHeroSection
  | HomepageFeaturedSection
  | HomepageLiveSection
  | HomepageUpcomingSection
  | HomepageChallengeSection
  | HomepageUpdatesSection;

export interface HomepageSocialLink {
  platform: string;
  label: string;
  url: string;
}

export interface HomepageBranding {
  logo_url: string | null;
  favicon_url: string | null;
}

export interface HomepageContent {
  updated_at: number;
  sections: HomepageSection[];
  social_links?: HomepageSocialLink[];
  branding?: HomepageBranding;
}

export interface AppLinkConfig {
  android: {
    enabled: boolean;
    package_name: string;
    sha256_cert_fingerprints: string[];
    play_store_url: string;
  };
  ios: {
    enabled: boolean;
    team_id: string;
    bundle_id: string;
  };
  paths: string[];
}

export async function getHomepageContent(): Promise<HomepageContent | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE}/home/content`, {
      next: { revalidate: 60 },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload?.homepage || null;
  } catch {
    return null;
  }
}

export async function getBranding(): Promise<HomepageBranding> {
  try {
    const content = await getHomepageContent();
    if (content?.branding) {
      return {
        logo_url: content.branding.logo_url ? resolveAssetUrl(content.branding.logo_url) : null,
        favicon_url: content.branding.favicon_url ? resolveAssetUrl(content.branding.favicon_url) : null,
      };
    }
  } catch {
    // fall through
  }
  return { logo_url: null, favicon_url: null };
}

export async function getAppLinkConfig(): Promise<AppLinkConfig> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE}/home/app-links`, {
      next: { revalidate: 60 },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch app-link config: ${response.status}`);
    }

    return await response.json();
  } catch {
    return {
      android: {
        enabled: false,
        package_name: 'com.afrovision.afrovision',
        sha256_cert_fingerprints: [],
        play_store_url: '',
      },
      ios: {
        enabled: false,
        team_id: '',
        bundle_id: 'com.afrovision.afrovision',
      },
      paths: ['/reset-password*'],
    };
  }
}

function resolveAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return API_BASE ? `${API_BASE}${path}` : path;
}