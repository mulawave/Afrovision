# Autopulse Financial System Synchronization Guide

## Executive Summary

This guide ensures Autopulse uses the exact same financial fields, transaction types, balance calculations, and exchange rates as AfroVision. All financial data must remain **in the same Firestore user document fields** and be tracked identically to prevent splits, discrepancies, or drift between the two applications.

## 1. Financial Fields (Master Reference)

All user financial data lives in the **users/{uid}** Firestore document. These fields are **authoritative** across both AfroVision and Autopulse.

### Core Balance Fields

| Field | Type | Unit | Description | Example |
|-------|------|------|-------------|---------|
| `vpt` | float | units | vPT units held in wallet | 150.5500 |
| `cash` | float | NGN | Nigerian Naira balance | 50000.00 |
| `coins` | float | Ravens | Ravens (internal token for conversion) | 11250 |
| `blockchain_tokens` | string | raw value | Raw blockchain token balance (optional) | "1234567890000000000" |

### Supporting Fields for Balance Context

| Field | Type | Purpose |
|-------|------|---------|
| `preferred_currency` | string | Primary currency for display (NGN, USD, etc.) |
| `bank_details` | object | Bank account for withdrawals |
| `kyc_status` | enum | KYC verification level (none, pending, verified, rejected) |
| `is_premium_creator` | boolean | Creator plan eligibility flag |

### Precision Rules

**MUST** follow these rounding rules to avoid financial drift:

```javascript
// vPT: 4 decimal places (smallest unit = 0.0001)
vpt = Math.round(vpt * 10000) / 10000;

// Cash (NGN): 2 decimal places (kobo)
cash = Math.round(cash * 100) / 100;

// Coins (Ravens): 2 decimal places
coins = Math.round(coins * 100) / 100;
```

## 2. Exchange Rates (Fixed Configuration)

These rates are **system-wide constants** that must be identical across both apps.

### VPT ↔ Ravens Exchange
```
VPT_RAVEN_RATE = 75  (configurable via settings, default: 75)

1 vPT = 75 Ravens
75 Ravens = 1 vPT
```

Validation:
- Minimum ravens needed to convert: VPT_RAVEN_RATE (default 75)
- Conversion formula: `vptGained = Math.floor(ravensSpent) / VPT_RAVEN_RATE`
- Exact ravens consumed: `ravensUsed = Math.floor(vptGained * VPT_RAVEN_RATE)`

### vPT ↔ NGN (Reference Only)
```
1 vPT ≈ ₦750 (used for display estimates only, not enforced in transactions)
```

This is display-only and **never** used for balance calculations or conversions.

### Conversion Examples

**Ravens → vPT:**
```javascript
// User wants to convert 150 Ravens
const ravensToSpend = 150;
const vptRavenRate = 75;
const vptGained = Math.floor(ravensToSpend) / vptRavenRate;  // 2.0
const ravensActuallyUsed = Math.floor(vptGained * vptRavenRate);  // 150
// Result: gain 2.0 vPT, lose 150 ravens
```

**vPT → Ravens:**
```javascript
// User wants to convert 1.5 vPT
const vptToSpend = 1.5;
const vptRavenRate = 75;
const ravensGained = Math.floor(vptToSpend * vptRavenRate);  // 112
// Result: gain 112 ravens, lose 1.5 vPT
```

## 3. Transaction Ledger Schema (Audit Trail)

Every financial event **MUST** create a ledger entry in **ledger/{id}** collection for audit and reconciliation.

### Ledger Document Structure

```javascript
{
  id: "uuid",
  uid: "user-id",
  type: "GIFT_SENT_VPT",  // Transaction type (see types below)
  direction: "debit",     // "credit" or "debit"
  currency: "vpt",        // "vpt", "ngn", or "ravens"
  amount_vpt_units: 50.5,
  amount_ngn: 0,
  balance_before: 100.0,  // Wallet balance before transaction
  balance_after: 49.5,    // Wallet balance after transaction
  reference_id: "gift-id",
  channel_id: "channel-id",
  status: "success",      // "pending", "success", "failed"
  tx_hash: "0x...",       // Blockchain hash if applicable
  description: "Gift sent to creator",
  meta: {
    // Additional context specific to transaction type
    gift_id: "...",
    creator_id: "...",
    channel_type: "live"
  },
  created_at: 1724000000000  // Timestamp in milliseconds
}
```

