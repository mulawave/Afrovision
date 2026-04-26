import { API_BASE } from "@/lib/api";

export interface ChallengeHeroStat {
  id: string;
  value: string;
  label: string;
}

export interface ChallengeTheme {
  id: string;
  icon: string;
  label: string;
  sort_order: number;
}

export interface ChallengeLifecyclePhase {
  id: string;
  icon: string;
  phase: string;
  subtitle: string;
  desc: string;
  status: string;
  sort_order: number;
}

export interface ChallengeUnstoppableItem {
  id: string;
  icon: string;
  title: string;
  desc: string;
  sort_order: number;
}

export interface ChallengeStructurePhase {
  id: string;
  ep: string;
  title: string;
  desc: string;
  sort_order: number;
}

export interface ChallengePrize {
  id: string;
  icon: string;
  place: string;
  amount: string;
  desc: string;
  sort_order: number;
}

export interface ChallengeJoinStep {
  id: string;
  step: string;
  title: string;
  desc: string;
  sort_order: number;
}

export interface ChallengePlatformFeature {
  id: string;
  icon: string;
  title: string;
  desc: string;
  sort_order: number;
}

export interface ChallengeFaq {
  id: string;
  q: string;
  a: string;
  sort_order: number;
}

export interface ChallengePageContent {
  page_meta_title: string;
  page_meta_description: string;
  hero_enabled: boolean;
  hero_badge_icon: string;
  hero_badge: string;
  hero_title_primary: string;
  hero_title_highlight: string;
  hero_intro: string;
  hero_note: string;
  hero_cta_label: string;
  hero_cta_href: string;
  hero_secondary_label: string;
  hero_secondary_href: string;
  hero_stats: ChallengeHeroStat[];
  season_enabled: boolean;
  season_eyebrow: string;
  season_title: string;
  season_description: string;
  themes: ChallengeTheme[];
  lifecycle_enabled: boolean;
  lifecycle_title: string;
  lifecycle_subtitle: string;
  lifecycle_current_badge_label: string;
  lifecycle_phase_prefix: string;
  lifecycle_phases: ChallengeLifecyclePhase[];
  unstoppable_enabled: boolean;
  unstoppable_title: string;
  unstoppable_subtitle: string;
  unstoppable_layout: string;
  unstoppable_text_align: string;
  unstoppable_items: ChallengeUnstoppableItem[];
  structure_enabled: boolean;
  structure_title: string;
  structure_subtitle: string;
  structure_phases: ChallengeStructurePhase[];
  prizes_enabled: boolean;
  prizes_title: string;
  prizes_subtitle: string;
  prizes: ChallengePrize[];
  join_enabled: boolean;
  join_title: string;
  join_subtitle: string;
  join_layout: string;
  join_single_item_position: string;
  join_steps: ChallengeJoinStep[];
  platform_enabled: boolean;
  platform_eyebrow: string;
  platform_title: string;
  platform_body: string;
  platform_features: ChallengePlatformFeature[];
  faq_enabled: boolean;
  faq_title: string;
  faq_subtitle: string;
  faqs: ChallengeFaq[];
  bottom_cta_enabled: boolean;
  bottom_cta_title: string;
  bottom_cta_body: string;
  bottom_cta_primary_label: string;
  bottom_cta_primary_href: string;
  bottom_cta_secondary_label: string;
  bottom_cta_secondary_href: string;
}

export async function getChallengePageContent(): Promise<ChallengePageContent | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE}/home/challenge-content`, {
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload?.content || null;
  } catch {
    return null;
  }
}
