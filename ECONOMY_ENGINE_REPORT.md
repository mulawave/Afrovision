# Economy Engine — Current Implementation Report

## Overview

The AfroVision economy engine converts subscription payments into vPT rewards through a staged backend pipeline:

`PLAN_PAYMENT -> SPLIT -> VPT_QUEUE -> BATCH -> VPT_SWAP -> VPT_DISTRIBUTION`

The current implementation is no longer the old mock-only, in-memory version. The economy stack now includes:

- Firestore-backed persistence for users, wallets, ledger, queue items, batches, vPT transactions, and admin settings
- Firebase-only runtime settings for blockchain and system configuration
- staging blockchain readiness checks for real PancakeSwap execution
- exact wei accounting for swap and distribution records
- admin preflight visibility for blockchain readiness

The remaining gap to full staging swap execution is not architecture. It is live operator configuration.

---

## Current State

### Implemented
- Subscription payment logs to ledger as the financial source of truth
- Community-pool split and vPT extraction are driven by admin settings
- vPT conversion requests are queued and grouped into batches
- Batch swap execution is wired for real chain execution through PancakeSwap
- Swap receipts are parsed from ERC-20 `Transfer` logs instead of inferred balances
- Distribution sends exact token wei amounts to creator wallets
- Wallets, ledger, queue items, batches, and vPT transaction history persist in Firestore
- Admin settings persist in Firestore and auto-initialize on startup
- Admin blockchain preflight is exposed through backend and surfaced in Flutter for admins

### Not Yet Ready For Live Staging Swap
- `TREASURY_PRIVATE_KEY` still requires a real operator-provided value
- `VPT_TOKEN_ADDRESS` still requires the real deployed token contract address

These are the only current blockers shown by the readiness probe.

---

## Architecture

### Economy Flow

```text
Subscribe
  -> PLAN_PAYMENT ledger entry
  -> SPLIT ledger entry
  -> VPT_QUEUE item + ledger entry
  -> wallet auto-create if needed
  -> batch creation
  -> swap execution
  -> receipt parsing
  -> per-user token distribution
  -> VPT_DISTRIBUTION ledger entries
```

### Key Principles
- Ledger is the source of truth for financial events
- Queue items are batched before swap execution
- Swap execution and token transfer are separate stages
- Distribution failures are isolated per recipient
- Batches can be retried
- Token allocation uses exact wei math, with remainder handling on the last item

---

## Runtime Configuration

### Source Of Truth

All admin runtime settings are now Firestore-backed.

- No `.env` fallback is used for admin-managed blockchain or auth settings
- Missing settings documents are auto-created in Firestore
- Existing null or empty setting values are backfilled from intended defaults where safe

### Current Settings Model

| Setting | Default | Notes |
|---------|---------|-------|
| `ENVIRONMENT` | `staging` | Chain guard for staging vs production |
| `BSC_RPC` | `https://data-seed-prebsc-1-s1.bnbchain.org:8545` | BSC testnet RPC |
| `PANCAKE_ROUTER` | `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` | PancakeSwap testnet router |
| `WBNB_ADDRESS` | `0xae13d989dac2f0debff460ac112a837c89baa7cd` | Testnet WBNB |
| `VPT_TOKEN_ADDRESS` | `0x0000000000000000000000000000000000000000` | Placeholder only, still treated as not configured |
| `TREASURY_PRIVATE_KEY` | `null` | Must be supplied by operator |
| `WALLET_SECRET` | `null` | Must be supplied by operator |
| `JWT_SECRET` | `null` | Must be supplied by operator |
| `NGN_TO_BNB_RATE` | `0.0000004` | Used to convert queued NGN into swap BNB amount |
| `COMMUNITY_POOL_PERCENT` | `20` | Community pool share |
| `VPT_EXTRACTION_PERCENT` | `30` | Extracted share of community pool |
| `VPT_PRICE_NGN` | `750` | Display and economic reference price |
| `BATCH_SIZE` | `100` | Maximum items per batch |
| `MAX_RETRY_ATTEMPTS` | `3` | Retry ceiling |

---

## Backend Implementation

### Subscription Processing

`backend/src/subscriptions/subscription.controller.js`

Current behavior:
- supports fiat for first subscription and vPT for eligible renewals
- writes `PLAN_PAYMENT` ledger entry
- computes community-pool split from settings
- computes extracted vPT portion from settings
- writes `SPLIT` ledger entry
- queues conversion request
- creates wallet if missing
- attempts immediate batch processing

### Distribution Engine

`backend/src/vpt/distribution.service.js`

Current behavior:
- creates queue items and corresponding ledger entries
- groups pending items into batches
- executes swap at batch level
- records swap ledger state transitions
- distributes exact wei amounts per creator
- writes `VPT_DISTRIBUTION` and `DISTRIBUTION_FAILED` entries
- supports retrying failed batches

### Swap Execution

`backend/src/vpt/swap.service.js`

Current behavior:
- reads runtime config from Firestore settings only
- validates required blockchain fields before execution
- validates chain ID for `staging` and `production`
- executes real PancakeSwap router calls when configuration is complete
- parses received token amount from `Transfer` logs in the swap receipt
- exposes treasury balance, quote, and readiness helpers

