const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');
const Channel = require('../channels/channel.model');
const Video = require('../broadcast/video.model');
const Program = require('../broadcast/program.model');
const StreamStats = require('../analytics/stream_stats.model');

const COLLECTION = 'site_design';
const DOC_ID = 'homepage';

const HERO_DEFAULTS = [
  {
    id: 'hero-1',
    enabled: true,
    sort_order: 1,
    type: 'live',
    icon: '🔴',
    subtitle: 'LIVE NOW',
    title: 'AfroBeats Friday Night',
    description:
      'The biggest Afrobeats DJs are live right now. Join the party, send gifts, and earn VPT while vibing with thousands of fans.',
    cta_label: 'Watch Live Now',
    cta_href: '/live',
    secondary_cta_label: 'Browse All Live',
    secondary_cta_href: '/live',
    image_url: null,
    linked_channel_id: null,
    channel_name: 'AfroBeats Live',
    is_live: true,
    viewers: 12400,
  },
  {
    id: 'hero-2',
    enabled: true,
    sort_order: 2,
    type: 'promo',
    icon: '🎬',
    subtitle: "Africa's Premier Streaming Platform",
    title: 'Watch. Earn. Connect.',
    description:
      "Join thousands of creators and viewers on the continent's most vibrant live streaming community. Earn VPT rewards while you watch.",
    cta_label: 'Explore Channels',
    cta_href: '/channels',
    secondary_cta_label: 'Download App',
    secondary_cta_href: '/download',
    image_url: null,
    linked_channel_id: null,
    channel_name: '',
    is_live: false,
    viewers: null,
  },
  {
    id: 'hero-3',
    enabled: true,
    sort_order: 3,
    type: 'challenge',
    icon: '🏆',
    subtitle: 'Season 1 — ₦5M+ Prize Pool',
    title: 'AfroVision Challenge',
    description:
      "Compete, stream, and win big. The continent's biggest creator challenge is live. 200+ contestants, 10 categories, real prizes.",
    cta_label: 'Join the Challenge',
    cta_href: '#challenge',
    secondary_cta_label: 'Watch Auditions',
    secondary_cta_href: '/challenge/auditions',
    image_url: null,
    linked_channel_id: null,
    channel_name: '',
    is_live: false,
    viewers: null,
  },
  {
    id: 'hero-4',
    enabled: true,
    sort_order: 4,
    type: 'live',
    icon: '🔴',
    subtitle: 'LIVE NOW',
    title: 'Tech Talk: AI in Africa',
    description:
      'Join the conversation about artificial intelligence and its impact on African tech ecosystems. Top speakers, real insights.',
    cta_label: 'Watch Live Now',
    cta_href: '/live',
    secondary_cta_label: 'Set Reminder',
    secondary_cta_href: '/schedule',
    image_url: null,
    linked_channel_id: null,
    channel_name: 'Tech Africa',
    is_live: true,
    viewers: 3200,
  },
];

const UPCOMING_DEFAULTS = [
  {
    id: 'show-1',
    enabled: true,
    sort_order: 1,
    title: 'AfroBeats Friday Night',
    channel: 'AfroBeats Live',
    category: 'Music',
    scheduled_at: new Date(Date.now() + 3 * 3600000).toISOString(),
    icon: '🎵',
  },
  {
    id: 'show-2',
    enabled: true,
    sort_order: 2,
    title: 'Tech Talk: AI in Africa',
    channel: 'Tech Africa',
    category: 'Technology',
    scheduled_at: new Date(Date.now() + 8 * 3600000).toISOString(),
    icon: '💻',
  },
  {
    id: 'show-3',
    enabled: true,
    sort_order: 3,
    title: 'Stand-Up Special: Lagos Laughs',
    channel: 'Lagos Comedy Club',
    category: 'Comedy',
    scheduled_at: new Date(Date.now() + 26 * 3600000).toISOString(),
    icon: '😂',
  },
  {
    id: 'show-4',
    enabled: true,
    sort_order: 4,
    title: 'Safari Sunset Stream',
    channel: 'Safari Streams',
    category: 'Nature',
    scheduled_at: new Date(Date.now() + 50 * 3600000).toISOString(),
    icon: '🦁',
  },
  {
    id: 'show-5',
    enabled: true,
    sort_order: 5,
    title: 'Amapiano Live Mix',
    channel: 'Amapiano Radio',
    category: 'Music',
    scheduled_at: new Date(Date.now() + 72 * 3600000).toISOString(),
    icon: '🎧',
  },
  {
    id: 'show-6',
    enabled: true,
    sort_order: 6,
    title: 'Startup Pitch Night',
    channel: 'Startup Hub',
    category: 'Business',
    scheduled_at: new Date(Date.now() + 96 * 3600000).toISOString(),
    icon: '🚀',
  },
];

