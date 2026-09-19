// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Pricing Page Template
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import PremiumScaffold from '../components/PremiumScaffold.jsx';
import { PremiumPlanCard } from '../components/PremiumCards.jsx';

/**
 * PricingPage — Subscription plans with tab toggle and billing period switch.
 *
 * Props:
 *   - tabs (Array<{ label, key }>)   e.g. [{ label: 'Viewers', key: 'viewer' }, ...]
 *   - plans (Record<tabKey, Array<{ name, price, period, features[], isPopular, ctaLabel }>>)
 *   - onSelectPlan(plan)
 *   - billingOptions (Array<{ label, key }>)  e.g. [{label: 'Monthly', key:'monthly'}, ...]
 *   - defaultTab, defaultBilling
 */
export default function PricingPage({
  tabs = [{ label: 'Viewers', key: 'viewer' }, { label: 'Creators', key: 'creator' }],
  plans = {},
  onSelectPlan,
  billingOptions = [{ label: 'Monthly', key: 'monthly' }, { label: 'Yearly', key: 'yearly' }],
  defaultTab = 'viewer',
  defaultBilling = 'monthly',
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [billing, setBilling] = useState(defaultBilling);

  const currentPlans = plans[activeTab] || [];

  return (
    <PremiumScaffold>
      <main style={{ minHeight: '100vh', paddingTop: '5rem', paddingBottom: '4rem' }}>
        <div className="av-container" style={{ maxWidth: '1100px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="av-animate-fade-in-up">
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--av-white)' }}>Choose your plan</h1>
            <p style={{ marginTop: '0.75rem', fontSize: '1rem', color: 'var(--av-light-orange)', maxWidth: '500px', margin: '0.75rem auto 0' }}>
              Start free and upgrade as you grow. Cancel anytime.
            </p>
          </div>

          {/* Tab toggle */}
          {tabs.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
              <div style={{
                display: 'inline-flex',
                borderRadius: 'var(--av-radius-full)',
                background: 'rgba(13, 20, 66, 0.6)',
                border: '1px solid rgba(30, 42, 90, 0.3)',
                padding: '4px',
              }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '0.5rem 1.5rem',
                      borderRadius: 'var(--av-radius-full)',
                      border: 'none',
                      background: activeTab === tab.key ? 'var(--av-gradient-cta)' : 'transparent',
                      color: activeTab === tab.key ? 'var(--av-dark-blue)' : 'var(--av-light-orange)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Billing toggle */}
          {billingOptions.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {billingOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setBilling(opt.key)}
                    style={{
                      padding: '0.375rem 1rem',
                      borderRadius: 'var(--av-radius-full)',
                      border: billing === opt.key ? '1px solid rgba(244,150,23,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      background: billing === opt.key ? 'rgba(244,150,23,0.1)' : 'transparent',
                      color: billing === opt.key ? 'var(--av-orange)' : 'var(--av-light-orange)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Plan cards grid */}
          <div className="av-stagger" style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(currentPlans.length, 3)}, 1fr)`,
            gap: '1.5rem',
            alignItems: 'start',
          }}>
            {currentPlans.map((plan, i) => (
              <PremiumPlanCard
                key={i}
                name={plan.name}
                price={plan.price}
                period={plan.period}
                features={plan.features}
                isPopular={plan.isPopular}
                ctaLabel={plan.ctaLabel}
                accentColor={plan.accentColor}
                onSelect={() => onSelectPlan && onSelectPlan({ ...plan, billing })}
              />
            ))}
          </div>
        </div>
      </main>
    </PremiumScaffold>
  );
}
