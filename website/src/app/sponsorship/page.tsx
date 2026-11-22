import type { Metadata } from "next";
import { getStaticPageContent } from "@/lib/static-page-content";

export const metadata: Metadata = {
  title: "Strategic Partnership Programme — AFVC-2027: The Amazons | AfroVision",
  description:
    "Partner with AfroVision Challenge 2027: The Amazons — an entrepreneurship-focused reality programme bringing five finalists together to build one shared business enterprise.",
};

interface PartnershipTier {
  name: string;
  range: string;
  scope: string;
  accentClass: string;
  body: string;
}

interface ProspectItem {
  name: string;
  opening_request: string;
  opportunity: string;
}

interface AdditionalProspectItem {
  name: string;
  contribution: string;
}

interface JourneyStage {
  stage: string;
  title: string;
  featured?: boolean;
  body: string;
  bullets?: string[];
}

interface BenefitItem {
  title: string;
  body: string;
}

interface SponsorshipContent {
  schema_version: number;
  eyebrow: string;
  title: string;
  intro_paragraphs: string[];
  collaboration_note: string;
  overview: {
    title: string;
    lead: string;
    clarification: string;
    elements: string[];
    governance_note: string;
  };
  framework: {
    title: string;
    subtitle: string;
    categories: PartnershipTier[];
    important_title: string;
    important_notes: string[];
  };
  prospects: {
    title: string;
    disclaimer: string;
    first_wave_title: string;
    first_wave: ProspectItem[];
    first_wave_note: string;
    additional_title: string;
    additional: AdditionalProspectItem[];
    payments_spotlight: {
      badge: string;
      title: string;
      intro: string;
      areas: string[];
      challenge_note: string;
      inclusivity_note: string;
    };
  };
  journey: {
    eyebrow: string;
    title: string;
    subtitle: string;
    intro: string;
    stages: JourneyStage[];
    partner_role_title: string;
    partner_role_paragraphs: string[];
    outcome_title: string;
    outcome_headline: string;
    outcome_body: string;
    outcome_legal_note: string;
  };
  benefits: {
    title: string;
    items: BenefitItem[];
    negotiation_note: string;
  };
  accountability: {
    title: string;
    intro: string;
    agreements_label: string;
    agreement_items: string[];
    distinction_note: string;
    finance_disclaimer: string;
  };
  cta: {
    title: string;
    body_paragraphs: string[];
    primary_label: string;
    primary_href: string;
    contact_email: string;
    presentation_href: string;
    presentation_label: string;
  };
}

