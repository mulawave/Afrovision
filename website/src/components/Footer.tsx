import Image from "next/image";
import Link from "next/link";
import { getHomepageContent } from "@/lib/homepage";
import { resolveWebsiteMediaUrl } from "@/lib/media";

const FOOTER_LINKS = {
  Platform: [
    { label: "Live Streams", href: "/live" },
    { label: "Channels", href: "/channels" },
    { label: "Challenge", href: "#challenge" },
    { label: "Download App", href: "/download" },
  ],
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Press", href: "/press" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "AML Policy", href: "/aml" },
    { label: "Refund Policy", href: "/refund" },
    { label: "Copyright Policy", href: "/copyright" },
  ],
};

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.96a8.27 8.27 0 004.76 1.5v-3.4a4.85 4.85 0 01-1-.37z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
};

async function getSocialLinks(): Promise<{ platform: string; label: string; url: string; icon_url?: string | null }[]> {
  try {
    const content = await getHomepageContent();
    if (content?.social_links && content.social_links.length > 0) {
      return content.social_links.filter((l) => l.url);
    }
  } catch {
    // fall through to empty
  }
  return [];
}

export async function Footer({ logoUrl }: { logoUrl?: string | null }) {
  const socialLinks = await getSocialLinks();

  return (
    <footer className="bg-av-dark-blue border-t border-av-input-border/20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              {logoUrl ? (
                <Image
                  src={resolveWebsiteMediaUrl(logoUrl)}
                  alt="AfroVision"
                  width={48}
                  height={48}
                  unoptimized
                  className="h-12 w-12 rounded-lg object-contain"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center font-bold text-av-dark-blue text-lg">
                  A
                </div>
              )}
              <span className="text-xl font-bold tracking-wide">
                <span className="text-av-white">Afro</span>
                <span className="text-av-orange">Vision</span>
              </span>
            </Link>
            <p className="text-sm text-av-light-orange leading-relaxed mb-6">
              Africa&apos;s premier live streaming platform. Watch, earn, and
              connect with creators shaping the future of entertainment.
            </p>
            {socialLinks.length > 0 && (
              <div className="flex gap-3">
                {socialLinks.map((s) => (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-9 h-9 rounded-lg bg-av-card border border-av-input-border/30 flex items-center justify-center text-av-light-orange hover:text-av-orange hover:border-av-orange/40 transition-all"
                  >
                    {s.icon_url ? (
                      <Image
                        src={resolveWebsiteMediaUrl(s.icon_url)}
                        alt={s.label}
                        width={20}
                        height={20}
                        unoptimized
                        className="w-5 h-5 object-contain"
                      />
                    ) : SOCIAL_ICONS[s.platform] ?? (
                      <span className="text-xs font-bold">{s.label.charAt(0)}</span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-av-light-orange mb-4">
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-av-light-orange hover:text-av-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Ways to pay */}
        <div className="mt-12 pt-8 border-t border-av-input-border/20 flex flex-col items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-av-light-orange">
            Ways to pay
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Visa */}
            <span className="inline-flex items-center justify-center h-9 w-14 rounded-md bg-white" aria-label="Visa">
              <svg viewBox="0 0 48 16" className="h-4 w-10" aria-hidden="true">
                <path d="M19.42 1.02l-3.12 13.96h-3.74L15.68 1.02h3.74zm15.83 9.02l1.97-5.43 1.13 5.43h-3.1zm4.18 4.94h3.46L39.72 1.02h-3.19a1.58 1.58 0 00-1.48.98l-5.22 12.98h3.65l.73-2.01h4.46l.42 2.01h-.12zm-9.17-4.56c.02-3.67-5.07-3.87-5.04-5.51.01-.5.49-1.03 1.53-1.16a6.79 6.79 0 013.56.62l.63-2.95A9.7 9.7 0 0027.5.88c-3.45 0-5.87 1.83-5.89 4.46-.02 1.94 1.73 3.02 3.06 3.67 1.36.66 1.82 1.09 1.81 1.68-.01.91-1.08 1.31-2.09 1.33-1.75.03-2.77-.47-3.58-.85l-.63 2.95c.81.38 2.31.7 3.87.72 3.66 0 6.06-1.81 6.07-4.62h-.02zM17.32 1.02L11.9 14.98H8.2L5.5 3.68c-.16-.64-.3-1.08-.8-1.42C3.9 1.78 2.47 1.34 1.2 1.07l.08-.05h5.93c.82 0 1.54.55 1.71 1.48l1.47 7.79L14 1.02h3.32z" fill="#1A1F71"/>
              </svg>
            </span>
            {/* Mastercard */}
            <span className="inline-flex items-center justify-center h-9 w-14 rounded-md bg-white" aria-label="Mastercard">
              <svg viewBox="0 0 40 24" className="h-5 w-8" aria-hidden="true">
                <rect width="40" height="24" rx="3" fill="transparent"/>
                <circle cx="15" cy="12" r="8" fill="#EB001B"/>
                <circle cx="25" cy="12" r="8" fill="#F79E1B"/>
                <path d="M20 5.8a8 8 0 010 12.4 8 8 0 000-12.4z" fill="#FF5F00"/>
              </svg>
            </span>
            {/* Paystack */}
            <span className="inline-flex items-center justify-center h-9 px-2.5 rounded-md bg-white" aria-label="Paystack">
              <svg viewBox="0 0 80 20" className="h-3.5" aria-hidden="true">
                <rect x="0" y="1" width="16" height="3.4" rx="1" fill="#00C3F7"/>
                <rect x="0" y="7.3" width="16" height="3.4" rx="1" fill="#00C3F7"/>
                <rect x="0" y="13.6" width="10" height="3.4" rx="1" fill="#00C3F7"/>
                <text x="20" y="15.5" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="13" fill="#011B33">paystack</text>
              </svg>
            </span>
            {/* Flutterwave */}
            <span className="inline-flex items-center justify-center h-9 px-2.5 rounded-md bg-white" aria-label="Flutterwave">
              <svg viewBox="0 0 100 20" className="h-3.5" aria-hidden="true">
                <path d="M4 4c2.5-3 7-4 10-2s4 6 2 10c-1 2-3.5 4.5-6 5.5-1.5.6-3.5.8-4.5-.2-1.2-1.2-.4-3.2.8-4.2 1.5-1.2 3.2-.5 4.2.2.8.5 1.2-.2.8-.8C9.8 9 6.5 7.5 4.5 9c-2.5 1.8-2 5.5.5 7 2 1.3 4.5 1 6.5.2 3-1.3 5.5-4 7-7 2-4 1-8.5-3-10.5S5 .5 2 4" fill="#F5A623" strokeWidth="0"/>
                <text x="18" y="15" fontFamily="Arial,sans-serif" fontWeight="600" fontSize="11.5" fill="#F5A623">Flutterwave</text>
              </svg>
            </span>
            {/* Google Pay */}
            <span className="inline-flex items-center justify-center h-9 px-2.5 rounded-md bg-white" aria-label="Google Pay">
              <svg viewBox="0 0 56 24" className="h-5" aria-hidden="true">
                <path d="M25.22 11.97v4.5h-1.43V4.28h3.79a3.45 3.45 0 012.46.96 3.12 3.12 0 011.02 2.37 3.08 3.08 0 01-1.02 2.36 3.42 3.42 0 01-2.46.97h-2.36v.03zm0-6.31v4.93h2.39a1.96 1.96 0 001.47-.6 2 2 0 00.01-2.84 1.93 1.93 0 00-1.48-.6h-2.39v.11z" fill="#3C4043"/>
                <path d="M33.97 8.55c1.06 0 1.89.28 2.51.85.62.57.93 1.34.93 2.33v4.74H36v-1.07h-.05c-.59.87-1.38 1.31-2.36 1.31-.84 0-1.54-.25-2.1-.74a2.39 2.39 0 01-.84-1.88c0-.8.3-1.43.9-1.9.6-.47 1.4-.7 2.4-.7.85 0 1.56.15 2.1.46v-.33c0-.5-.2-.93-.59-1.28a2 2 0 00-1.37-.52c-.79 0-1.42.34-1.87 1.01l-1.32-.83c.67-1-.67-1.45-1.93-1.45zm-1.85 5.47c0 .38.17.7.5.95.32.26.7.38 1.12.38.61 0 1.14-.22 1.58-.67.45-.45.67-.97.67-1.56-.45-.35-1.07-.53-1.87-.53-.58 0-1.07.14-1.45.43a1.37 1.37 0 00-.55 1z" fill="#3C4043"/>
                <path d="M43.24 8.8l-4.63 10.64h-1.49l1.72-3.72-3.04-6.92h1.57l2.17 5.24h.03l2.11-5.24h1.56z" fill="#3C4043"/>
                <path d="M18.15 10.48c0-.46-.04-.9-.11-1.32h-6.56v2.5h3.75a3.21 3.21 0 01-1.39 2.1v1.75h2.25c1.32-1.21 2.08-3 2.08-5.03h-.02z" fill="#4285F4"/>
                <path d="M11.48 15.92c1.88 0 3.45-.62 4.6-1.68l-2.25-1.74c-.62.42-1.42.66-2.36.66-1.81 0-3.35-1.22-3.9-2.87H5.25v1.8a6.95 6.95 0 006.23 3.83z" fill="#34A853"/>
                <path d="M7.58 12.3a4.17 4.17 0 010-2.66v-1.8H5.25a6.96 6.96 0 000 6.26l2.33-1.8z" fill="#FBBC04"/>
                <path d="M11.48 6.76c1.02 0 1.94.35 2.66 1.04l2-2a6.59 6.59 0 00-4.66-1.81A6.95 6.95 0 005.25 7.83l2.33 1.8c.55-1.64 2.09-2.87 3.9-2.87z" fill="#EA4335"/>
              </svg>
            </span>
            {/* Apple Pay */}
            <span className="inline-flex items-center justify-center h-9 px-2.5 rounded-md bg-white" aria-label="Apple Pay">
              <svg viewBox="0 0 50 20" className="h-5" aria-hidden="true">
                <path d="M9.6 3.82a2.62 2.62 0 01-.6 1.88 2.23 2.23 0 01-1.76.88 2.41 2.41 0 01.01-.27c.05-.44.2-.87.46-1.24a2.67 2.67 0 011.75-1.23c.08-.02.12-.02.14-.02zM10.05 7c-.98-.06-1.82.56-2.28.56-.47 0-1.19-.53-1.96-.51a2.89 2.89 0 00-2.45 1.49c-1.05 1.81-.27 4.5.75 5.97.5.73 1.1 1.54 1.89 1.51.75-.03 1.04-.49 1.95-.49.91 0 1.17.49 1.96.47.82-.01 1.33-.73 1.83-1.47.58-.84.81-1.65.83-1.7-.02-.01-1.59-.61-1.6-2.42-.01-1.51 1.23-2.23 1.29-2.27a2.82 2.82 0 00-2.21-1.14z" fill="#000000"/>
                <path d="M17.78 4.16c2.38 0 4.04 1.64 4.04 4.03 0 2.41-1.69 4.06-4.1 4.06h-2.64v4.2H13.5V4.15h4.28v.01zm-2.7 6.57h2.19c1.66 0 2.6-.89 2.6-2.53 0-1.64-.94-2.52-2.59-2.52h-2.2v5.05z" fill="#000000"/>
                <path d="M22.64 13.34c0-1.57 1.2-2.53 3.34-2.66l2.46-.14v-.7c0-1-.67-1.6-1.79-1.6-.93 0-1.63.46-1.78 1.16h-1.44c.08-1.42 1.36-2.47 3.27-2.47 1.92 0 3.16 1.02 3.16 2.6v5.44h-1.43v-1.3h-.03c-.42.87-1.35 1.43-2.38 1.43-1.48 0-2.5-.92-2.5-2.32l.12.56zm5.8-.77v-.71l-2.21.14c-1.1.07-1.73.54-1.73 1.3 0 .77.65 1.27 1.65 1.27 1.3 0 2.29-.89 2.29-2z" fill="#000000"/>
                <path d="M31.08 18.6v-1.29c.1.03.34.03.44.03.63 0 .97-.27 1.18-.95 0-.02.12-.4.12-.41l-2.86-7.92h1.6l2.08 6.67h.03l2.08-6.67h1.56l-2.97 8.31c-.68 1.9-1.46 2.52-3.09 2.52-.1 0-.44-.02-.57-.05l.4-.24z" fill="#000000"/>
              </svg>
            </span>
          </div>
        </div>

        {/* Content Ratings */}
        <div className="mt-8 pt-6 border-t border-av-input-border/20 flex flex-col items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-av-light-orange">
            Content Ratings
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* ESRB Teen 14 */}
            <span className="inline-flex items-center justify-center h-10 w-10 rounded bg-white" aria-label="ESRB Teen 14">
              <svg viewBox="0 0 32 32" className="h-8 w-8">
                <rect width="32" height="32" rx="3" fill="#C62828"/>
                <text x="16" y="22" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="16" fill="#FFFFFF">14</text>
                <text x="16" y="9" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="5" fill="#FFFFFF">ESRB</text>
              </svg>
            </span>
            {/* ESRB Mature */}
            <span className="inline-flex items-center justify-center h-10 w-10 rounded bg-white" aria-label="ESRB Mature">
              <svg viewBox="0 0 32 32" className="h-8 w-8">
                <rect width="32" height="32" rx="3" fill="#1A1A1A"/>
                <text x="16" y="16" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="8" fill="#FFFFFF">RATED</text>
                <text x="16" y="26" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="12" fill="#FFFFFF">M</text>
              </svg>
            </span>
            {/* PEGI 18 */}
            <span className="inline-flex items-center justify-center h-10 w-10 rounded bg-white" aria-label="PEGI 18">
              <svg viewBox="0 0 32 32" className="h-8 w-8">
                <rect width="32" height="32" rx="3" fill="#C62828"/>
                <text x="16" y="10" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="6" fill="#FFFFFF">PEGI</text>
                <text x="16" y="26" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="16" fill="#FFFFFF">18</text>
              </svg>
            </span>
            {/* USK 18 */}
            <span className="inline-flex items-center justify-center h-10 w-10 rounded bg-white" aria-label="USK 18">
              <svg viewBox="0 0 32 32" className="h-8 w-8">
                <circle cx="16" cy="16" r="14" fill="#E65100" stroke="#C62828" strokeWidth="2"/>
                <text x="16" y="14" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="5" fill="#FFFFFF">USK</text>
                <text x="16" y="24" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="12" fill="#FFFFFF">18</text>
              </svg>
            </span>
            {/* IARC 18+ */}
            <span className="inline-flex items-center justify-center h-10 w-10 rounded bg-white" aria-label="IARC 18+">
              <svg viewBox="0 0 32 32" className="h-8 w-8">
                <rect width="32" height="32" rx="3" fill="#C62828"/>
                <text x="16" y="10" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="5" fill="#FFFFFF">IARC</text>
                <text x="16" y="26" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="14" fill="#FFFFFF">18+</text>
              </svg>
            </span>
            {/* GRAC 18 */}
            <span className="inline-flex items-center justify-center h-10 w-10 rounded bg-white" aria-label="GRAC 18">
              <svg viewBox="0 0 32 32" className="h-8 w-8">
                <circle cx="16" cy="16" r="14" fill="none" stroke="#1A1A1A" strokeWidth="2"/>
                <text x="16" y="22" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="16" fill="#1A1A1A">18</text>
              </svg>
            </span>
            {/* ClassInd 19 */}
            <span className="inline-flex items-center justify-center h-10 w-10 rounded bg-white" aria-label="ClassInd 19">
              <svg viewBox="0 0 32 32" className="h-8 w-8">
                <circle cx="16" cy="16" r="14" fill="#1A237E" stroke="#0D47A1" strokeWidth="2"/>
                <text x="16" y="22" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="16" fill="#FFFFFF">19</text>
              </svg>
            </span>
          </div>
          <p className="text-[10px] text-av-light-orange/60 text-center max-w-md">
            Content ratings on AfroVision are provided by the International Age Rating Coalition (IARC).
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-6 pt-6 border-t border-av-input-border/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-av-light-orange">
            &copy; {new Date().getFullYear()} AfroVision. All rights reserved.
          </p>
          <p className="text-xs text-av-light-orange">
            Made with ❤️ for Africa and the world
          </p>
        </div>
      </div>
    </footer>
  );
}
