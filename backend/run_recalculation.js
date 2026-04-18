/**
 * Script to trigger the payout recalculation on the deployed backend.
 * Usage: node backend/run_recalculation.js <admin_password>
 *
 * Uses the /ops/recalculate-payouts endpoint protected by ADMIN_PASSWORD.
 */

const BASE_URL = 'https://afrovision-backend-134538542038.us-central1.run.app';
const ADMIN_PASSWORD = process.argv[2];

if (!ADMIN_PASSWORD) {
  console.error('Usage: node backend/run_recalculation.js <admin_password>');
  process.exit(1);
}

async function main() {
  console.log('=== AfroVision Payout Recalculation ===\n');
  console.log('Triggering payout recalculation...');
  console.log('This may take a while...\n');

  const res = await fetch(`${BASE_URL}/ops/recalculate-payouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: ADMIN_PASSWORD }),
  });

  const data = await res.json();

  if (res.status !== 200) {
    console.error('Recalculation failed:', res.status, data);
    process.exit(1);
  }

  console.log('=== RECALCULATION COMPLETE ===\n');
  console.log('Structure:', data.structure);
  console.log('\nReport:');
  const r = data.report;
  console.log(`  Subscriptions processed:        ${r.subscriptions_processed}`);
  console.log(`  Old creator shares reversed:     ${r.old_creator_shares_reversed}`);
  console.log(`  Old referral earnings reversed:  ${r.old_referral_earnings_reversed}`);
  console.log(`  New subscriber vPT rewards:      ${r.new_subscriber_vpt_rewards}`);
  console.log(`  New referral earnings created:   ${r.new_referral_earnings_created}`);
  console.log(`  Wallet adjustments made:         ${r.wallet_adjustments}`);
  console.log(`  Ledger entries created:          ${r.ledger_entries_created}`);

  if (r.errors && r.errors.length > 0) {
    console.log(`\n  Errors (${r.errors.length}):`);
    r.errors.forEach((e) => console.log(`    - ${e}`));
  } else {
    console.log('\n  No errors!');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