const CHALLENGE_STATS_DEFAULTS = [
  { id: 'challenge-stat-1', enabled: true, sort_order: 1, label: 'Prize Pool', value: '₦5M+' },
  { id: 'challenge-stat-2', enabled: true, sort_order: 2, label: 'Contestants', value: '200+' },
  { id: 'challenge-stat-3', enabled: true, sort_order: 3, label: 'Categories', value: '10' },
  { id: 'challenge-stat-4', enabled: true, sort_order: 4, label: 'Days Left', value: '30' },
];

const UPDATE_DEFAULTS = [
  {
    id: 'update-1',
    enabled: true,
    sort_order: 1,
    title: 'Premium Streams Launched',
    summary:
      'Exclusive premium content is now available. Subscribe to channels for ad-free viewing and creator-only perks.',
    date: 'Mar 28, 2026',
    icon: '⭐',
    tag: 'New Feature',
  },
  {
    id: 'update-2',
    enabled: true,
    sort_order: 2,
    title: 'Creator Subscriptions Added',
    summary:
      'Support your favorite creators with monthly subscriptions. Unlock badges, emotes, and exclusive streams.',
    date: 'Mar 15, 2026',
    icon: '💎',
    tag: 'Monetization',
  },
  {
    id: 'update-3',
    enabled: true,
    sort_order: 3,
    title: 'Real-Time Gifting Upgraded',
    summary:
      'Send animated gifts during live streams. New gift tiers and effects make every stream more exciting.',
    date: 'Mar 02, 2026',
    icon: '🎁',
    tag: 'Enhancement',
  },
  {
    id: 'update-4',
    enabled: true,
    sort_order: 4,
    title: 'VPT Wallet Integration',
    summary:
      'Earn and spend VPT tokens across the platform. Seamless wallet experience with instant transfers.',
    date: 'Feb 18, 2026',
    icon: '💰',
    tag: 'Economy',
  },
  {
    id: 'update-5',
    enabled: true,
    sort_order: 5,
    title: 'Multi-Language Support',
    summary:
      'AfroVision now supports Swahili, Yoruba, Hausa, Zulu, French, and Portuguese alongside English.',
    date: 'Feb 05, 2026',
    icon: '🌐',
    tag: 'Platform',
  },
  {
    id: 'update-6',
    enabled: true,
    sort_order: 6,
    title: 'Enhanced Stream Quality',
    summary:
      'Adaptive bitrate streaming with up to 4K quality. Lower latency for real-time interactions.',
    date: 'Jan 20, 2026',
    icon: '📺',
    tag: 'Performance',
  },
];

const SOCIAL_LINK_DEFAULTS = [
  { id: 'social-twitter', platform: 'twitter', label: 'Twitter / X', url: '', icon_url: null, enabled: false, sort_order: 1 },
  { id: 'social-instagram', platform: 'instagram', label: 'Instagram', url: '', icon_url: null, enabled: false, sort_order: 2 },
  { id: 'social-youtube', platform: 'youtube', label: 'YouTube', url: '', icon_url: null, enabled: false, sort_order: 3 },
  { id: 'social-tiktok', platform: 'tiktok', label: 'TikTok', url: '', icon_url: null, enabled: false, sort_order: 4 },
  { id: 'social-facebook', platform: 'facebook', label: 'Facebook', url: '', icon_url: null, enabled: false, sort_order: 5 },
  { id: 'social-linkedin', platform: 'linkedin', label: 'LinkedIn', url: '', icon_url: null, enabled: false, sort_order: 6 },
];

