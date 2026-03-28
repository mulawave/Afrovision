# AfroVision Ledger System - Complete Reference

## Ledger Entry Schema
```javascript
{
  id: UUID,
  uid: user_id | null,           // null for system-level events
  type: string,                   // one of the types below
  amount_ngn: number,             // Nigerian Naira amount (fiat)
  amount_vpt: number,             // vPT token amount (crypto)
  tx_hash: string | null,         // blockchain transaction hash
  status: 'pending' | 'success' | 'failed',
  meta: object,                   // event-specific metadata
  description: string | null,
  created_at: timestamp
}
```

## ALL Ledger Entry Types

### 1. PLAN_PAYMENT (Fiat ↔ Token Hybrid)
- **amount_ngn**: Full plan price (e.g., ₦5,000)
- **amount_vpt**: 0
- **Direction**: FIAT IN from user
- **Created by**: subscription.controller.js → subscribe()
- **Metadata**: 
  - `plan_id`: Plan UUID
  - `plan_name`: "standard" | "premium"
  - `method`: "fiat" | "vpt"
- **Description**: "{plan_name} plan subscription via {method}"
- **Status**: Always "success" when created

### 2. SPLIT (Fiat)
- **amount_ngn**: Portion of plan price allocated to vPT extraction (e.g., ₦300 from 20% community pool)
- **amount_vpt**: 0
- **Direction**: FIAT ROUTING
- **Created by**: subscription.controller.js → subscribe()
- **Metadata**:
  - `plan_price`: Original plan amount
  - `community_pool`: 20% of plan price (configurable via COMMUNITY_POOL_PERCENT)
  - `community_pool_rate`: 0.20
  - `vpt_extraction_rate`: 0.30 (configurable via VPT_EXTRACTION_PERCENT)
- **Description**: "Split: ₦{plan_price} → {rate}% pool (₦{pool}) → 30% vPT (₦{vpt_portion})"
- **Status**: Always "success" when created

### 3. VPT_QUEUE (Fiat → Crypto Transitional)
- **amount_ngn**: The NGN value queued for conversion to vPT
- **amount_vpt**: 0 (not yet swapped)
- **Direction**: QUEUING FIAT FOR CONVERSION
- **Created by**: distribution.service.js → queueVPT()
- **Metadata**:
  - `queue_id`: Queue item UUID
  - `reference_id`: Subscription or plan ID
- **Description**: "Queued ₦{amount} for vPT conversion"
- **Status**: Always "success" when created

### 4. VPT_SWAP (Fiat → Crypto On-Chain)
- **amount_ngn**: Total NGN value of the batch being swapped
- **amount_vpt**: 0 initially, updated to actual received amount on success
- **Direction**: FIAT → WBNB → VPT (off chain → blockchain)
- **Created by**: distribution.service.js → executeSwap()
- **Metadata**:
  - `batch_id`: Batch UUID
  - `total_bnb`: BNB intermediate amount (e.g., 0.002)
  - `item_count`: Number of queue items in batch
  - (on failure) `error`: Error message
- **Description**: "Batch {id}: ₦{amount} → {bnb} BNB ({count} items)"
- **Status**: "pending" → "success" (async) or "failed" on completion
- **TX Hash**: Present on success (PancakeSwap receipt.hash)

### 5. VPT_DISTRIBUTION (Crypto)
- **amount_ngn**: 0
- **amount_vpt**: Amount sent to creator wallet (e.g., 500 vPT)
- **Direction**: CRYPTO OUT to user BSC wallet
- **Created by**: distribution.service.js → distribute()
- **Metadata**:
  - `batch_id`: Batch UUID
  - `queue_id`: Queue item UUID
  - `wallet`: Creator's BSC address
- **Description**: "{vpt_amount} vPT → {wallet_address}"
- **Status**: "success" on completion or "failed" if transfer failed
- **TX Hash**: BSC network transaction hash

