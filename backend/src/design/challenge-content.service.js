const { getFirestore } = require('../utils/firestore');
const Challenge = require('../challenge/challenge.model');

const COLLECTION = 'site_content';
const DOC_ID = 'challenge_page';

const DEFAULT_CONTENT = {
  page_meta_title: 'AfroVision Challenge: Amazons - Build. Compete. Win.',
  page_meta_description:
    "AfroVision Challenge: Amazons - a high-stakes entrepreneurial reality competition where Nigeria's most promising individuals are transformed into business leaders under real funding, real stakes, and national visibility.",
  hero_enabled: true,
  hero_badge_icon: '🏆',
  hero_badge: 'Pitch 1 — Amazons',
  hero_title_primary: 'AfroVision',
  hero_title_highlight: 'Challenge',
  hero_intro:
    "A high-stakes entrepreneurial reality competition where Nigeria's most promising individuals are transformed into business leaders under intense pressure, real funding conditions, and national visibility.",
  hero_note:
    'This is not theory. This is not classroom learning. This is real-world business creation under fire.',
  hero_cta_label: 'Create Account to Join',
  hero_cta_href: '/register',
  hero_secondary_label: 'View Full Rules',
  hero_secondary_href: '/challenge/rules',
  hero_stats: [
    { id: 'hero-stat-1', value: '10M+', label: 'Prize Pool', sort_order: 1 },
    { id: 'hero-stat-2', value: '14-15', label: 'Contestants', sort_order: 2 },
    { id: 'hero-stat-3', value: '12+', label: 'Episodes', sort_order: 3 },
    { id: 'hero-stat-4', value: 'Free', label: 'Entry', sort_order: 4 },
  ],
  season_eyebrow: 'Season Identity',
  season_enabled: true,
  season_title: 'The Amazons',
  season_description:
    "This isn't just a name. Core themes of female strength, economic independence, leadership under pressure, and collaboration.",
  themes: [
    { id: 'theme-1', icon: '💪', label: 'Female Strength', sort_order: 1 },
    { id: 'theme-2', icon: '💸', label: 'Economic Independence', sort_order: 2 },
    { id: 'theme-3', icon: '👩‍💼', label: 'Leadership Under Pressure', sort_order: 3 },
    { id: 'theme-4', icon: '🤝', label: 'Collaboration vs Ego', sort_order: 4 },
    { id: 'theme-5', icon: '🌍', label: 'African Excellence', sort_order: 5 },
    { id: 'theme-6', icon: '🏢', label: 'Real Business Creation', sort_order: 6 },
  ],
  lifecycle_title: 'Challenge Lifecycle',
  lifecycle_enabled: true,
  lifecycle_subtitle: 'Each challenge progresses through four distinct phases',
  lifecycle_current_badge_label: 'Current Phase',
  lifecycle_phase_prefix: 'Phase',
  lifecycle_phases: [
    {
      id: 'phase-1',
      icon: '📋',
      phase: 'Registration',
      subtitle: 'Open Call',
      desc: 'Create your verified AfroVision account and submit a short pitch video.',
      status: 'active',
      sort_order: 1,
    },
    {
      id: 'phase-2',
      icon: '🎭',
      phase: 'Audition',
      subtitle: 'Screening & Selection',
      desc: 'Submissions are screened and finalists are announced publicly.',
      status: 'upcoming',
      sort_order: 2,
    },
    {
      id: 'phase-3',
      icon: '🎬',
      phase: 'Running',
      subtitle: 'Live Competition',
      desc: 'Finalists compete, build, defend, and prove ideas under pressure.',
      status: 'upcoming',
      sort_order: 3,
    },
    {
      id: 'phase-4',
      icon: '🏆',
      phase: 'Completed',
      subtitle: 'Cooling Off & Launch',
      desc: 'Winners are rewarded and supported as businesses launch publicly.',
      status: 'upcoming',
      sort_order: 4,
    },
  ],
  unstoppable_title: 'What Makes It Unstoppable',
  unstoppable_enabled: true,
  unstoppable_subtitle: 'No other African show is doing this',
  unstoppable_layout: 'grid',
  unstoppable_text_align: 'left',
  unstoppable_items: [
    {
      id: 'unstoppable-1',
      icon: '🎲',
      title: 'Randomized Destiny',
      desc: 'Nobody comes with a pre-built idea. Business concepts are assigned randomly.',
      sort_order: 1,
    },
    {
      id: 'unstoppable-2',
      icon: '💰',
      title: 'Real Stakes',
      desc: 'High-stakes competition with funding and national visibility.',
      sort_order: 2,
    },
    {
      id: 'unstoppable-3',
      icon: '🧠',
      title: 'AI Simulation Engine',
      desc: 'Businesses are stress-tested over simulated years.',
      sort_order: 3,
    },
  ],
  structure_title: 'Show Structure',
  structure_enabled: true,
  structure_subtitle: 'How the season unfolds across episodes',
  structure_phases: [
    { id: 'structure-1', ep: 'Ep 1-2', title: 'Selection & Assignment', desc: 'Contestants introduced and assigned ideas.', sort_order: 1 },
    { id: 'structure-2', ep: 'Ep 3-5', title: 'Immersion & Foundation', desc: 'Crash learning and early simulations.', sort_order: 2 },
    { id: 'structure-3', ep: 'Ep 6-8', title: 'Build & Strategize', desc: 'Financial models and strategy refinement.', sort_order: 3 },
    { id: 'structure-4', ep: 'Final', title: 'The Merge', desc: 'Finalists build one company together.', sort_order: 4 },
  ],
  prizes_title: 'Prizes & Rewards',
  prizes_enabled: true,
  prizes_subtitle: 'On this show, even losing is winning',
  prizes: [
    { id: 'prize-1', icon: '👑', place: 'Grand Winner', amount: '10,000,000', desc: 'Seed funding + national visibility', sort_order: 1 },
    { id: 'prize-2', icon: '🥈', place: 'Runner Up', amount: '3,000,000', desc: 'Incubation and brand deals', sort_order: 2 },
    { id: 'prize-3', icon: '🥉', place: '3rd Place', amount: '1,500,000', desc: 'Grant and introductions', sort_order: 3 },
  ],
  join_title: 'How To Join',
  join_enabled: true,
  join_subtitle: 'Four simple steps to enter the competition',
  join_layout: 'grid',
  join_single_item_position: 'auto',
  join_steps: [
    { id: 'join-step-1', step: '1', title: 'Register', desc: 'Create your account and verify your email.', sort_order: 1 },
    { id: 'join-step-2', step: '2', title: 'Record', desc: 'Film a short pitch video.', sort_order: 2 },
    { id: 'join-step-3', step: '3', title: 'Submit', desc: 'Upload your pitch on the challenge flow.', sort_order: 3 },
    { id: 'join-step-4', step: '4', title: 'Engage', desc: 'Share and grow engagement.', sort_order: 4 },
  ],
  platform_eyebrow: 'Platform Integration',
  platform_enabled: true,
  platform_title: 'More Than A Show',
  platform_body:
    'AfroVision Challenge connects content, community, and entrepreneurship into one ecosystem.',
  platform_features: [
    { id: 'platform-1', icon: '📺', title: 'Watch Inside App', desc: 'Episodes stream on AfroVision.', sort_order: 1 },
    { id: 'platform-2', icon: '👤', title: 'Follow Contestants', desc: 'Support your favourites with engagement.', sort_order: 2 },
    { id: 'platform-3', icon: '💬', title: 'Join Discussions', desc: 'Real-time chat for episodes.', sort_order: 3 },
    { id: 'platform-4', icon: '📚', title: 'Learn Business', desc: 'Business lessons tied to episodes.', sort_order: 4 },
  ],
  faq_title: 'Frequently Asked Questions',
  faq_enabled: true,
  faq_subtitle: 'Everything you need to know',
  faqs: [
    { id: 'faq-1', q: 'How do I join the Challenge?', a: 'Create an account and complete registration steps.', sort_order: 1 },
    { id: 'faq-2', q: 'What is the pitch requirement?', a: 'Submit a short business pitch video.', sort_order: 2 },
  ],
  bottom_cta_title: 'Ready to Build Your Empire?',
  bottom_cta_enabled: true,
  bottom_cta_body: 'Create your account and submit your pitch when registration opens.',
  bottom_cta_primary_label: 'Create Account Now',
  bottom_cta_primary_href: '/register',
  bottom_cta_secondary_label: 'Read Full Rules',
  bottom_cta_secondary_href: '/challenge/rules',
};

