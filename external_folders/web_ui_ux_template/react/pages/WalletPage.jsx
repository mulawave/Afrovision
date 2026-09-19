// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Wallet Page Template
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import PremiumScaffold from '../components/PremiumScaffold.jsx';
import { PremiumWalletStatCard, PremiumCard } from '../components/PremiumCards.jsx';
import { PremiumButton, PremiumPillButton } from '../components/PremiumButton.jsx';
import { PremiumSpinner } from '../components/PremiumFeedback.jsx';

/**
 * WalletPage — Finance wallet page with balance cards, action buttons, ledger.
 *
 * Props:
 *   - stats (Array<{ label, value, variant }>)
 *   - availableBalance (string)
 *   - currency (string)
 *   - onTopUp, onConvert, onWithdraw
 *   - recentLedger (Array<{ id, type, amount, date }>)
 *   - loading (bool)
 *   - children
 */
export default function WalletPage({
  stats = [],
  availableBalance = '₦0',
  currency = 'NGN',
  onTopUp,
  onConvert,
  onWithdraw,
  recentLedger = [],
  loading = false,
  children,
}) {
  return (
    <PremiumScaffold>
      <main style={{ minHeight: '100vh', paddingTop: '5rem', paddingBottom: '4rem' }}>
        <div className="av-container">
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.3em', color: 'var(--av-light-orange)' }}>Finance</p>
            <h1 style={{ marginTop: '0.5rem', fontSize: '1.875rem', fontWeight: 700, color: 'var(--av-white)' }}>Wallet</h1>
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--av-light-orange)' }}>
              Track your balances, recent activity, and manage your funds.
            </p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
              <PremiumSpinner />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Stat cards grid */}
              {stats.length > 0 && (
                <div className="av-grid-4">
                  {stats.map((stat, i) => (
                    <PremiumWalletStatCard key={i} label={stat.label} value={stat.value} variant={stat.variant} />
                  ))}
                </div>
              )}

              {/* Balance + Actions Hero */}
              <section style={{
                borderRadius: 'var(--av-radius-lg)',
                border: '1px solid rgba(244, 150, 23, 0.3)',
                background: 'linear-gradient(to right, var(--av-dark-blue), var(--av-card-bg))',
                padding: '1.5rem',
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.25em', color: 'var(--av-light-orange)', marginBottom: '0.25rem' }}>
                      Available for Withdrawal
                    </p>
                    <p style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--av-white)' }}>
                      {availableBalance}
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: 400, color: 'var(--av-light-orange)' }}>{currency}</span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {onTopUp && <PremiumPillButton variant="orange" onClick={onTopUp}>+ Top Up</PremiumPillButton>}
                    {onConvert && <PremiumPillButton variant="purple" onClick={onConvert}>↔ Convert</PremiumPillButton>}
                    {onWithdraw && <PremiumButton onClick={onWithdraw}>Request Withdrawal</PremiumButton>}
                  </div>
                </div>
              </section>

              {/* Recent Ledger */}
              {recentLedger.length > 0 && (
                <PremiumCard>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--av-white)' }}>Recent Ledger</h2>
                    <a href="/wallet/transactions" style={{ fontSize: '0.6875rem', color: 'var(--av-orange)', textDecoration: 'none' }}>
                      View All →
                    </a>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {recentLedger.map((entry) => (
                      <div key={entry.id} style={{
                        borderRadius: 'var(--av-radius-md)',
                        border: '1px solid rgba(30, 42, 90, 0.2)',
                        background: 'rgba(13, 20, 66, 0.3)',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div>
                          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--av-white)' }}>
                            {entry.type?.replace(/_/g, ' ')}
                          </p>
                          <p style={{ fontSize: '0.6875rem', color: 'var(--av-light-orange)', marginTop: '0.25rem' }}>
                            {entry.date}
                          </p>
                        </div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--av-orange)' }}>
                          {entry.amount}
                        </p>
                      </div>
                    ))}
                  </div>
                </PremiumCard>
              )}

              {children}
            </div>
          )}
        </div>
      </main>
    </PremiumScaffold>
  );
}