Important change from earlier iterations:
- there is no active mock/dev execution path anymore
- `isDevMode()` is retained only as a compatibility helper and always returns `false`

### Persistence Layer

Firestore persistence is initialized at app startup in `backend/src/app.js`.

Current Firestore-backed models:
- `backend/src/users/user.model.js`
- `backend/src/wallet/wallet.model.js`
- `backend/src/vpt/ledger.model.js`
- `backend/src/vpt/distribution.model.js`
- `backend/src/vpt/batch.model.js`
- `backend/src/vpt/vpt.model.js`
- `backend/src/admin/settings.service.js`

This is no longer an in-memory-only system.

---

## Admin Visibility

### Backend Admin Endpoints

Implemented admin economy endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/vpt/admin/stats` | GET | Queue and batch stats |
| `/vpt/admin/ledger-stats` | GET | Ledger aggregates |
| `/vpt/admin/ledger` | GET | Full ledger view |
| `/vpt/admin/batches` | GET | Batch history |
| `/vpt/admin/batches/failed` | GET | Failed batch list |
| `/vpt/admin/batches/:batchId/retry` | POST | Retry failed batch |
| `/vpt/admin/preflight` | GET | Blockchain readiness |
| `/vpt/admin/process-batch` | POST | Manual batch trigger |
| `/vpt/admin/treasury` | GET | Treasury balances |

### Flutter Admin Visibility

There is no dedicated admin settings UI yet.

What exists now:
- admin-only blockchain preflight card inside the Digital Assets screen
- frontend service hook for `/vpt/admin/preflight`

Relevant files:
- `lib/features/wallet/services/wallet_service.dart`
- `lib/features/wallet/screens/digital_assets_screen.dart`

---

## Display Model

### User-Facing Display Rules

| Type | Primary Display | Secondary Display |
|------|----------------|-------------------|
| vPT balance | `8 vPT` | `≈ ₦6,000` |
| NGN value | `₦50,000` | optional economic equivalent |
| Exchange rate | `1 vPT = ₦750` | none |

Rules:
- vPT is displayed as a token, never as naira
- naira equivalents are secondary informational values
- Digital Assets is the main user-facing economy surface

---

## Verified Readiness Status

### Blockchain Preflight Result

The latest readiness result after Firestore default backfill is effectively:

```json
{
  "ready": false,
  "environment": "staging",
  "missing": [
    "TREASURY_PRIVATE_KEY",
    "VPT_TOKEN_ADDRESS"
  ]
}
```

Interpretation:
- Firestore defaults for `BSC_RPC`, `PANCAKE_ROUTER`, `WBNB_ADDRESS`, and `ENVIRONMENT` are now in place
- the engine wiring is present
- execution is blocked only by the missing operator key and real token address

### What This Means

The current codebase has regained architectural bearing:
- settings are centralized
- persistence is durable
- chain execution path is real
- receipt parsing is real
- remaining work is configuration and deployment, not another redesign

---

## Current Gaps

### Required Before Real Staging Swap
- set `TREASURY_PRIVATE_KEY` in Firestore
- replace placeholder `VPT_TOKEN_ADDRESS` with the deployed token address
- ensure treasury wallet holds enough testnet BNB
- ensure treasury wallet holds the token contract context expected by the swap path

### Intentionally Deferred
- dedicated admin settings editor UI
- broader admin dashboard UI
- production payment gateway integration

---

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `backend/src/subscriptions/subscription.controller.js` | Payment, split, queue, wallet create, auto-batch trigger |
| `backend/src/vpt/distribution.service.js` | Queue, batch, swap, distribute pipeline |
| `backend/src/vpt/swap.service.js` | Real blockchain execution, receipt parsing, readiness |
| `backend/src/vpt/ledger.model.js` | Ledger persistence and reporting |
| `backend/src/vpt/distribution.model.js` | Queue persistence |
| `backend/src/vpt/batch.model.js` | Batch persistence |
| `backend/src/vpt/vpt.model.js` | User vPT history persistence |
| `backend/src/wallet/wallet.service.js` | Wallet creation and encrypted key handling |
| `backend/src/wallet/wallet.model.js` | Wallet persistence |
| `backend/src/admin/settings.model.js` | Runtime settings definitions and defaults |
| `backend/src/admin/settings.service.js` | Firestore-backed settings source of truth |
| `backend/src/app.js` | Startup initialization for settings and persistence models |
| `backend/test_blockchain_context.js` | Direct blockchain readiness probe |

### Flutter

| File | Purpose |
|------|---------|
| `lib/features/wallet/screens/digital_assets_screen.dart` | Main economy dashboard and admin preflight card |
| `lib/features/wallet/services/wallet_service.dart` | Wallet, ledger, and admin preflight API calls |
| `lib/features/profile/screens/profile_screen.dart` | User-facing vPT display |

---

## Summary

The AfroVision economy engine has moved from a prototype into a persistent, Firestore-backed staged execution system.

What is solid now:
- ledger-first accounting
- queue and batch orchestration
- Firestore persistence
- Firebase-only runtime settings
- real blockchain execution path
- exact receipt parsing
- admin readiness visibility

What remains:
- provide the real treasury private key
- provide the real vPT token address
- then run staging swaps end to end against the configured testnet environment
