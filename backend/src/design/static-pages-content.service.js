const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'site_content';
const DOC_PREFIX = 'page_';

const ALLOWED_SLUGS = ['about', 'careers', 'press', 'contact', 'updates'];

const DEFAULTS = {
  about: {
    eyebrow: 'Our Story',
    title: 'About AfroVision',
    intro:
      "AfroVision is Africa's premier live streaming platform — built to amplify African creators, connect vibrant communities, and reward everyone who participates.",
    mission_title: 'Our Mission',
    mission_body:
      'We believe the next generation of global entertainment will come from Africa. AfroVision exists to give African creators the stage, tools, and economic infrastructure they need to build sustainable careers — while rewarding viewers for their attention and participation.',
    values_title: 'What We Stand For',
    values: [
      { icon: '🌍', title: 'Africa First', desc: 'Built by Africans, for Africans — and open to the world.' },
      { icon: '💡', title: 'Creator Economy', desc: 'Every creator deserves fair compensation, powerful tools, and direct access to their audience.' },
      { icon: '🤝', title: 'Community', desc: 'Live streaming is social. We build for real-time connection, not passive consumption.' },
      { icon: '💰', title: 'Shared Value', desc: 'When the platform wins, creators and viewers win too — through vPT rewards and transparent economics.' },
    ],
    cta_title: 'Ready to join AfroVision?',
    cta_body: 'Start watching, earning, and creating today.',
    cta_label: 'Get Started',
    cta_href: '/register',
  },
  careers: {
    eyebrow: 'Join Us',
    title: 'Careers at AfroVision',
    intro:
      "We're building Africa's premier live streaming platform. If you're passionate about creators, community, and cutting-edge technology — we want to hear from you.",
    perks_title: 'Why AfroVision?',
    perks: [
      { icon: '🌍', text: 'Remote-first — work from anywhere in Africa' },
      { icon: '📈', text: 'Early-stage equity and growth opportunity' },
      { icon: '🔥', text: 'Direct impact on millions of African creators' },
      { icon: '🧰', text: 'Modern stack — Flutter, Next.js, Node, GCP' },
    ],
    open_roles_title: 'Open Positions',
    open_roles_body:
      "We don't have any open positions right now, but we're always looking for exceptional talent. Send your CV and a note about what excites you about AfroVision to:",
    careers_email: 'careers@afrovision.online',
  },
  press: {
    eyebrow: 'Media',
    title: 'Press & Media',
    intro: 'For press inquiries, interviews, and media resources, please reach out to our communications team.',
    press_contact_title: 'Press Contact',
    press_contact_body: 'For all media and press inquiries, please contact:',
    press_email: 'press@afrovision.online',
    about_title: 'About AfroVision',
    about_paragraphs: [
      "AfroVision is Africa's premier live streaming platform, connecting creators with audiences through live entertainment, interactive features, and a viewer reward economy powered by vPT tokens.",
      "Founded with the mission to amplify African voices and stories, AfroVision provides creators with powerful broadcast tools, direct monetization, and a global stage — while rewarding viewers for their engagement.",
    ],
  },
  contact: {
    eyebrow: 'Get in Touch',
    title: 'Contact Us',
    intro: 'Have a question, partnership proposal, or need help? Reach out using any of the channels below.',
    contacts: [
      { icon: '📨', title: 'General Inquiries', detail: 'hello@afrovision.online', href: 'mailto:hello@afrovision.online' },
      { icon: '🛠️', title: 'Support', detail: 'support@afrovision.online', href: 'mailto:support@afrovision.online' },
      { icon: '🤝', title: 'Partnerships', detail: 'partners@afrovision.online', href: 'mailto:partners@afrovision.online' },
      { icon: '📰', title: 'Press & Media', detail: 'press@afrovision.online', href: 'mailto:press@afrovision.online' },
    ],
    social_cta_title: 'Prefer social media?',
    social_cta_body: 'Follow us on our social channels for updates and direct messages.',
    social_links: [
      { label: 'Twitter', href: 'https://twitter.com/AfroVisionTV' },
      { label: 'Instagram', href: 'https://instagram.com/AfroVisionTV' },
    ],
  },
  updates: {
    eyebrow: "What's New",
    title: 'Platform Updates',
    intro:
      "The latest features, improvements, and milestones on AfroVision. We ship often — here's what's changed.",
    contact_title: 'Want to suggest a feature or report a bug?',
    contact_cta_label: 'Get in Touch',
    contact_cta_href: '/contact',
    items: [
      {
        date: 'April 4, 2026',
        tag: 'Legal',
        tone: 'purple',
        icon: '📜',
        title: 'Comprehensive Legal Policies Published',
        summary:
          "We've published full, Google-compliant legal policies including Terms of Service, Privacy Policy, Cookie Policy, Anti-Money Laundering Policy, Refund Policy, and Copyright Infringement Policy.",
        details: [
          'Terms of Service — 20 sections covering all platform rules, vPT tokens, payments, and dispute resolution.',
          'Privacy Policy — 13 sections with GDPR-style user rights, data retention timelines, and sponsor data sharing clause.',
          'Cookie Policy — 9 sections explaining all cookie types, third-party cookies, and management options.',
          'Anti-Money Laundering Policy — 14 sections covering KYC, transaction monitoring, and sanctions screening.',
          'Refund Policy — 11 sections with 48-hour cooling-off, vPT exceptions, and clear refund process.',
          'Copyright Infringement Policy — 11 sections with DMCA takedown process and counter-notification procedure.',
        ],
      },
      {
        date: 'April 4, 2026',
        tag: 'Security',
        tone: 'red',
        icon: '🔒',
        title: 'CAPTCHA Protection on Login & Registration',
        summary:
          "We've added Google reCAPTCHA verification to both login and registration forms, along with mandatory terms acceptance before account creation.",
        details: [],
      },
      {
        date: 'April 4, 2026',
        tag: 'New Feature',
        tone: 'orange',
        icon: '🛡️',
        title: 'Copyright Report System Launched',
        summary:
          'Content owners can now report copyright infringements with the new report form. Each report gets a unique tracking ID for follow-up, and our team reviews all submissions.',
        details: [],
      },
      {
        date: 'March 28, 2026',
        tag: 'New Feature',
        tone: 'orange',
        icon: '⭐',
        title: 'Premium Streams Launched',
        summary:
          'Exclusive premium content is now available. Subscribe to creator channels for ad-free viewing, creator-only perks, and access to exclusive streams.',
        details: [],
      },
      {
        date: 'March 15, 2026',
        tag: 'Monetization',
        tone: 'green',
        icon: '💎',
        title: 'Creator Subscriptions Added',
        summary:
          'Support your favourite creators with monthly subscriptions. Unlock custom badges, emotes, subscriber-only chat, and exclusive streams.',
        details: [],
      },
      {
        date: 'March 2, 2026',
        tag: 'Enhancement',
        tone: 'blue',
        icon: '🎁',
        title: 'Real-Time Gifting Upgraded',
        summary:
          'Send animated gifts during live streams with new gift tiers and visual effects. Creators earn vPT from every gift received.',
        details: [],
      },
      {
        date: 'February 18, 2026',
        tag: 'Economy',
        tone: 'amber',
        icon: '💰',
        title: 'VPT Wallet Integration',
        summary:
          'Earn and spend VPT tokens across the platform. The integrated wallet supports instant transfers, staking rewards, and detailed transaction history.',
        details: [
          'In-app wallet with real-time balance updates.',
          'Send and receive vPT tokens instantly.',
          'Detailed transaction history with export options.',
          'Staking rewards for long-term holders.',
        ],
      },
      {
        date: 'February 5, 2026',
        tag: 'Platform',
        tone: 'purple',
        icon: '🌐',
        title: 'Multi-Language Support',
        summary:
          'AfroVision now supports Swahili, Yoruba, Hausa, Zulu, French, and Portuguese alongside English. More languages coming soon.',
        details: [],
      },
      {
        date: 'January 20, 2026',
        tag: 'Performance',
        tone: 'cyan',
        icon: '📺',
        title: 'Enhanced Stream Quality',
        summary:
          'Adaptive bitrate streaming with up to 4K quality. Lower latency for real-time interactions and smoother playback on all devices and network conditions.',
        details: [],
      },
      {
        date: 'January 5, 2026',
        tag: 'Platform',
        tone: 'purple',
        icon: '🚀',
        title: 'AfroVision Beta Launch',
        summary:
          'AfroVision launches in beta with live streaming, channel creation, real-time chat, reactions, and the foundation of the vPT economy. Welcome to the future of African streaming.',
        details: [],
      },
    ],
  },
};