const DEFAULT_DESIGN = {
  hero: {
    key: 'hero',
    enabled: true,
    sort_order: 1,
    auto_rotate_ms: 6000,
    slides: HERO_DEFAULTS,
  },
  featured_channels: {
    key: 'featured_channels',
    enabled: true,
    sort_order: 2,
    title: '🔥 Featured Channels',
    subtitle: 'Trending live and popular channels right now',
    cta_label: 'View All →',
    cta_href: '/channels',
    auto_slide: true,
    shuffle_items: false,
    items: [],
  },
  live_now: {
    key: 'live_now',
    enabled: true,
    sort_order: 3,
    badge_text: 'Live Now',
    title: 'Streams Happening Now',
    subtitle: 'Jump in before you miss out',
    cta_label: 'View All Live →',
    cta_href: '/live',
    auto_slide: true,
    shuffle_items: false,
    items: [],
  },
  upcoming_shows: {
    key: 'upcoming_shows',
    enabled: true,
    sort_order: 4,
    title: '📅 Upcoming Shows',
    subtitle: "Don't miss these live events — set a reminder",
    cta_label: 'Full Schedule →',
    cta_href: '/schedule',
    shuffle_items: false,
    items: UPCOMING_DEFAULTS,
  },
  challenge: {
    key: 'challenge',
    enabled: true,
    sort_order: 5,
    badge_icon: '🏆',
    badge_text: 'Season 1 — Now Open',
    title: 'AfroVision Challenge',
    highlight_text: 'Challenge',
    description:
      'Compete with creators across Africa. Stream your best content, grow your audience, and win prizes that launch careers. The stage is yours.',
    cta_label: '🚀 Join the Challenge',
    cta_href: '/challenge',
    secondary_cta_label: 'View Rules & Prizes',
    secondary_cta_href: '/challenge/rules',
    stats: CHALLENGE_STATS_DEFAULTS,
  },
  updates: {
    key: 'updates',
    enabled: true,
    sort_order: 6,
    title: '✨ Latest Updates',
    subtitle: "What's new on the platform — features, fixes, and milestones",
    cta_label: 'All Updates →',
    cta_href: '/updates',
    shuffle_items: false,
    items: UPDATE_DEFAULTS,
  },
  social_links: SOCIAL_LINK_DEFAULTS,
  branding: {
    logo_url: null,
    favicon_url: null,
  },
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_DESIGN));
}

function sanitizeText(value, fallback = '', maxLength = 280) {
  if (typeof value !== 'string') return fallback;
  let safe = value.replace(/<(script|style|object|embed|applet|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '');
  safe = safe.replace(/<\/?(?:script|style|iframe|object|embed|applet|form|input|button|textarea|select|option|meta|base|head|title|html|body|link)[^>]*>/gi, '');
  safe = safe.replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '');
  return safe.trim().slice(0, maxLength);
}

function sanitizeHref(value, fallback = '/') {
  const href = sanitizeText(value, fallback, 280);
  if (!href) return fallback;
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
  return fallback;
}

function normalizeBool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIsoDate(value, fallback) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
}

function sortByOrder(items) {
  return [...items].sort((left, right) => (left.sort_order || 0) - (right.sort_order || 0));
}

function withOrder(items) {
  return sortByOrder(items).map((item, index) => ({
    ...item,
    sort_order: index + 1,
  }));
}

function ensureId(value, prefix) {
  return sanitizeText(value, '', 80) || `${prefix}-${crypto.randomUUID()}`;
}

function normalizeHeroSlides(slides, defaults) {
  const source = Array.isArray(slides) ? slides : defaults;
  return withOrder(source.map((slide, index) => ({
    id: ensureId(slide?.id, 'hero'),
    enabled: normalizeBool(slide?.enabled, true),
    sort_order: normalizeNumber(slide?.sort_order, index + 1),
    type: sanitizeText(slide?.type, 'promo', 24),
    icon: sanitizeText(slide?.icon, '🎬', 32),
    subtitle: sanitizeText(slide?.subtitle, '', 120),
    title: sanitizeText(slide?.title, '', 180),
    description: sanitizeText(slide?.description, '', 420),
    cta_label: sanitizeText(slide?.cta_label, 'Learn More', 80),
    cta_href: sanitizeHref(slide?.cta_href, '/'),
    secondary_cta_label: sanitizeText(slide?.secondary_cta_label, '', 80),
    secondary_cta_href: sanitizeHref(slide?.secondary_cta_href, '/'),
    image_url: sanitizeText(slide?.image_url, '', 500) || null,
    linked_channel_id: sanitizeText(slide?.linked_channel_id, '', 80) || null,
    channel_name: sanitizeText(slide?.channel_name, '', 120),
    is_live: normalizeBool(slide?.is_live, false),
    viewers: slide?.viewers === null || slide?.viewers === undefined || slide?.viewers === ''
      ? null
      : Math.max(0, Math.round(normalizeNumber(slide?.viewers, 0))),
  })));
}