### Required Transaction Types

Autopulse **must** support at least these types:

```
GIFT_SENT_VPT          — Gift sent (vPT debit)
GIFT_RECEIVED_VPT      — Gift received (vPT credit)
GIFT_SENT_NGN          — Gift sent (NGN debit)
GIFT_RECEIVED_NGN      — Gift received (NGN credit)
PLAN_PAYMENT           — Subscription payment
SPLIT                  — Community pool allocation
RAVENS_TO_VPT          — Ravens converted to vPT
VPT_TO_RAVENS          — vPT converted to Ravens
WALLET_TOPUP_VPT       — Payment topup for vPT
WALLET_TOPUP_NGN       — Payment topup for NGN
WITHDRAWAL             — Cash withdrawal request
WITHDRAWAL_COMPLETED   — Withdrawal sent to bank
WITHDRAWAL_FAILED      — Withdrawal failed
CERS_VIOLATION_FINE    — Community standards fine (NGN debit)
```

### Ledger Entry Rules

1. **Every** balance change must be preceded by a ledger entry
2. Ledger entries are **immutable** (never delete or modify once created)
3. Entries must be written **atomically** with user balance updates using Firestore transactions
4. Balance fields (`balance_before`, `balance_after`) are **mandatory** for every entry

## 4. User Model Operations (API Contract)

Autopulse backend must expose these user model methods to match AfroVision's interface.

### Balance Adjustment Methods

```javascript
// Increment/decrement vPT balance
async User.adjustVpt(userId, delta)
  -> returns updated user document
  -> updates ledger if needed
  -> updates user_balances summary

// Increment/decrement NGN (cash) balance
async User.adjustCash(userId, delta)
  -> returns updated user document
  -> updates ledger if needed
  -> updates user_balances summary

// Increment/decrement Ravens (coins) balance
async User.adjustCoins(userId, delta)
  -> returns updated user document
  -> updates ledger if needed
  -> updates user_balances summary
```

### User Lookup Methods

```javascript
async User.findById(uid)           // Load user by ID
async User.findByEmail(email)      // Load user by email
async User.loadUserById(id)        // Load with dedup
```

### Required Methods for Balance Operations

```javascript
// Transaction-safe balance update
async function adjustVpt(userId, delta) {
  const user = await findById(userId);
  if (!user) return null;
  user.vpt = Math.round(((user.vpt || 0) + delta) * 10000) / 10000;
  await persistUser(user);
  return user;
}

async function adjustCash(userId, delta) {
  const user = await findById(userId);
  if (!user) return null;
  user.cash = Math.round(((user.cash || 0) + delta) * 100) / 100;
  await persistUser(user);
  return user;
}

async function adjustCoins(userId, delta) {
  const user = await findById(userId);
  if (!user) return null;
  user.coins = Math.round(((user.coins || 0) + delta) * 100) / 100;
  await persistUser(user);
  return user;
}
```

## 5. Gift Transaction Pattern (Atomic Example)

This is **the** critical pattern for gift sends. It ensures atomicity and correctness.

### Backend Gift Send Flow