### 6. DISTRIBUTION_FAILED (Crypto - Error Case)
- **amount_ngn**: 0
- **amount_vpt**: The vPT amount that WOULD HAVE been sent (for accounting)
- **Direction**: N/A (error)
- **Created by**: distribution.service.js → distribute() (catch block)
- **Metadata**:
  - `batch_id`: Batch UUID
  - `queue_id`: Queue item UUID
  - `reason`: "no_active_wallet" | error_message
- **Description**: "No active wallet for user {uid}" or "Distribution failed: {error}"
- **Status**: Always "failed"
- **TX Hash**: Null

### 7. WALLET_CREATED (Crypto - Metadata)
- **amount_ngn**: 0
- **amount_vpt**: 0
- **Direction**: N/A (metadata)
- **Created by**: wallet.service.js → createWallet()
- **Metadata**: Empty {}
- **Description**: "BSC wallet created: {wallet_address}"
- **Status**: Always "success"
- **TX Hash**: Null (no on-chain tx)

### 8. SWAP_FAILED (Fiat → Crypto - Error Case)
- **amount_ngn**: Total NGN of failed batch
- **amount_vpt**: 0
- **Direction**: N/A (error)
- **Created by**: distribution.service.js → executeSwap() (catch block)
- **Metadata**:
  - `batch_id`: Batch UUID
  - `error`: Error message
  - `retry_count`: Current retry attempt
- **Description**: "Batch swap failed: {error_message}"
- **Status**: Always "failed"
- **TX Hash**: Null

## Endpoint Response Shapes

### GET /api/vpt/balance (User)
```json
{
  "balance": 1500.50,
  "transactions": [
    {
      "id": "UUID",
      "user_id": "user_id",
      "type": "vpt_distribution" | "subscription_payment",
      "amount": 1500.50,
      "description": "...",
      "created_at": "2024-...-ISO"
    }
  ]
}
```

### GET /api/vpt/ledger (User)
```json
{
  "ledger": [
    {
      "id": "UUID",
      "uid": "user_id",
      "type": "PLAN_PAYMENT" | "VPT_DISTRIBUTION" | ...,
      "amount_ngn": 5000,
      "amount_vpt": 500,
      "tx_hash": "0x..." | null,
      "status": "success" | "pending" | "failed",
      "meta": { ... },
      "description": "...",
      "created_at": 1711111111111
    }
  ]
}
```

### GET /api/vpt/distribution-queue (User/Creator)
```json
{
  "queue": [
    {
      "id": "UUID",
      "creator_uid": "user_id",
      "ngn_value": 300,
      "status": "pending" | "processing" | "completed" | "failed",
      "reference_id": "plan_uuid",
      "batch_id": null | "batch_uuid",
      "tx_hash": null,
      "vpt_amount": null,
      "retry_count": 0,
      "created_at": 1711111111111,
      "processed_at": null
    }
  ]
}
```

### GET /api/vpt/queue-stats (Admin)
```json
{
  "stats": {
    "queue": {
      "pending": 42,
      "processing": 5,
      "completed": 1250,
      "failed": 3,
      "permanently_failed": 0,
      "total_ngn_pending": 12600,
      "total_vpt_distributed": 125000
    },
    "batches": {
      "total": 87,
      "pending": 1,
      "swapped": 2,
      "distributed": 82,
      "failed": 2,
      "permanently_failed": 0,
      "total_ngn_processed": 87000,
      "total_vpt_swapped": 8700000
    }
  }
}
```

### GET /api/vpt/ledger-stats (Admin)
```json
{
  "stats": {
    "total_entries": 5420,
    "total_ngn_in": 87000,
    "total_vpt_distributed": 8700000,
    "total_swaps": 87,
    "total_failures": 5
  }
}
```

