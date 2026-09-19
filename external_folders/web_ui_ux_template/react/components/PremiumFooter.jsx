// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Footer Component
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';

/**
 * PremiumFooter — 4-column link layout with brand, social, copyright.
 *
 * Props:
 *   - brand (ReactNode) — brand logo area (defaults to PremiumLogo-style)
 *   - brandDescription (string)
 *   - columns (Array<{ title, links: Array<{ label, href }> }>)
 *   - socialLinks (Array<{ icon: ReactNode, href }>)
 *   - copyright (string)
 *   - className
 */
export default function PremiumFooter({
  brand,
  brandDescription = '',
  columns = [],
  socialLinks = [],
  copyright = `© ${new Date().getFullYear()} All rights reserved.`,
  className = '',
}) {
  return (
    <footer className={className} style={{
      borderTop: '1px solid rgba(30, 42, 90, 0.3)',
      padding: '3rem 0 2rem',
    }}>
      <div className="av-container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: `1.5fr repeat(${Math.min(columns.length, 3)}, 1fr)`,
          gap: '2rem',
        }}>
          {/* Brand column */}
          <div>
            {brand || (
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                <span style={{ color: 'var(--av-white)' }}>Afro</span>
                <span style={{ color: 'var(--av-orange)' }}>Vision</span>
              </div>
            )}
            {brandDescription && (
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--av-light-orange)', lineHeight: 1.6, maxWidth: '300px' }}>
                {brandDescription}
              </p>
            )}
            {socialLinks.length > 0 && (
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                {socialLinks.map((social, i) => (
                  <a
                    key={i}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--av-radius-md)',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--av-light-orange)',
                      transition: 'all 0.3s',
                      textDecoration: 'none',
                    }}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Link columns */}
          {columns.map((col, ci) => (
            <div key={ci}>
              <h4 style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'var(--av-white)',
                marginBottom: '1rem',
              }}>
                {col.title}
              </h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {col.links.map((link, li) => (
                  <a
                    key={li}
                    href={link.href}
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--av-light-orange)',
                      textDecoration: 'none',
                      transition: 'color 0.3s',
                    }}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div style={{
          marginTop: '2.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid rgba(30, 42, 90, 0.2)',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--av-hint)',
        }}>
          {copyright}
        </div>
      </div>
    </footer>
  );
}