function sanitizeText(value, fallback = '', maxLength = 800) {
  if (typeof value !== 'string') return fallback;
  // Remove script, style, and object tags entirely (including contents)
  let safe = value.replace(/<(script|style|object|embed|applet|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove tags that shouldn't be in CMS content
  safe = safe.replace(/<\/?(?:script|style|iframe|object|embed|applet|form|input|button|textarea|select|option|meta|base|head|title|html|body|link)[^>]*>/gi, '');
  // Remove inline event handlers
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

function isLongTextKey(key) {
  return key.includes('intro') || key.includes('body') || key.includes('desc') || key.includes('paragraph');
}

function normalizeWithTemplate(template, input, keyName = '') {
  if (Array.isArray(template)) {
    const source = Array.isArray(input) ? input : template;
    const itemTemplate = template[0];
    if (itemTemplate === undefined) return [];
    return source
      .map((item) => normalizeWithTemplate(itemTemplate, item, keyName))
      .filter((item) => {
        if (!item || typeof item !== 'object') return true;
        return Object.values(item).some((value) => typeof value !== 'string' || value.length > 0);
      });
  }

  if (template && typeof template === 'object') {
    const next = {};
    const source = input && typeof input === 'object' ? input : {};
    for (const [key, value] of Object.entries(template)) {
      next[key] = normalizeWithTemplate(value, source[key], key);
    }
    return next;
  }

  if (typeof template === 'string') {
    if (keyName.endsWith('href') || keyName === 'href') {
      return sanitizeHref(input, template || '/');
    }
    return sanitizeText(input, template, isLongTextKey(keyName) ? 1600 : 240);
  }

  return input ?? template;
}

function ensureSlug(slug) {
  const clean = sanitizeText(slug, '', 40).toLowerCase();
  if (!ALLOWED_SLUGS.includes(clean)) {
    throw new Error(`unsupported slug: ${slug}`);
  }
  return clean;
}

function getDefaults(slug) {
  return JSON.parse(JSON.stringify(DEFAULTS[slug]));
}

async function getStored(slug) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(`${DOC_PREFIX}${slug}`).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
  return data.content || null;
}

async function getAdminPageContent(slug) {
  const safeSlug = ensureSlug(slug);
  const stored = await getStored(safeSlug);
  return normalizeWithTemplate(getDefaults(safeSlug), stored);
}

async function savePageContent(slug, content, actor = 'system') {
  const safeSlug = ensureSlug(slug);
  const normalized = normalizeWithTemplate(getDefaults(safeSlug), content);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(`${DOC_PREFIX}${safeSlug}`).set({
    slug: safeSlug,
    content: normalized,
    updated_at: Date.now(),
    updated_by: actor,
  });
  return normalized;
}

async function getPublicPageContent(slug) {
  return getAdminPageContent(slug);
}

module.exports = {
  ALLOWED_SLUGS,
  getAdminPageContent,
  savePageContent,
  getPublicPageContent,
};