function normalizeChannelItems(items, defaults, key) {
  const source = Array.isArray(items) ? items : defaults;
  return withOrder(source.map((item, index) => ({
    id: ensureId(item?.id, key),
    enabled: normalizeBool(item?.enabled, true),
    sort_order: normalizeNumber(item?.sort_order, index + 1),
    channel_id: sanitizeText(item?.channel_id, '', 80),
    emoji: sanitizeText(item?.emoji, key === 'live' ? '🎬' : '', 32),
    title_override: sanitizeText(item?.title_override, '', 180),
  })).filter((item) => item.channel_id));
}

function normalizeUpcomingItems(items, defaults) {
  const source = Array.isArray(items) ? items : defaults;
  return withOrder(source.map((item, index) => ({
    id: ensureId(item?.id, 'show'),
    enabled: normalizeBool(item?.enabled, true),
    sort_order: normalizeNumber(item?.sort_order, index + 1),
    title: sanitizeText(item?.title, '', 180),
    channel: sanitizeText(item?.channel, '', 120),
    category: sanitizeText(item?.category, '', 80),
    scheduled_at: normalizeIsoDate(item?.scheduled_at, new Date(Date.now() + (index + 1) * 3600000).toISOString()),
    icon: sanitizeText(item?.icon, '🎬', 32),
  })));
}

function normalizeChallengeStats(items, defaults) {
  const source = Array.isArray(items) ? items : defaults;
  return withOrder(source.map((item, index) => ({
    id: ensureId(item?.id, 'challenge-stat'),
    enabled: normalizeBool(item?.enabled, true),
    sort_order: normalizeNumber(item?.sort_order, index + 1),
    label: sanitizeText(item?.label, '', 80),
    value: sanitizeText(item?.value, '', 80),
  })));
}

function normalizeUpdates(items, defaults) {
  const source = Array.isArray(items) ? items : defaults;
  return withOrder(source.map((item, index) => ({
    id: ensureId(item?.id, 'update'),
    enabled: normalizeBool(item?.enabled, true),
    sort_order: normalizeNumber(item?.sort_order, index + 1),
    title: sanitizeText(item?.title, '', 240),
    summary: sanitizeText(item?.summary, '', 700),
    date: sanitizeText(item?.date, '', 80),
    icon: sanitizeText(item?.icon, '✨', 32),
    tag: sanitizeText(item?.tag, '', 80),
  })));
}

function normalizeSocialLinks(items, defaults) {
  const source = Array.isArray(items) ? items : defaults;
  return withOrder(source.map((item, index) => {
    const platform = sanitizeText(item?.platform, 'custom', 48).toLowerCase();
    const defaultForPlatform = defaults.find((d) => d.platform === platform) || defaults[0] || { label: 'Custom' };
    return {
      id: ensureId(item?.id, 'social'),
      platform,
      label: sanitizeText(item?.label, defaultForPlatform.label || 'Custom', 80),
      url: sanitizeHref(item?.url, ''),
      icon_url: sanitizeHref(item?.icon_url, '') || null,
      enabled: normalizeBool(item?.enabled, false),
      sort_order: normalizeNumber(item?.sort_order, index + 1),
    };
  }));
}