```javascript
async function sendGift(senderUid, recipientUid, gift, channelId) {
  const db = getFirestore();
  
  // Atomic transaction to prevent race conditions
  return db.runTransaction(async (tx) => {
    // Load both users in transaction context
    const senderRef = db.collection('users').doc(senderUid);
    const recipientRef = db.collection('users').doc(recipientUid);
    
    const senderDoc = await tx.get(senderRef);
    const recipientDoc = await tx.get(recipientRef);
    
    const senderData = senderDoc.exists ? senderDoc.data() : { id: senderUid, vpt: 0 };
    const recipientData = recipientDoc.exists ? recipientDoc.data() : { id: recipientUid, vpt: 0 };
    
    // Calculate shares (e.g., 70% creator, 20% ops, 10% community)
    const SPLIT = { creator: 0.7, ops: 0.2, community: 0.1 };
    const cost = gift.vpt_units;  // Amount sender pays
    const creatorShare = cost * SPLIT.creator;
    const opsShare = cost * SPLIT.ops;
    const communityShare = cost * SPLIT.community;
    
    // Validate balances
    const senderBefore = senderData.vpt || 0;
    if (senderBefore < cost) throw new Error('INSUFFICIENT_VPT');
    
    // Calculate new balances
    const senderAfter = senderBefore - cost;
    const recipientBefore = recipientData.vpt || 0;
    const recipientAfter = recipientBefore + creatorShare;
    
    // Write balance updates
    tx.update(senderRef, { vpt: senderAfter });
    tx.update(recipientRef, { vpt: recipientAfter });
    
    // Write ledger entry (sender perspective)
    const ledgerRef = db.collection('ledger').doc(crypto.randomUUID());
    tx.set(ledgerRef, {
      id: ledgerRef.id,
      uid: senderUid,
      type: 'GIFT_SENT_VPT',
      direction: 'debit',
      currency: 'vpt',
      amount_vpt_units: cost,
      balance_before: senderBefore,
      balance_after: senderAfter,
      reference_id: gift.id,
      channel_id: channelId,
      status: 'success',
      description: 'Gift sent',
      created_at: Date.now(),
      meta: { gift_id: gift.id, channel_id: channelId }
    });
    
    // Write ledger entry (recipient perspective)
    const recipientLedgerRef = db.collection('ledger').doc(crypto.randomUUID());
    tx.set(recipientLedgerRef, {
      id: recipientLedgerRef.id,
      uid: recipientUid,
      type: 'GIFT_RECEIVED_VPT',
      direction: 'credit',
      currency: 'vpt',
      amount_vpt_units: creatorShare,
      balance_before: recipientBefore,
      balance_after: recipientAfter,
      reference_id: gift.id,
      channel_id: channelId,
      status: 'success',
      description: 'Gift received',
      created_at: Date.now(),
      meta: { gift_id: gift.id, channel_id: channelId }
    });
    
    return {
      senderAfter,
      recipientAfter,
      creatorShare,
      opsShare,
      communityShare,
      ledgerId: ledgerRef.id
    };
  });
}
```

### Key Principles

1. **Atomicity**: Both balance writes and ledger writes must succeed together or fail together
2. **Balance Before/After**: Always capture state before and after for audit trail
3. **Share Calculation**: Creator receives percentage, ops and community get their cut
4. **Reference ID**: Link ledger entry to the gift/transaction that caused it
5. **Metadata**: Store enough context to reconstruct the full event

## 6. Withdrawal Flow (NGN Cash Out)

### Withdrawal Request Schema

```javascript
{
  id: "uuid",
  uid: "user-id",
  amount: 50000,           // Requested amount in NGN
  currency: "ngn",
  bank_details: {
    account_number: "...",
    bank_code: "...",
    account_name: "..."
  },
  transaction_fee: 100,     // Provider processing fee
  service_charge: 50,       // Platform service charge
  total_fees: 150,
  vat_amount: 25,          // VAT on fees
  vat_rate: 0.075,
  total_debit: 50175,      // amount + total_fees + vat
  status: "pending",       // "pending", "processing", "completed", "failed"
  tx_hash: null,           // Updated when completed
  created_at: timestamp,
  completed_at: null
}
```

### Withdrawal Ledger Entry

