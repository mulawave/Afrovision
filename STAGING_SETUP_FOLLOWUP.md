# ⚠️ IMPORTANT FOLLOWUP — Staging Setup Incomplete

**Status:** BLOCKED — Requires mainnet BNB to use BSC testnet faucet

## What's Done

- ✅ JWT_SECRET — auto-generated on staging startup
- ✅ WALLET_SECRET — auto-generated on staging startup
- ✅ TREASURY_PRIVATE_KEY — auto-generated on staging startup
- ✅ BSC_RPC — `https://data-seed-prebsc-1-s1.binance.org:8545/`
- ✅ PANCAKE_ROUTER — `0x9ac64cc6e4415144c455bd8e4837fea55603e5c3`
- ✅ WBNB_ADDRESS — `0xae13d989dac2f0debff460ac112a837c89baa7cd`
- ✅ TestVPT.sol compiled (Hardhat artifacts ready)
- ❌ VPT_TOKEN_ADDRESS — still zero address (needs deploy)

## What's Blocking

The BSC testnet faucet requires a small amount of **mainnet BNB** to dispense testnet BNB. Once you have mainnet BNB, follow the steps below.

## Steps To Complete

### 1. Fund Treasury With Testnet BNB

Treasury address: `0x77A74Bc8234ceDAF79dC1Ac3c885F55479FA00e9`

Go to: https://testnet.bnbchain.org/faucet-smart

Fund with enough testnet BNB for deployment + liquidity (~2 BNB recommended).

### 2. Deploy tVPT Token

```bash
cd backend

# Get the treasury private key from Firestore (logged on first server start)
# Or read it directly:
node -e "const S=require('./src/admin/settings.service');S.get('TREASURY_PRIVATE_KEY').then(k=>{console.log(k);process.exit(0)})"

# Deploy
DEPLOYER_PRIVATE_KEY=<paste_key_here> npm run deploy:testnet
```

This deploys the TestVPT ERC-20 token and auto-saves the address to Firestore `VPT_TOKEN_ADDRESS`.

### 3. Add PancakeSwap Liquidity

```bash
cd backend
npm run add-liquidity
```

Defaults: 1,000,000 tVPT + 1 BNB. Custom amounts: `npm run add-liquidity -- 500000 0.5`

### 4. Verify

```bash
cd backend
node test_blockchain_context.js
```

Expected output: `"ready": true`

## After Completion

The full economy pipeline will work end-to-end on BSC testnet:

```
Register → Subscribe → Split → Queue → Batch → PancakeSwap Swap → Distribute vPT → Wallet
```

Delete this file once staging is fully operational.