function normalizeDesign(input) {
  const defaults = cloneDefaults();
  const source = input && typeof input === 'object' ? input : {};

  return {
    hero: {
      ...defaults.hero,
      enabled: normalizeBool(source.hero?.enabled, defaults.hero.enabled),
      sort_order: Math.max(1, Math.round(normalizeNumber(source.hero?.sort_order, defaults.hero.sort_order))),
      auto_rotate_ms: Math.max(3000, Math.round(normalizeNumber(source.hero?.auto_rotate_ms, defaults.hero.auto_rotate_ms))),
      slides: normalizeHeroSlides(source.hero?.slides, defaults.hero.slides),
    },
    featured_channels: {
      ...defaults.featured_channels,
      enabled: normalizeBool(source.featured_channels?.enabled, defaults.featured_channels.enabled),
      sort_order: Math.max(1, Math.round(normalizeNumber(source.featured_channels?.sort_order, defaults.featured_channels.sort_order))),
      title: sanitizeText(source.featured_channels?.title, defaults.featured_channels.title, 120),
      subtitle: sanitizeText(source.featured_channels?.subtitle, defaults.featured_channels.subtitle, 220),
      cta_label: sanitizeText(source.featured_channels?.cta_label, defaults.featured_channels.cta_label, 80),
      cta_href: sanitizeHref(source.featured_channels?.cta_href, defaults.featured_channels.cta_href),
      auto_slide: normalizeBool(source.featured_channels?.auto_slide, defaults.featured_channels.auto_slide),
      shuffle_items: normalizeBool(source.featured_channels?.shuffle_items, defaults.featured_channels.shuffle_items),
      items: normalizeChannelItems(source.featured_channels?.items, defaults.featured_channels.items, 'featured'),
    },
    live_now: {
      ...defaults.live_now,
      enabled: normalizeBool(source.live_now?.enabled, defaults.live_now.enabled),
      sort_order: Math.max(1, Math.round(normalizeNumber(source.live_now?.sort_order, defaults.live_now.sort_order))),
      badge_text: sanitizeText(source.live_now?.badge_text, defaults.live_now.badge_text, 80),
      title: sanitizeText(source.live_now?.title, defaults.live_now.title, 120),
      subtitle: sanitizeText(source.live_now?.subtitle, defaults.live_now.subtitle, 220),
      cta_label: sanitizeText(source.live_now?.cta_label, defaults.live_now.cta_label, 80),
      cta_href: sanitizeHref(source.live_now?.cta_href, defaults.live_now.cta_href),
      auto_slide: normalizeBool(source.live_now?.auto_slide, defaults.live_now.auto_slide),
      shuffle_items: normalizeBool(source.live_now?.shuffle_items, defaults.live_now.shuffle_items),
      items: normalizeChannelItems(source.live_now?.items, defaults.live_now.items, 'live'),
    },
    upcoming_shows: {
      ...defaults.upcoming_shows,
      enabled: normalizeBool(source.upcoming_shows?.enabled, defaults.upcoming_shows.enabled),
      sort_order: Math.max(1, Math.round(normalizeNumber(source.upcoming_shows?.sort_order, defaults.upcoming_shows.sort_order))),
      title: sanitizeText(source.upcoming_shows?.title, defaults.upcoming_shows.title, 120),
      subtitle: sanitizeText(source.upcoming_shows?.subtitle, defaults.upcoming_shows.subtitle, 220),
      cta_label: sanitizeText(source.upcoming_shows?.cta_label, defaults.upcoming_shows.cta_label, 80),
      cta_href: sanitizeHref(source.upcoming_shows?.cta_href, defaults.upcoming_shows.cta_href),
      shuffle_items: normalizeBool(source.upcoming_shows?.shuffle_items, defaults.upcoming_shows.shuffle_items),
      items: normalizeUpcomingItems(source.upcoming_shows?.items, defaults.upcoming_shows.items),
    },
    challenge: {
      ...defaults.challenge,
      enabled: normalizeBool(source.challenge?.enabled, defaults.challenge.enabled),
      sort_order: Math.max(1, Math.round(normalizeNumber(source.challenge?.sort_order, defaults.challenge.sort_order))),
      badge_icon: sanitizeText(source.challenge?.badge_icon, defaults.challenge.badge_icon, 32),
      badge_text: sanitizeText(source.challenge?.badge_text, defaults.challenge.badge_text, 120),
      title: sanitizeText(source.challenge?.title, defaults.challenge.title, 120),
      highlight_text: sanitizeText(source.challenge?.highlight_text, defaults.challenge.highlight_text, 80),
      description: sanitizeText(source.challenge?.description, defaults.challenge.description, 900),
      cta_label: sanitizeText(source.challenge?.cta_label, defaults.challenge.cta_label, 80),
      cta_href: sanitizeHref(source.challenge?.cta_href, defaults.challenge.cta_href),
      secondary_cta_label: sanitizeText(source.challenge?.secondary_cta_label, defaults.challenge.secondary_cta_label, 80),
      secondary_cta_href: sanitizeHref(source.challenge?.secondary_cta_href, defaults.challenge.secondary_cta_href),
      stats: normalizeChallengeStats(source.challenge?.stats, defaults.challenge.stats),
    },
    updates: {
      ...defaults.updates,
      enabled: normalizeBool(source.updates?.enabled, defaults.updates.enabled),
      sort_order: Math.max(1, Math.round(normalizeNumber(source.updates?.sort_order, defaults.updates.sort_order))),
      title: sanitizeText(source.updates?.title, defaults.updates.title, 120),
      subtitle: sanitizeText(source.updates?.subtitle, defaults.updates.subtitle, 220),
      cta_label: sanitizeText(source.updates?.cta_label, defaults.updates.cta_label, 80),
      cta_href: sanitizeHref(source.updates?.cta_href, defaults.updates.cta_href),
      shuffle_items: normalizeBool(source.updates?.shuffle_items, defaults.updates.shuffle_items),
      items: normalizeUpdates(source.updates?.items, defaults.updates.items),
    },
    social_links: normalizeSocialLinks(source.social_links, defaults.social_links),
    branding: normalizeBranding(source.branding),
  };
}