const SPONSORSHIP_DEFAULT: SponsorshipContent = {
  schema_version: 2,
  eyebrow: "AFVC-2027 | STRATEGIC PARTNERSHIP PROGRAMME",
  title: "AfroVision Challenge 2027: The Amazons",
  intro_paragraphs: [
    "The Amazons is an entrepreneurship-focused reality programme designed to identify, develop and bring together talented women to build a shared business enterprise.",
    "Through practical business challenges, mentorship, professional expertise and strategic partnerships, AFVC-2027 aims to transform the reality television experience into a platform for enterprise development and economic participation.",
    "We invite organisations, institutions, businesses and individuals to participate in this initiative through financial contributions, technology, products, services, expertise, infrastructure, media and other forms of strategic support.",
  ],
  collaboration_note:
    "This is not simply a conventional sponsorship solicitation. It is an invitation to collaborate in developing a women-led enterprise through a reality television programme.",
  overview: {
    title: "Understanding The Amazons",
    lead: "Five finalists will work together towards establishing one shared enterprise.",
    clarification:
      "The Amazons is structured around building a single collaborative business venture rather than awarding individual funding to five separate businesses.",
    elements: [
      "Participant discovery and selection.",
      "Entrepreneurship development.",
      "Business education and mentorship.",
      "Practical business challenges.",
      "Market and commercial exposure.",
      "Collaborative enterprise development.",
      "Business launch and agreed post-programme support.",
    ],
    governance_note:
      "The final enterprise ownership, governance, participant responsibilities and post-programme arrangements will be documented separately.",
  },
  framework: {
    title: "Partnership Contribution Framework",
    subtitle:
      "Four flexible partnership categories designed to welcome both capital and non-cash strategic contributions.",
    categories: [
      {
        name: "Title Partner",
        range: "₦700 million – ₦1.2 billion",
        scope: "One lead partnership opportunity",
        accentClass: "border-t-av-orange",
        body: "Potential benefits include lead brand association, agreed naming rights, programme-wide visibility and prominent brand integration.",
      },
      {
        name: "Category Partner",
        range: "₦40 million – ₦80 million",
        scope: "Category-specific opportunities",
        accentClass: "border-t-[#528ff1]",
        body: "Category-specific opportunities, including banking, telecommunications, technology, education, consumer goods and other relevant industries.",
      },
      {
        name: "Segment Partner",
        range: "₦10 million – ₦25 million",
        scope: "Activity-focused support",
        accentClass: "border-t-av-light-orange",
        body: "Support for specific programme activities such as business challenges, pitch sessions, masterclasses, training and enterprise showcases.",
      },
      {
        name: "Strategic / In-Kind Partner",
        range: "Independently valued contributions",
        scope: "Products, technology & expertise",
        accentClass: "border-t-av-success",
        body: "Accept equipment, devices, software, connectivity, products, workspace, professional services, media inventory, expertise, infrastructure and other useful resources.",
      },
    ],
    important_title: "Framework Principles & Valuation Guidelines",
    important_notes: [
      "These financial ranges are preliminary discussion figures, not confirmed fundraising targets.",
      "No final programme fundraising target is established here.",
      "Cash and in-kind contributions must be separately documented.",
      "In-kind contributions must be independently valued using an agreed basis.",
      "Benefits must reflect the actual contribution and agreed scope.",
      "Smaller organisations have opportunities to participate through appropriately scoped contributions.",
      "Contributions can combine cash and non-cash support.",
    ],
  },
  prospects: {
    title: "Organisations We Would Like to Partner With",
    disclaimer:
      "All organisations listed below are prospective partners. None has committed funding or approved the programme.",
    first_wave_title: "First-Wave Partnership Prospects",
    first_wave: [
      {
        name: "Mobile Network Operators",
        opening_request: "Proposed opening request: ₦100 million",
        opportunity:
          "Technology, connectivity, digital inclusion, devices, digital skills and women's enterprise development.",
      },
      {
        name: "Banks with women-targeted Initiative",
        opening_request: "Proposed opening request: ₦175 million",
        opportunity:
          "Financial empowerment, financial literacy, banking services, entrepreneurship and business mentorship.",
      },
      {
        name: "Bank of Industry (BOI)",
        opening_request: "Proposed opening request: ₦50 million",
        opportunity:
          "Enterprise development, business advisory, technical assistance, equipment support and guidance on applicable financing opportunities.",
      },
      {
        name: "Women-targeted Initiatives",
        opening_request: "Proposed opening request: ₦50 million",
        opportunity:
          "Women's entrepreneurship, SME development, financial inclusion and business banking education.",
      },
      {
        name: "Foundations with strategic impacts on women-led startups",
        opening_request: "Proposed opening request: ₦30 million",
        opportunity:
          "Strategic impact, enterprise development, investment readiness and institutional support.",
      },
    ],
    first_wave_note:
      "These are proposed opening requests for discussion purposes, not confirmed contributions or guaranteed revenue.",
    additional_title: "Additional Prospective Partners",
    additional: [
      {
        name: "Digital and Microfinance Banks",
        contribution:
          "Digital banking tools, merchant onboarding, micro-enterprise financial literacy, and practical SME advisory support.",
      },
      {
        name: "Tech Providers",
        contribution:
          "Software licences, cloud infrastructure, business productivity tools, hardware devices, and technical skills training.",
      },
      {
        name: "Food and Beverage",
        contribution:
          "Production catering, hospitality provisions, supply-chain knowledge, and commercial distribution experience.",
      },
      {
        name: "Private Entities / Groups",
        contribution:
          "Workspace facilities, legal, accounting and management advisory, logistics, media inventory, or co-branded challenge support.",
      },
    ],
    payments_spotlight: {
      badge: "Priority Partnership Positioning",
      title: "Seeking an Official Digital Payments and Financial Inclusion Partner",
      intro:
        "AfroVision is actively seeking an Official Digital Payments and Financial Inclusion Partner to support commercial readiness and practical digital finance education throughout the programme.",
      areas: [
        "Digital payment infrastructure.",
        "Merchant onboarding.",
        "Payment tools and services.",
        "Financial literacy.",
        "Digital commerce education.",
        "Relevant devices or operational support.",
        "Programme publicity and audience engagement.",
      ],
      challenge_note:
        "A possible brand-supported digital business challenge can also be explored.",
      inclusivity_note:
        "Smaller partners are not restricted to the larger financial sponsorship categories and may participate through scoped financial, product, or service contributions.",
    },
  },
  journey: {
    eyebrow: "THE AMAZONS: THE ENTERPRISE JOURNEY",
    title: "The Amazons – From Five Finalists to One Enterprise",
    subtitle: "Five Women. One Shared Vision. One Enterprise.",
    intro:
      "The defining feature of AfroVision Challenge 2027 is its enterprise-building model. Rather than ending with a conventional competition winner, the programme brings five finalists together to collaboratively establish and launch a business enterprise.",
    stages: [
      {
        stage: "Stage 1",
        title: "Discovery and Selection",
        body: "Participants enter the programme through a structured selection process designed to identify women with entrepreneurial potential, relevant abilities, creativity, determination and the capacity to contribute to a collaborative business venture.",
      },
      {
        stage: "Stage 2",
        title: "Development and Capacity Building",
        body: "Selected participants undergo business development activities covering entrepreneurship, financial literacy, business management, communication, leadership, technology and practical commercial skills. Experienced professionals, mentors and participating organisations may contribute to this stage.",
      },
      {
        stage: "Stage 3",
        title: "Business Challenges and Practical Assessment",
        body: "Participants undertake practical assignments and business challenges designed to expose their abilities in problem-solving, decision-making, teamwork, innovation, resource management and commercial thinking. These activities provide opportunities for learning while allowing participants to demonstrate their capabilities.",
      },
      {
        stage: "Stage 4",
        title: "The Five Finalists",
        featured: true,
        body: "Five finalists emerge from the programme's selection and assessment process. Unlike conventional competitions where finalists necessarily compete for separate individual prizes, The Amazons moves towards a collaborative enterprise model. The five finalists become the proposed founding team of one shared business venture.",
      },
      {
        stage: "Stage 5",
        title: "Enterprise Design and Development",
        body: "Working together, the five finalists develop the business concept into an actionable enterprise. This stage involves:",
        bullets: [
          "Identifying a viable business opportunity.",
          "Researching the intended market and potential customers.",
          "Developing the business model.",
          "Defining products or services.",
          "Establishing operational requirements.",
          "Developing financial and commercial plans.",
          "Assigning proposed management and operational responsibilities.",
          "Engaging relevant mentors, advisers and strategic partners.",
        ],
      },
      {
        stage: "Stage 6",
        title: "Enterprise Establishment and Launch",
        featured: true,
        body: "The proposed founding team works towards establishing the business, with support from AfroVision and participating partners in accordance with agreed commitments. The objective is to move beyond a television competition and create an actual operating enterprise with a defined business direction, operational structure and commercial objectives.",
      },
      {
        stage: "Stage 7",
        title: "Post-Launch Development",
        body: "Following the launch, the enterprise may receive further support through agreed mentorship, professional services, market access, technology, business development and strategic partnerships. The objective is to provide a foundation for sustainable operations and long-term commercial growth.",
      },
    ],
    partner_role_title: "The Role of Our Partners",
    partner_role_paragraphs: [
      "Partners can participate at different stages of this journey. Financial institutions may contribute financial expertise and business banking guidance. Technology companies may provide infrastructure, devices and digital tools. Professional organisations may provide legal, accounting and management expertise. Consumer businesses may contribute products, distribution knowledge and market experience.",
      "The programme therefore creates opportunities for organisations to contribute directly to the development of an enterprise rather than simply placing their brands alongside a television production.",
    ],
    outcome_title: "The Intended Outcome",
    outcome_headline: "Five finalists. One collaborative founding team. One shared enterprise.",
    outcome_body:
      "AFVC-2027 aims to demonstrate what can happen when talent, opportunity, professional expertise, strategic partnerships and enterprise development come together.",
    outcome_legal_note:
      "The final enterprise structure, ownership arrangements, participant responsibilities, funding arrangements and post-launch governance will be established through appropriate agreements before implementation.",
  },
  benefits: {
    title: "What Our Partners Gain",
    items: [
      {
        title: "Brand Visibility",
        body: "Agreed logo placement, programme credits, digital campaigns and promotional materials.",
      },
      {
        title: "Brand Integration",
        body: "Relevant products and services integrated into appropriate programme activities.",
      },
      {
        title: "Branded Programme Activities",
        body: "Opportunities to support business challenges, workshops, masterclasses and enterprise activities.",
      },
      {
        title: "Expert Participation",
        body: "Opportunities for partner representatives to participate as mentors, trainers, judges or technical advisers, subject to programme arrangements.",
      },
      {
        title: "Digital and Media Exposure",
        body: "Agreed social media campaigns, digital content, promotional materials and distribution opportunities.",
      },
      {
        title: "Enterprise Engagement",
        body: "Opportunities to interact with participants and contribute to the emerging enterprise.",
      },
      {
        title: "Impact Recognition",
        body: "Recognition for supporting women's entrepreneurship and enterprise development.",
      },
      {
        title: "Performance Reporting",
        body: "Reports covering agreed deliverables and available campaign performance data.",
      },
    ],
    negotiation_note:
      "All benefits must be negotiated and documented. Specific audience numbers or impressions are not promised without verifiable evidence.",
  },
  accountability: {
    title: "Transparent Partnerships. Measurable Outcomes.",
    intro:
      "Every partnership will have clearly defined contributions, responsibilities and deliverables.",
    agreements_label: "Agreements should specify:",
    agreement_items: [
      "Financial or non-financial contribution.",
      "Contribution valuation.",
      "Brand visibility and placement.",
      "Programme integration.",
      "Delivery timelines.",
      "Category exclusivity, where applicable.",
      "Reporting and performance measurement.",
      "Rights and responsibilities of each party.",
    ],
    distinction_note:
      "Prospective partners are clearly distinguished from confirmed partners.",
    finance_disclaimer:
      "Participating financial institutions do not promise automatic loans, grants, investments or accelerator admission.",
  },
  cta: {
    title: "Let's Build Something Meaningful Together.",
    body_paragraphs: [
      "Whether your organisation can contribute financial resources, technology, products, professional expertise, infrastructure, media exposure or strategic support, there is an opportunity to participate in AFVC-2027.",
      "Let's explore a partnership that aligns your organisation's objectives with the development of women's entrepreneurship and the next generation of African enterprise.",
    ],
    primary_label: "Discuss a Partnership",
    primary_href:
      "mailto:afrovisiondigitaltv@gmail.com?subject=AFVC-2027%20Strategic%20Partnership%20Inquiry",
    contact_email: "afrovisiondigitaltv@gmail.com",
    presentation_href: "/presentation.pdf",
    presentation_label: "Download Presentation",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function pickStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return cleaned.length > 0 ? cleaned : fallback;
}

function pickMailtoHref(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const trimmed = value.trim();
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  if (trimmed.includes("@")) {
    return `mailto:${trimmed}`;
  }
  return fallback;
}

function resolveSponsorshipContent(managed: unknown): SponsorshipContent {
  if (!isRecord(managed) || managed.schema_version !== 2) {
    return SPONSORSHIP_DEFAULT;
  }

  const mOverview = isRecord(managed.overview) ? managed.overview : {};
  const mFramework = isRecord(managed.framework) ? managed.framework : {};
  const mProspects = isRecord(managed.prospects) ? managed.prospects : {};
  const mSpotlight = isRecord(mProspects.payments_spotlight) ? mProspects.payments_spotlight : {};
  const mJourney = isRecord(managed.journey) ? managed.journey : {};
  const mBenefits = isRecord(managed.benefits) ? managed.benefits : {};
  const mAccountability = isRecord(managed.accountability) ? managed.accountability : {};
  const mCta = isRecord(managed.cta) ? managed.cta : {};

  const categories = Array.isArray(mFramework.categories)
    ? mFramework.categories
        .filter(isRecord)
        .map((item, idx) => {
          const fb = SPONSORSHIP_DEFAULT.framework.categories[idx] || SPONSORSHIP_DEFAULT.framework.categories[0];
          return {
            name: pickString(item.name, fb.name),
            range: pickString(item.range, fb.range),
            scope: pickString(item.scope, fb.scope),
            accentClass: pickString(item.accentClass, fb.accentClass),
            body: pickString(item.body, fb.body),
          };
        })
    : SPONSORSHIP_DEFAULT.framework.categories;

  const firstWave = Array.isArray(mProspects.first_wave)
    ? mProspects.first_wave
        .filter(isRecord)
        .map((item, idx) => {
          const fb = SPONSORSHIP_DEFAULT.prospects.first_wave[idx] || SPONSORSHIP_DEFAULT.prospects.first_wave[0];
          return {
            name: pickString(item.name, fb.name),
            opening_request: pickString(item.opening_request, fb.opening_request),
            opportunity: pickString(item.opportunity, fb.opportunity),
          };
        })
    : SPONSORSHIP_DEFAULT.prospects.first_wave;

  const additional = Array.isArray(mProspects.additional)
    ? mProspects.additional
        .filter(isRecord)
        .map((item, idx) => {
          const fb = SPONSORSHIP_DEFAULT.prospects.additional[idx] || SPONSORSHIP_DEFAULT.prospects.additional[0];
          return {
            name: pickString(item.name, fb.name),
            contribution: pickString(item.contribution, fb.contribution),
          };
        })
    : SPONSORSHIP_DEFAULT.prospects.additional;

  const stages = Array.isArray(mJourney.stages)
    ? mJourney.stages
        .filter(isRecord)
        .map((item, idx) => {
          const fb = SPONSORSHIP_DEFAULT.journey.stages[idx] || SPONSORSHIP_DEFAULT.journey.stages[0];
          const bullets = Array.isArray(item.bullets)
            ? item.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
            : fb.bullets;
          return {
            stage: pickString(item.stage, fb.stage),
            title: pickString(item.title, fb.title),
            featured: typeof item.featured === "boolean" ? item.featured : fb.featured,
            body: pickString(item.body, fb.body),
            bullets: bullets && bullets.length > 0 ? bullets : undefined,
          };
        })
    : SPONSORSHIP_DEFAULT.journey.stages;

  const benefitItems = Array.isArray(mBenefits.items)
    ? mBenefits.items
        .filter(isRecord)
        .map((item, idx) => {
          const fb = SPONSORSHIP_DEFAULT.benefits.items[idx] || SPONSORSHIP_DEFAULT.benefits.items[0];
          return {
            title: pickString(item.title, fb.title),
            body: pickString(item.body, fb.body),
          };
        })
    : SPONSORSHIP_DEFAULT.benefits.items;

  const contactEmail = pickString(mCta.contact_email, SPONSORSHIP_DEFAULT.cta.contact_email);

  return {
    schema_version: 2,
    eyebrow: pickString(managed.eyebrow, SPONSORSHIP_DEFAULT.eyebrow),
    title: pickString(managed.title, SPONSORSHIP_DEFAULT.title),
    intro_paragraphs: pickStringArray(managed.intro_paragraphs, SPONSORSHIP_DEFAULT.intro_paragraphs),
    collaboration_note: pickString(managed.collaboration_note, SPONSORSHIP_DEFAULT.collaboration_note),
    overview: {
      title: pickString(mOverview.title, SPONSORSHIP_DEFAULT.overview.title),
      lead: pickString(mOverview.lead, SPONSORSHIP_DEFAULT.overview.lead),
      clarification: pickString(mOverview.clarification, SPONSORSHIP_DEFAULT.overview.clarification),
      elements: pickStringArray(mOverview.elements, SPONSORSHIP_DEFAULT.overview.elements),
      governance_note: pickString(mOverview.governance_note, SPONSORSHIP_DEFAULT.overview.governance_note),
    },
    framework: {
      title: pickString(mFramework.title, SPONSORSHIP_DEFAULT.framework.title),
      subtitle: pickString(mFramework.subtitle, SPONSORSHIP_DEFAULT.framework.subtitle),
      categories: categories.length > 0 ? categories : SPONSORSHIP_DEFAULT.framework.categories,
      important_title: pickString(mFramework.important_title, SPONSORSHIP_DEFAULT.framework.important_title),
      important_notes: pickStringArray(mFramework.important_notes, SPONSORSHIP_DEFAULT.framework.important_notes),
    },
    prospects: {
      title: pickString(mProspects.title, SPONSORSHIP_DEFAULT.prospects.title),
      disclaimer: pickString(mProspects.disclaimer, SPONSORSHIP_DEFAULT.prospects.disclaimer),
      first_wave_title: pickString(mProspects.first_wave_title, SPONSORSHIP_DEFAULT.prospects.first_wave_title),
      first_wave: firstWave.length > 0 ? firstWave : SPONSORSHIP_DEFAULT.prospects.first_wave,
      first_wave_note: pickString(mProspects.first_wave_note, SPONSORSHIP_DEFAULT.prospects.first_wave_note),
      additional_title: pickString(mProspects.additional_title, SPONSORSHIP_DEFAULT.prospects.additional_title),
      additional: additional.length > 0 ? additional : SPONSORSHIP_DEFAULT.prospects.additional,
      payments_spotlight: {
        badge: pickString(mSpotlight.badge, SPONSORSHIP_DEFAULT.prospects.payments_spotlight.badge),
        title: pickString(mSpotlight.title, SPONSORSHIP_DEFAULT.prospects.payments_spotlight.title),
        intro: pickString(mSpotlight.intro, SPONSORSHIP_DEFAULT.prospects.payments_spotlight.intro),
        areas: pickStringArray(mSpotlight.areas, SPONSORSHIP_DEFAULT.prospects.payments_spotlight.areas),
        challenge_note: pickString(
          mSpotlight.challenge_note,
          SPONSORSHIP_DEFAULT.prospects.payments_spotlight.challenge_note
        ),
        inclusivity_note: pickString(
          mSpotlight.inclusivity_note,
          SPONSORSHIP_DEFAULT.prospects.payments_spotlight.inclusivity_note
        ),
      },
    },
    journey: {
      eyebrow: pickString(mJourney.eyebrow, SPONSORSHIP_DEFAULT.journey.eyebrow),
      title: pickString(mJourney.title, SPONSORSHIP_DEFAULT.journey.title),
      subtitle: pickString(mJourney.subtitle, SPONSORSHIP_DEFAULT.journey.subtitle),
      intro: pickString(mJourney.intro, SPONSORSHIP_DEFAULT.journey.intro),
      stages: stages.length > 0 ? stages : SPONSORSHIP_DEFAULT.journey.stages,
      partner_role_title: pickString(mJourney.partner_role_title, SPONSORSHIP_DEFAULT.journey.partner_role_title),
      partner_role_paragraphs: pickStringArray(
        mJourney.partner_role_paragraphs,
        SPONSORSHIP_DEFAULT.journey.partner_role_paragraphs
      ),
      outcome_title: pickString(mJourney.outcome_title, SPONSORSHIP_DEFAULT.journey.outcome_title),
      outcome_headline: pickString(mJourney.outcome_headline, SPONSORSHIP_DEFAULT.journey.outcome_headline),
      outcome_body: pickString(mJourney.outcome_body, SPONSORSHIP_DEFAULT.journey.outcome_body),
      outcome_legal_note: pickString(mJourney.outcome_legal_note, SPONSORSHIP_DEFAULT.journey.outcome_legal_note),
    },
    benefits: {
      title: pickString(mBenefits.title, SPONSORSHIP_DEFAULT.benefits.title),
      items: benefitItems.length > 0 ? benefitItems : SPONSORSHIP_DEFAULT.benefits.items,
      negotiation_note: pickString(mBenefits.negotiation_note, SPONSORSHIP_DEFAULT.benefits.negotiation_note),
    },
    accountability: {
      title: pickString(mAccountability.title, SPONSORSHIP_DEFAULT.accountability.title),
      intro: pickString(mAccountability.intro, SPONSORSHIP_DEFAULT.accountability.intro),
      agreements_label: pickString(
        mAccountability.agreements_label,
        SPONSORSHIP_DEFAULT.accountability.agreements_label
      ),
      agreement_items: pickStringArray(
        mAccountability.agreement_items,
        SPONSORSHIP_DEFAULT.accountability.agreement_items
      ),
      distinction_note: pickString(
        mAccountability.distinction_note,
        SPONSORSHIP_DEFAULT.accountability.distinction_note
      ),
      finance_disclaimer: pickString(
        mAccountability.finance_disclaimer,
        SPONSORSHIP_DEFAULT.accountability.finance_disclaimer
      ),
    },
    cta: {
      title: pickString(mCta.title, SPONSORSHIP_DEFAULT.cta.title),
      body_paragraphs: pickStringArray(mCta.body_paragraphs, SPONSORSHIP_DEFAULT.cta.body_paragraphs),
      primary_label: pickString(mCta.primary_label, SPONSORSHIP_DEFAULT.cta.primary_label),
      primary_href: pickMailtoHref(mCta.primary_href, SPONSORSHIP_DEFAULT.cta.primary_href),
      contact_email: contactEmail,
      presentation_href: pickString(mCta.presentation_href, SPONSORSHIP_DEFAULT.cta.presentation_href),
      presentation_label: pickString(mCta.presentation_label, SPONSORSHIP_DEFAULT.cta.presentation_label),
    },
  };
}

export default async function SponsorshipPage() {
  const managed = await getStaticPageContent<unknown>("sponsorship");
  const content = resolveSponsorshipContent(managed);
  const emailHref = content.cta.contact_email.startsWith("mailto:")
    ? content.cta.contact_email
    : `mailto:${content.cta.contact_email}`;

  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 space-y-16">
        {/* 1. Partnership Hero and Introduction */}
        <section className="rounded-2xl bg-av-card border border-av-input-border/40 p-8 lg:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-av-orange via-av-light-orange to-[#528ff1]" />
          <p className="text-xs uppercase tracking-[0.28em] text-av-orange font-semibold">
            {content.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl lg:text-5xl font-bold text-av-white leading-tight">
            {content.title}
          </h1>
          <div className="mt-5 space-y-4 max-w-4xl">
            {content.intro_paragraphs.map((paragraph, index) => (
              <p key={index} className="text-base text-av-light-orange leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-av-orange/30 bg-av-orange/10 px-5 py-4 max-w-4xl">
            <p className="text-sm text-av-white/95 leading-relaxed">{content.collaboration_note}</p>
          </div>
        </section>

        {/* 2. Understanding The Amazons / Programme Overview */}
        <section className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 lg:p-12">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white">{content.overview.title}</h2>
          <p className="mt-3 text-lg font-semibold text-av-orange">{content.overview.lead}</p>
          <p className="mt-2 text-sm text-av-light-orange leading-relaxed max-w-3xl">
            {content.overview.clarification}
          </p>

          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.overview.elements.map((element, index) => (
              <div
                key={element}
                className="rounded-xl border border-av-input-border/40 bg-av-input-fill/70 p-4 flex items-start gap-3"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-av-orange/15 border border-av-orange/30 text-av-orange text-xs font-bold flex items-center justify-center">
                  {`0${index + 1}`}
                </span>
                <span className="text-sm text-av-white/90 leading-snug">{element}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-av-light-orange/90 border-t border-av-input-border/30 pt-4">
            {content.overview.governance_note}
          </p>
        </section>

        {/* 3. Partnership Contribution Framework */}
        <section>
          <div className="mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-av-white">{content.framework.title}</h2>
            <p className="mt-2 text-sm text-av-light-orange max-w-3xl">{content.framework.subtitle}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {content.framework.categories.map((category) => (
              <div
                key={category.name}
                className={`rounded-2xl border border-av-input-border/30 border-t-4 ${category.accentClass} bg-av-card p-7 flex flex-col justify-between`}
              >
                <div>
                  <div className="text-xs uppercase tracking-wider text-av-light-orange font-semibold mb-1">
                    {category.scope}
                  </div>
                  <h3 className="text-xl lg:text-2xl font-bold text-av-white">{category.name}</h3>
                  <div className="mt-1 text-lg font-bold text-av-orange">{category.range}</div>
                  <p className="mt-4 text-sm text-av-light-orange leading-relaxed">{category.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-av-input-border/40 bg-av-card/80 p-6 lg:p-8">
            <h3 className="text-base font-bold text-av-white mb-4">
              {content.framework.important_title}
            </h3>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm text-av-light-orange">
              {content.framework.important_notes.map((note) => (
                <li key={note} className="flex items-start gap-2.5">
                  <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-av-orange" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. Organisations We Would Like to Partner With */}
        <section className="space-y-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-av-white">{content.prospects.title}</h2>
            <p className="mt-2 text-sm text-av-light-orange max-w-3xl">{content.prospects.disclaimer}</p>
          </div>

          <div>
            <h3 className="text-lg font-bold text-av-white mb-4">
              {content.prospects.first_wave_title}
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {content.prospects.first_wave.map((prospect) => (
                <div
                  key={prospect.name}
                  className="rounded-2xl border border-av-input-border/30 bg-av-card p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="inline-block px-2.5 py-1 rounded-full bg-av-orange/15 border border-av-orange/30 text-[11px] font-semibold text-av-orange uppercase tracking-wide mb-3">
                      Prospective Partner
                    </div>
                    <h4 className="text-base font-bold text-av-white">{prospect.name}</h4>
                    <p className="mt-1.5 text-sm font-semibold text-av-light-orange">
                      {prospect.opening_request}
                    </p>
                    <p className="mt-3 text-xs text-av-white/80 leading-relaxed">{prospect.opportunity}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-av-light-orange/90 italic">
              {content.prospects.first_wave_note}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold text-av-white mb-4">
              {content.prospects.additional_title}
            </h3>
            <div className="grid sm:grid-cols-2 gap-5">
              {content.prospects.additional.map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl border border-av-input-border/30 bg-av-card p-6 border-l-4 border-l-[#528ff1]"
                >
                  <h4 className="text-base font-bold text-av-white">{item.name}</h4>
                  <p className="mt-2 text-sm text-av-light-orange leading-relaxed">{item.contribution}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-av-orange/35 bg-gradient-to-br from-av-card via-av-input-fill to-av-orange/10 p-8 lg:p-10">
            <span className="inline-block px-3 py-1 rounded-full bg-av-orange/20 border border-av-orange/40 text-xs font-semibold uppercase tracking-wider text-av-orange">
              {content.prospects.payments_spotlight.badge}
            </span>
            <h3 className="mt-4 text-xl lg:text-2xl font-bold text-av-white">
              {content.prospects.payments_spotlight.title}
            </h3>
            <p className="mt-2 text-sm text-av-light-orange leading-relaxed max-w-3xl">
              {content.prospects.payments_spotlight.intro}
            </p>

            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {content.prospects.payments_spotlight.areas.map((area) => (
                <div
                  key={area}
                  className="rounded-xl border border-av-input-border/40 bg-av-dark-blue/60 px-4 py-3 text-sm text-av-white/90 flex items-center gap-2.5"
                >
                  <span className="w-2 h-2 rounded-full bg-av-orange flex-shrink-0" />
                  <span>{area}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2 text-xs text-av-light-orange leading-relaxed border-t border-av-input-border/30 pt-4">
              <p>{content.prospects.payments_spotlight.challenge_note}</p>
              <p>{content.prospects.payments_spotlight.inclusivity_note}</p>
            </div>
          </div>
        </section>

        {/* 5. The Amazons Enterprise Journey */}
        <section className="space-y-8">
          <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 lg:p-12">
            <p className="text-xs uppercase tracking-[0.25em] text-av-orange font-semibold">
              {content.journey.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl lg:text-3xl font-bold text-av-white">
              {content.journey.title}
            </h2>
            <p className="mt-2 text-base font-semibold text-av-light-orange">
              {content.journey.subtitle}
            </p>
            <p className="mt-4 text-sm text-av-white/85 leading-relaxed max-w-4xl">
              {content.journey.intro}
            </p>

            <div className="mt-8 relative space-y-5">
              {content.journey.stages.map((item) => {
                const isFeatured = Boolean(item.featured);
                return (
                  <div
                    key={item.stage}
                    className={
                      isFeatured
                        ? "rounded-2xl border-2 border-av-orange/60 bg-gradient-to-r from-av-orange/15 via-av-input-fill to-av-card p-6 lg:p-7 shadow-lg"
                        : "rounded-2xl border border-av-input-border/40 bg-av-input-fill/60 p-6"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span
                        className={
                          isFeatured
                            ? "px-3 py-1 rounded-full bg-av-orange text-av-dark-blue text-xs font-bold uppercase tracking-wider"
                            : "px-3 py-1 rounded-full bg-av-card border border-av-input-border text-av-orange text-xs font-bold uppercase tracking-wider"
                        }
                      >
                        {item.stage}
                      </span>
                      <h3 className="text-lg font-bold text-av-white">{item.title}</h3>
                    </div>

                    <p className="text-sm text-av-light-orange leading-relaxed">{item.body}</p>

                    {item.bullets && item.bullets.length > 0 && (
                      <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-av-white/90">
                        {item.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2.5">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-av-orange flex-shrink-0" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-10 grid lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-av-input-border/40 bg-av-input-fill/70 p-6 lg:p-8">
                <h3 className="text-lg font-bold text-av-white mb-3">
                  {content.journey.partner_role_title}
                </h3>
                <div className="space-y-3 text-sm text-av-light-orange leading-relaxed">
                  {content.journey.partner_role_paragraphs.map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-av-orange/30 bg-av-orange/10 p-6 lg:p-8 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-av-white mb-2">
                    {content.journey.outcome_title}
                  </h3>
                  <p className="text-base font-bold text-av-orange mb-3">
                    {content.journey.outcome_headline}
                  </p>
                  <p className="text-sm text-av-white/90 leading-relaxed">
                    {content.journey.outcome_body}
                  </p>
                </div>
                <p className="mt-5 text-xs text-av-light-orange/90 border-t border-av-orange/20 pt-3">
                  {content.journey.outcome_legal_note}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. What Our Partners Gain */}
        <section>
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-6">{content.benefits.title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {content.benefits.items.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-2xl border border-av-input-border/30 bg-av-card p-6"
              >
                <h3 className="text-base font-bold text-av-white mb-2">{benefit.title}</h3>
                <p className="text-xs text-av-light-orange leading-relaxed">{benefit.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-av-light-orange/90 italic">
            {content.benefits.negotiation_note}
          </p>
        </section>

        {/* 7. Transparent Partnerships. Measurable Outcomes. */}
        <section className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 lg:p-12">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white">
            {content.accountability.title}
          </h2>
          <p className="mt-3 text-sm text-av-light-orange leading-relaxed max-w-3xl">
            {content.accountability.intro}
          </p>
          <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-av-orange">
            {content.accountability.agreements_label}
          </h3>
          <ul className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm text-av-white/90">
            {content.accountability.agreement_items.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-av-orange" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-2 border-t border-av-input-border/30 pt-4 text-xs text-av-light-orange leading-relaxed">
            <p>{content.accountability.distinction_note}</p>
            <p>{content.accountability.finance_disclaimer}</p>
          </div>
        </section>

        {/* 8. Final Partnership Invitation and Contact */}
        <section className="rounded-2xl bg-gradient-to-r from-av-orange/15 to-av-light-orange/10 border border-av-orange/30 p-8 lg:p-12 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-av-white mb-3">
            {content.cta.title}
          </h2>
          <div className="space-y-3 max-w-2xl mx-auto mb-8">
            {content.cta.body_paragraphs.map((paragraph, idx) => (
              <p key={idx} className="text-sm text-av-light-orange leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={content.cta.primary_href}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue hover:opacity-90 transition-opacity"
            >
              {content.cta.primary_label}
            </a>
            <a
              href={emailHref}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-av-input-border bg-av-input-fill text-sm font-semibold text-av-light-orange hover:bg-av-white/5 transition-colors"
            >
              <span className="text-av-orange">✉</span>
              {content.cta.contact_email}
            </a>
            <a
              href={content.cta.presentation_href}
              download
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-av-input-border bg-av-input-fill text-sm font-semibold text-av-light-orange hover:bg-av-white/5 transition-colors"
            >
              <span className="text-av-orange">⬇</span>
              {content.cta.presentation_label}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