### POST /api/vpt/batch/process (Admin - Trigger Batch)
```json
{
  "result": {
    "batch_id": "UUID",
    "processed": 42,
    "distributed": 41,
    "total_ngn": 12600,
    "total_bnb": 0.00504,
    "total_vpt": 252000,
    "tx_hash": "0x...",
    "results": [
      {
        "id": "queue_uuid",
        "uid": "user_id",
        "vptAmount": 6000,
        "status": "completed" | "failed",
        "txHash": "0x...",
        "error": "wallet_not_found" | null
      }
    ]
  }
}
```

### GET /api/vpt/batch-history (Admin)
```json
{
  "batches": [
    {
      "id": "UUID",
      "total_ngn": 12600,
      "total_bnb": 0.00504,
      "total_vpt": 252000,
      "tx_hash": "0x...",
      "status": "distributed" | "swapped" | "pending" | "failed",
      "item_ids": ["queue_uuid1", "queue_uuid2"],
      "item_count": 42,
      "retry_count": 0,
      "created_at": 1711111111111,
      "swapped_at": 1711111111112,
      "distributed_at": 1711111111113
    }
  ]
}
```

### GET /api/vpt/failed-batches (Admin)
```json
{
  "batches": [
    { ... same as above but filtered to status === "failed" }
  ]
}
```

### POST /api/vpt/batch/:batchId/retry (Admin)
```json
{
  "result": {
    "batch_id": "UUID",
    "distributed": 40,
    "total": 42,
    "results": [...]
  }
}
```

### GET /api/vpt/treasury-balance (Admin)
```json
{
  "treasury": {
    "bnb": 0.5,
    "vpt": 1000000,
    "address": "0x...",
    "mode": "production" | "dev"
  }
}
```

## Wallet Structure

### Wallet Model (wallet.model.js)
```javascript
{
  id: "UUID",
  user_id: "user_id",
  bsc_address: "0x...",
  encrypted_private_key: "encrypted",
  status: "active" | "inactive",
  created_at: 1711111111111,
  last_used_at: 1711111111112 | null
}
```

### Safe Wallet (public response)
```json
{
  "id": "UUID",
  "user_id": "user_id",
  "bsc_address": "0x...",
  "status": "active",
  "created_at": 1711111111111,
  "last_used_at": null
}
```

## Ledger Creation Flow

### User Subscribes to Plan (5 ledger entries created)
1. **PLAN_PAYMENT**: amount_ngn = plan price, status = success
2. **SPLIT**: amount_ngn = vpt_portion, calculates distribution percentages
3. **VPT_QUEUE**: amount_ngn = vpt_portion, queued for conversion
4. **WALLET_CREATED** (async, non-blocking): BSC wallet auto-created
5. Later: **VPT_SWAP** (when batch processes): ₦ → BNB → vPT
6. Later: **VPT_DISTRIBUTION**: vPT sent to wallet (or **DISTRIBUTION_FAILED** if error)

### Distribution Pipeline Ledger Trail
- VPT_QUEUE → VPT_SWAP → [VPT_DISTRIBUTION | DISTRIBUTION_FAILED]
- If swap fails: SWAP_FAILED entry created, items retry
- Max 3 retries per item; failed items remain in ledger

## Key Configuration Settings
- **COMMUNITY_POOL_PERCENT** (default 20): % of subscription price to community pool
- **VPT_EXTRACTION_PERCENT** (default 30): % of community pool converted to vPT
- **NGN_TO_BNB_RATE** (default 0.0000004): Exchange rate for NGN → BNB
- **PANCAKE_ROUTER**: PancakeSwap router contract address
- **VPT_TOKEN_ADDRESS**: vPT token contract address
- **WBNB_ADDRESS**: Wrapped BNB contract address
- **TREASURY_PRIVATE_KEY**: Server key for executing swaps (production only)
- **BSC_RPC**: BSC network RPC endpoint

## Status Transitions for Queue Items
```
pending → processing → completed ✓
       ↘ processing → failed ↘
                    ↗ (retry) ↘ max 3 retries
```

## Status Transitions for Batches
```
pending → swapped → distributed ✓
       ↘ swapped → failed ↘
                 ↗ (retry) ↘ max 3 retries
```