function normalizeBranding(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    logo_url: typeof source.logo_url === 'string' && source.logo_url.trim() ? sanitizeHref(source.logo_url.trim(), '') : null,
    favicon_url: typeof source.favicon_url === 'string' && source.favicon_url.trim() ? sanitizeHref(source.favicon_url.trim(), '') : null,
  };
}

function pickEnabled(items) {
  return sortByOrder(items.filter((item) => item.enabled !== false));
}

function shuffleIfNeeded(items, shouldShuffle) {
  if (!shouldShuffle) return items;
  return [...items].sort(() => Math.random() - 0.5);
}

function formatViewers(count) {
  return Math.max(0, Math.round(normalizeNumber(count, 0)));
}

async function pickChannel(channelId) {
  if (!channelId) return null;
  return await Channel.findById(channelId);
}

function getChannelBanner(channel, fallbackThumbnail) {
  return fallbackThumbnail || channel?.banner_url || null;
}

async function getLiveContext(channelId, contextCache) {
  const channel = await pickChannel(channelId);
  if (!channel) return null;

  if (contextCache?.has(channel.id)) {
    return contextCache.get(channel.id);
  }

  const activeStream = await StreamStats.getActiveByChannel(channel.id);
  const currentProgram = await Program.getCurrentProgram(channel.id);
  const nextPrograms = await Program.getUpcoming(channel.id, 1);
  const nextProgram = nextPrograms[0] || null;
  const latestVideo = currentProgram
    ? await Video.findById(currentProgram.video_id)
    : (await Video.getByChannel(channel.id))[0] || null;
  const currentVideo = currentProgram ? await Video.findById(currentProgram.video_id) : latestVideo;

  const context = {
    channel,
    activeStream,
    currentProgram,
    nextProgram,
    video: currentVideo,
    viewers: formatViewers(activeStream?.peak_viewers || activeStream?.total_viewers || 0),
    isLive: Boolean(activeStream || currentProgram),
  };

  contextCache?.set(channel.id, context);
  return context;
}

async function fallbackFeaturedChannels(contextCache) {
  const publicChannels = await Channel.getPublicChannels();
  const decorated = await Promise.all(publicChannels.map(async (channel) => {
    const liveContext = await getLiveContext(channel.id, contextCache);
    return {
      channel,
      viewers: liveContext?.viewers || 0,
      isLive: liveContext?.isLive || false,
    };
  }));

  return decorated
    .sort((left, right) => {
      if (left.isLive !== right.isLive) return left.isLive ? -1 : 1;
      if (left.viewers !== right.viewers) return right.viewers - left.viewers;
      return left.channel.name.localeCompare(right.channel.name);
    })
    .slice(0, 8)
    .map(({ channel }) => ({ channel_id: channel.id, enabled: true }));
}