```javascript
// When withdrawal is initiated
{
  uid: userId,
  type: "WITHDRAWAL",
  direction: "debit",
  currency: "ngn",
  amount_ngn: 50175,  // total_debit
  balance_before: 100000,
  balance_after: 49825,
  reference_id: withdrawalId,
  status: "pending"
}

// When completed
{
  status: "success",
  tx_hash: "bank_reference_code"
}

// If failed
{
  status: "failed",
  meta: { reason: "..." }
}
```

## 7. Gift Wallet Model (Deprecated → Unified on User Doc)

**Important**: In modern AfroVision, balances live **on the user document** (`users/{uid}.vpt`, `.cash`). The old `gift_wallets` collection is **deprecated** but may still be referenced for backward compatibility.

### Migration Bridge (Autopulse)

For compatibility, implement a wrapper:

```javascript
// Autopulse gift_wallet.model.js
function toWalletShape(user) {
  return {
    uid: user.id,
    vpt_units: user.vpt || 0,
    ngn_balance: user.cash || 0,
    updated_at: Date.now()
  };
}

async function adjustVptUnits(uid, delta) {
  const updated = await User.adjustVpt(uid, delta);
  return toWalletShape(updated);
}

async function adjustNgnBalance(uid, delta) {
  const updated = await User.adjustCash(uid, delta);
  return toWalletShape(updated);
}
```

**Do not** create a separate gift_wallets collection. Always read/write the user document directly.

## 8. Ravens ↔ vPT Conversion Endpoint

### POST /interactions/convert

```javascript
// Request
{
  pair: "ravens_to_vpt",  // or "vpt_to_ravens"
  amount: 150             // Amount to convert (ravens or vpt)
}

// Processing (ravens → vpt)
const ravensToSpend = Math.floor(amount);
const vptRavenRate = 75;  // From settings
if (ravensToSpend < vptRavenRate) {
  return 400: "Minimum ${vptRavenRate} Ravens required"
}
const vptGained = parseFloat((ravensToSpend / vptRavenRate).toFixed(4));
const ravensUsed = Math.floor(vptGained * vptRavenRate);

// Transactionally:
db.runTransaction(async (tx) => {
  // Get user, validate coins balance
  const user = await tx.get(userRef);
  const currentCoins = user.coins || 0;
  if (currentCoins < ravensUsed) throw new Error('INSUFFICIENT_RAVENS');
  
  // Update balances
  tx.update(userRef, {
    coins: currentCoins - ravensUsed,
    vpt: (user.vpt || 0) + vptGained
  });
  
  // Write ledger entries
  tx.set(ledgerRef, { /* conversion record */ });
});

// Response
{
  message: "Converted 150 Ravens → 2.0 vPT",
  wallet: { vpt: 102.0, cash: 50000, coins: 850 }
}
```

## 9. Balance Summary (Operational Dashboard)

Autopulse should maintain a summary document for financial reporting:

### ops_summaries/user_balances

```javascript
{
  total_cash: 5000000,       // Sum of all users' cash
  total_vpt: 150000,         // Sum of all users' vpt
  total_coins: 1125000,      // Sum of all users' coins
  updated_at: timestamp      // Last updated
}
```

**Update this document** whenever any user balance changes via `User.adjustVpt/adjustCash/adjustCoins`.

```javascript
async function incrementUserBalanceSummary({ cashDelta, vptDelta, coinsDelta }) {
  const db = getFirestore();
  const docRef = db.collection('ops_summaries').doc('user_balances');
  
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);
    const current = snapshot.exists ? snapshot.data() : {};
    
    tx.set(docRef, {
      total_cash: (current.total_cash || 0) + (cashDelta || 0),
      total_vpt: (current.total_vpt || 0) + (vptDelta || 0),
      total_coins: (current.total_coins || 0) + (coinsDelta || 0),
      updated_at: Date.now()
    }, { merge: true });
  });
}
```

## 10. Reconciliation and Auditing

### Balance Verification

To verify a user's balance is consistent:

```javascript
async function calculateBalanceFromLedger(uid, currency) {
  const db = getFirestore();
  const snapshot = await db.collection('ledger')
    .where('uid', '==', uid)
    .where('currency', '==', currency)
    .where('status', '==', 'success')
    .get();
  
  let balance = 0;
  snapshot.forEach(doc => {
    const d = doc.data();
    const amount = currency === 'vpt'
      ? (d.amount_vpt_units || 0)
      : (d.amount_ngn || 0);
    
    if (d.direction === 'credit') balance += amount;
    else if (d.direction === 'debit') balance -= amount;
  });
  
  return parseFloat(balance.toFixed(currency === 'vpt' ? 4 : 2));
}

// Compare with stored balance
const ledgerBalance = await calculateBalanceFromLedger(userId, 'vpt');
const storedBalance = user.vpt;
if (ledgerBalance !== storedBalance) {
  console.warn(`Balance mismatch for ${userId}: ledger=${ledgerBalance}, stored=${storedBalance}`);
}
```

### Audit Report

Generate a daily/weekly reconciliation report:

```javascript
{
  date: "2025-05-27",
  total_users: 15000,
  
  vpt: {
    total_stored: 150000,
    total_from_ledger: 150000,
    diff: 0,
    status: "OK"
  },
  
  ngn: {
    total_stored: 5000000,
    total_from_ledger: 5000000,
    diff: 0,
    status: "OK"
  },
  
  ravens: {
    total_stored: 1125000,
    total_from_ledger: 1125000,
    diff: 0,
    status: "OK"
  },
  
  transaction_count: 125000,
  failed_transactions: 3,
  pending_withdrawals: 42
}
```

## 11. Firestore Indexes Required

Create these composite indexes for efficient balance queries:

```
Collection: ledger
Fields:
- uid (Asc)
- status (Asc)
- created_at (Desc)

Collection: ledger
Fields:
- uid (Asc)
- currency (Asc)
- status (Asc)

Collection: ledger
Fields:
- type (Asc)
- status (Asc)
- created_at (Desc)

Collection: users
Fields:
- kyc_status (Asc)
- created_at (Desc)
```

## 12. Implementation Checklist

Before go-live, verify:

### Database Schema
- [ ] `users/{uid}` has fields: vpt, cash, coins, blockchain_tokens
- [ ] `ledger/{id}` collection exists with all required fields
- [ ] `ops_summaries/user_balances` document created and updated
- [ ] Firestore indexes deployed

### Backend Services
- [ ] User.adjustVpt, User.adjustCash, User.adjustCoins implemented
- [ ] Ledger service with record() and recordAsync()
- [ ] Gift send endpoint with atomic transaction
- [ ] Withdrawal flow with ledger entries
- [ ] Ravens ↔ vPT conversion with validation
- [ ] Settings service provides VPT_RAVEN_RATE

### API Endpoints
- [ ] GET /interactions/wallet — returns wallet with vpt, cash, coins
- [ ] POST /interactions/gift-send — atomic gift transaction
- [ ] POST /interactions/convert — ravens ↔ vpt conversion
- [ ] POST /wallet/withdraw — withdrawal initiation
- [ ] GET /wallet/transactions — transaction history

### Client Integration
- [ ] Mobile (Flutter) fetches wallet on auth
- [ ] Web (React) syncs wallet state
- [ ] Display balances with correct precision (vpt: 4dp, cash: 2dp, coins: 2dp)
- [ ] Show exchange rates on conversion UI

### Testing
- [ ] Gift send atomicity test
- [ ] Insufficient balance test
- [ ] Precision/rounding test
- [ ] Ravens conversion test (both directions)
- [ ] Withdrawal flow test
- [ ] Ledger audit test
- [ ] Balance summary consistency test

### Monitoring
- [ ] Alert on balance summary drift
- [ ] Alert on failed ledger writes
- [ ] Alert on pending withdrawal spike
- [ ] Daily reconciliation report generated

## 13. Troubleshooting

### Issue: vPT Balance Mismatch

**Symptom**: User reports incorrect vPT balance.