function sanitizeText(value, fallback = '', maxLength = 400) {
  if (typeof value !== 'string') return fallback;
  let safe = value.replace(/<(script|style|object|embed|applet|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '');
  safe = safe.replace(/<\/?(?:script|style|iframe|object|embed|applet|form|input|button|textarea|select|option|meta|base|head|title|html|body|link)[^>]*>/gi, '');
  safe = safe.replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '');
  return safe.trim().slice(0, maxLength);
}

function sanitizeHref(value, fallback = '/') {
  const href = sanitizeText(value, fallback, 320);
  if (!href) return fallback;
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    return href;
  }
  return fallback;
}

function ensureId(value, prefix) {
  const text = sanitizeText(value, '', 80);
  if (text) return text;
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function isLongTextKey(keyName = '') {
  return (
    keyName.includes('intro')
    || keyName.includes('note')
    || keyName.includes('desc')
    || keyName.includes('body')
    || keyName.includes('summary')
    || keyName.includes('subtitle')
    || keyName.includes('faq')
  );
}

function isIdKey(keyName = '') {
  return keyName === 'id';
}

function isUrlKey(keyName = '') {
  return keyName.endsWith('href') || keyName === 'href';
}

function isSortKey(keyName = '') {
  return keyName === 'sort_order';
}

function normalizeWithTemplate(template, input, keyName = '', index = 0) {
  if (Array.isArray(template)) {
    const source = Array.isArray(input) ? input : template;
    const itemTemplate = template[0];
    if (itemTemplate === undefined) return [];

    return source
      .map((item, itemIndex) => normalizeWithTemplate(itemTemplate, item, keyName, itemIndex))
      .filter((item) => {
        if (!item || typeof item !== 'object') return true;
        return Object.entries(item).some(([field, value]) => {
          if (field === 'id' || field === 'sort_order') return false;
          return typeof value !== 'string' || value.length > 0;
        });
      })
      .map((item, itemIndex) => {
        if (item && typeof item === 'object') {
          return {
            ...item,
            sort_order: itemIndex + 1,
          };
        }
        return item;
      });
  }

  if (template && typeof template === 'object') {
    const source = input && typeof input === 'object' ? input : {};
    const next = {};
    for (const [childKey, childTemplate] of Object.entries(template)) {
      next[childKey] = normalizeWithTemplate(childTemplate, source[childKey], childKey, index);
    }
    return next;
  }

  if (typeof template === 'string') {
    if (isIdKey(keyName)) {
      return ensureId(input, keyName || 'item');
    }
    if (isUrlKey(keyName)) {
      return sanitizeHref(input, template || '/');
    }
    return sanitizeText(input, template, isLongTextKey(keyName) ? 2000 : 300);
  }

  if (typeof template === 'number') {
    if (isSortKey(keyName)) return index + 1;
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : template;
  }

  return input ?? template;
}

function normalizeContent(input) {
  return normalizeWithTemplate(DEFAULT_CONTENT, input);
}

async function getStoredContent() {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
  return data.content || null;
}

async function getAdminChallengeContent() {
  const stored = await getStoredContent();
  return normalizeContent(stored);
}

async function saveChallengeContent(content, actor = 'system') {
  const normalized = normalizeContent(content);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(DOC_ID).set({
    content: normalized,
    updated_at: Date.now(),
    updated_by: actor,
  });
  return normalized;
}

async function getPublicChallengeContent() {
  const activeChallenge = await Challenge.getActiveChallenge();
  const content = await getAdminChallengeContent();
  
  // If no active challenge, disable registration-related sections
  if (!activeChallenge) {
    return {
      ...content,
      hero_enabled: false,
      join_enabled: false,
      bottom_cta_enabled: false,
      lifecycle_enabled: false,
      season_enabled: false,
      unstoppable_enabled: false,
      structure_enabled: false,
      prizes_enabled: false,
      platform_enabled: false,
      faq_enabled: false,
      no_active_challenge: true,
    };
  }
  
  return {
    ...content,
    no_active_challenge: false,
  };
}

module.exports = {
  getAdminChallengeContent,
  saveChallengeContent,
  getPublicChallengeContent,
};