async function fallbackLiveChannels(contextCache) {
  const publicChannels = await Channel.getPublicChannels();
  const liveCandidates = (await Promise.all(publicChannels
    .map(async (channel) => ({ channel, context: await getLiveContext(channel.id, contextCache) }))))
    .filter(({ context }) => context?.isLive)
    .sort((left, right) => (right.context?.viewers || 0) - (left.context?.viewers || 0));

  if (liveCandidates.length > 0) {
    return liveCandidates.slice(0, 8).map(({ channel }) => ({
      channel_id: channel.id,
      enabled: true,
      emoji: categoryEmoji(channel.category),
      title_override: '',
    }));
  }

  return (await fallbackFeaturedChannels(contextCache)).slice(0, 8).map((item) => ({
    ...item,
    emoji: '🎬',
    title_override: '',
  }));
}

function categoryEmoji(category) {
  const key = sanitizeText(category, '', 80).toLowerCase();
  const map = {
    music: '🎵',
    technology: '💻',
    tech: '💻',
    comedy: '😂',
    nature: '🦁',
    entertainment: '🎤',
    business: '🚀',
    lifestyle: '✨',
    news: '📰',
  };
  return map[key] || '🎬';
}

async function resolveHeroSlides(section, contextCache) {
  return Promise.all(pickEnabled(section.slides).map(async (slide) => {
    const liveContext = slide.linked_channel_id ? await getLiveContext(slide.linked_channel_id, contextCache) : null;
    const channel = liveContext?.channel || null;

    return {
      id: slide.id,
      type: slide.type,
      icon: slide.icon,
      subtitle: slide.subtitle,
      title: slide.title,
      description: slide.description,
      cta: {
        label: slide.cta_label,
        href: slide.cta_href === '/live' && channel ? `/live/${channel.id}` : slide.cta_href,
      },
      secondary_cta: slide.secondary_cta_label
        ? {
            label: slide.secondary_cta_label,
            href: slide.secondary_cta_href === '/live' && channel ? `/live/${channel.id}` : slide.secondary_cta_href,
          }
        : null,
      image_url: slide.image_url || getChannelBanner(channel, liveContext?.video?.thumbnail_url) || null,
      is_live: slide.is_live,
      viewers: slide.viewers ?? liveContext?.viewers ?? null,
      channel_name: slide.channel_name || channel?.name || '',
    };
  }));
}

async function resolveFeaturedItems(section, contextCache) {
  const configuredItems = pickEnabled(section.items);
  const sourceItems = configuredItems.length > 0 ? configuredItems : await fallbackFeaturedChannels(contextCache);

  const resolved = await Promise.all(shuffleIfNeeded(sourceItems, section.shuffle_items)
    .map(async (item) => {
      const channel = await pickChannel(item.channel_id);
      if (!channel) return null;
      const liveContext = await getLiveContext(channel.id, contextCache);

      return {
        id: item.id || channel.id,
        channel_id: channel.id,
        name: channel.name,
        category: channel.category || 'General',
        viewers: liveContext?.viewers || 0,
        is_live: liveContext?.isLive || false,
        href: `/channel/${channel.id}`,
        banner_url: getChannelBanner(channel, null),
        logo_url: channel.logo_url || null,
      };
    }));

  return resolved.filter(Boolean);
}

async function resolveLiveItems(section, contextCache) {
  const configuredItems = pickEnabled(section.items);
  const sourceItems = configuredItems.length > 0 ? configuredItems : await fallbackLiveChannels(contextCache);

  const resolved = await Promise.all(shuffleIfNeeded(sourceItems, section.shuffle_items)
    .map(async (item) => {
      const liveContext = await getLiveContext(item.channel_id, contextCache);
      const channel = liveContext?.channel || await pickChannel(item.channel_id);
      if (!channel) return null;

      return {
        id: item.id || channel.id,
        channel_id: channel.id,
        title: item.title_override || liveContext?.video?.title || channel.name,
        channel: channel.name,
        category: channel.category || 'General',
        viewers: liveContext?.viewers || 0,
        emoji: item.emoji || categoryEmoji(channel.category),
        href: `/live/${channel.id}`,
        banner_url: getChannelBanner(channel, liveContext?.video?.thumbnail_url),
        logo_url: channel.logo_url || null,
      };
    }));

  return resolved.filter(Boolean);
}