**Resolution**:
1. Recalculate balance from ledger: `calculateBalanceFromLedger(uid, 'vpt')`
2. Compare with `users/{uid}.vpt`
3. If ledger is correct, update user doc to match
4. Investigate any ledger entries with `status: 'pending'` or `'failed'`

### Issue: Withdrawal Stuck in Pending

**Symptom**: User withdrawal request not completing.

**Resolution**:
1. Check withdrawal document status
2. Verify bank details are valid
3. Check ledger entry for the withdrawal (should be `type: 'WITHDRAWAL'`)
4. If error, update ledger entry status to 'failed' and reverse the balance

### Issue: Conversion Math Errors

**Symptom**: User loses ravens during conversion.

**Resolution**:
1. Verify VPT_RAVEN_RATE is set consistently
2. Check conversion formula: `ravensUsed = Math.floor(vptGained * rate)`
3. Ensure exact ravens consumed is written to ledger
4. Verify both sides of conversion are recorded

### Issue: Gift Recipients Missing vPT

**Symptom**: Creator receives gift notification but balance doesn't increase.

**Resolution**:
1. Check both ledger entries exist (sender debit + recipient credit)
2. Verify both wrote atomically (same transaction)
3. Check balance_after values match the expected distribution
4. If ledger is correct, manually update user doc

## 14. Cross-App Synchronization Strategy

### Shared Backend (Recommended)

Both AfroVision and Autopulse call the **same** backend endpoints:
```
POST /auth/pak-login
POST /interactions/gift-send
POST /interactions/convert
POST /wallet/withdraw
GET /interactions/wallet
```

This ensures identical behavior and zero drift.

### Replicated Backend (If Separate)

If Autopulse has its own backend:
1. Implement **exact same** logic in both services
2. Share `vpt.model.js`, `user.model.js`, `ledger.model.js` as a library
3. Run daily reconciliation to catch divergence
4. Use feature flags to ensure parity

### Firestore Database

Both apps **must** read/write the **same** Firestore project and database:
- Same `users` collection
- Same `ledger` collection
- Same `ops_summaries` document

This is non-negotiable for financial correctness.

## 15. Settings Configuration

Autopulse must respect these Firestore settings documents:

```
settings/{category}/{key}

VPT_RAVEN_RATE: 75                    (default, overrideable)
VPT_TO_NGN_RATE: 750                  (display reference only)
GIFT_SHARE_CREATOR_PCT: 70            (% creator receives)
GIFT_SHARE_OPS_PCT: 20                (% ops receives)
GIFT_SHARE_COMMUNITY_PCT: 10          (% community receives)
WITHDRAWAL_MIN_AMOUNT: 1000           (minimum withdrawal NGN)
WITHDRAWAL_MAX_AMOUNT: 5000000        (maximum withdrawal NGN)
WITHDRAWAL_FEE_PERCENT: 0.02          (% transaction fee)
WITHDRAWAL_SERVICE_CHARGE: 50         (fixed service charge NGN)
WITHDRAWAL_VAT_RATE: 0.075            (VAT on fees)
```

Load these at startup and refresh every 1 hour.

## 16. Acceptance Criteria

Autopulse financial system is production-ready when:

1. ✅ All four balance fields (vpt, cash, coins, blockchain_tokens) synced on user doc
2. ✅ Every transaction creates a ledger entry with balance_before/after
3. ✅ Gift send is atomic (both user updates and ledger write together)
4. ✅ Ravens ↔ vPT conversions use VPT_RAVEN_RATE = 75
5. ✅ Precision rules enforced (vpt: 4dp, cash/coins: 2dp)
6. ✅ Withdrawal flow ends with ledger entry and balance debit
7. ✅ ops_summaries/user_balances stays in sync with user doc sums
8. ✅ All financial endpoints return wallet shape: {vpt, cash, coins}
9. ✅ Ledger audit shows 100% consistency with stored balances
10. ✅ Daily reconciliation report passes with zero drift

---

Prepared for Autopulse developer implementation.
Source of truth: AfroVision codebase.
Last updated: May 27, 2025.