function resolveUpcomingItems(section) {
  return shuffleIfNeeded(pickEnabled(section.items), section.shuffle_items).map((item) => ({
    id: item.id,
    title: item.title,
    channel: item.channel,
    category: item.category,
    scheduled_at: item.scheduled_at,
    icon: item.icon,
  }));
}

function resolveChallengeSection(section) {
  return {
    ...section,
    stats: pickEnabled(section.stats).map((item) => ({
      id: item.id,
      label: item.label,
      value: item.value,
    })),
  };
}

function resolveUpdates(section) {
  return shuffleIfNeeded(pickEnabled(section.items), section.shuffle_items).map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    date: item.date,
    icon: item.icon,
    tag: item.tag,
  }));
}

async function getStoredDesign() {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
  return data.design || null;
}

async function getAdminHomepageDesign() {
  const stored = await getStoredDesign();
  return normalizeDesign(stored);
}

async function saveHomepageDesign(design, actor = 'system') {
  const normalized = normalizeDesign(design);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(DOC_ID).set({
    design: normalized,
    updated_at: Date.now(),
    updated_by: actor,
  });
  return normalized;
}

async function getPublicHomepageContent() {
  const design = await getAdminHomepageDesign();
  const contextCache = new Map();

  return {
    updated_at: Date.now(),
    sections: [
      {
        key: 'hero',
        enabled: design.hero.enabled,
        sort_order: design.hero.sort_order,
        auto_rotate_ms: design.hero.auto_rotate_ms,
        slides: await resolveHeroSlides(design.hero, contextCache),
      },
      {
        key: 'featured_channels',
        enabled: design.featured_channels.enabled,
        sort_order: design.featured_channels.sort_order,
        title: design.featured_channels.title,
        subtitle: design.featured_channels.subtitle,
        cta_label: design.featured_channels.cta_label,
        cta_href: design.featured_channels.cta_href,
        auto_slide: design.featured_channels.auto_slide,
        shuffle_items: design.featured_channels.shuffle_items,
        items: await resolveFeaturedItems(design.featured_channels, contextCache),
      },
      {
        key: 'live_now',
        enabled: design.live_now.enabled,
        sort_order: design.live_now.sort_order,
        badge_text: design.live_now.badge_text,
        title: design.live_now.title,
        subtitle: design.live_now.subtitle,
        cta_label: design.live_now.cta_label,
        cta_href: design.live_now.cta_href,
        auto_slide: design.live_now.auto_slide,
        shuffle_items: design.live_now.shuffle_items,
        items: await resolveLiveItems(design.live_now, contextCache),
      },
      {
        key: 'upcoming_shows',
        enabled: design.upcoming_shows.enabled,
        sort_order: design.upcoming_shows.sort_order,
        title: design.upcoming_shows.title,
        subtitle: design.upcoming_shows.subtitle,
        cta_label: design.upcoming_shows.cta_label,
        cta_href: design.upcoming_shows.cta_href,
        items: resolveUpcomingItems(design.upcoming_shows),
      },
      {
        key: 'challenge',
        enabled: design.challenge.enabled,
        sort_order: design.challenge.sort_order,
        ...resolveChallengeSection(design.challenge),
      },
      {
        key: 'updates',
        enabled: design.updates.enabled,
        sort_order: design.updates.sort_order,
        title: design.updates.title,
        subtitle: design.updates.subtitle,
        cta_label: design.updates.cta_label,
        cta_href: design.updates.cta_href,
        items: resolveUpdates(design.updates),
      },
    ].sort((left, right) => left.sort_order - right.sort_order),
    social_links: pickEnabled(design.social_links).map((link) => ({
      platform: link.platform,
      label: link.label,
      url: link.url,
      icon_url: link.icon_url || null,
    })),
    branding: design.branding || { logo_url: null, favicon_url: null },
  };
}

module.exports = {
  cloneDefaults,
  normalizeDesign,
  getAdminHomepageDesign,
  saveHomepageDesign,
  getPublicHomepageContent,
};