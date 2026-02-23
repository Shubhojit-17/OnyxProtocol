# Onyx Protocol — Starknet Integration

## Architecture Overview

```
┌─────────────────────┐    ┌─────────────────────────┐    ┌──────────────────────┐
│    Frontend (React)  │    │    Backend (Express)     │    │  Starknet Network    │
│                      │    │                          │    │                      │
│  @starknet-io/       │    │  starknet.js             │    │  OnyxDarkPool.cairo  │
│  get-starknet        │───▶│  (RPC Provider + Account)│───▶│                      │
│                      │    │                          │    │  • Commitments       │
│  ArgentX / Braavos   │    │  Operator Account        │    │  • Matches           │
│  wallet connection   │    │  (signs match/settle tx) │    │  • Settlements       │
│                      │    │                          │    │  • Vault balances     │
│  starknet.js         │    │  PostgreSQL (off-chain)   │    │                      │
│  (contract calls)    │    │  (order details, history) │    │  Starknet Sepolia    │
└─────────────────────┘    └─────────────────────────┘    └──────────────────────┘
```

## Components

### 1. Cairo Smart Contract (`contracts/`)

The `OnyxDarkPool` contract handles on-chain operations:

- **`submit_commitment`** — Users submit Pedersen commitment hashes that hide order details
- **`record_match`** — Operator records a match between two commitments (after off-chain matching)
- **`settle_match`** — Operator finalizes settlement with a proof hash
- **`vault_deposit` / `vault_withdraw`** — On-chain shielded vault management

**Build & Test:**
```bash
cd contracts
scarb build
snforge test
```

### 2. Frontend Starknet Integration (`frontend/src/app/`)

- **Wallet**: Uses `@starknet-io/get-starknet` for wallet modal (ArgentX, Braavos)
- **Contract calls**: `starknet.js` `RpcProvider` + `Contract` for reading chain state
- **Account signing**: Users sign transactions through their Starknet wallet
- **Config**: `services/starknet.config.ts` — network config, contract address, asset mapping

### 3. Backend Starknet Integration (`backend/src/services/`)

- **`starknet.config.ts`** — RPC URL, contract address, operator credentials
- **`starknet.service.ts`** — On-chain operations (record match, settle, read state)
- **Graceful fallback** — If Starknet env vars are not set, system runs in simulated mode

## Quick Start

### Prerequisites

- Node.js 18+, pnpm
- Docker (for PostgreSQL)
- A Starknet wallet browser extension (ArgentX or Braavos)

### 1. Start Infrastructure
```bash
docker compose up -d        # Start PostgreSQL
cd backend && pnpm dev      # Start backend (port 3001)
cd frontend && pnpm dev     # Start frontend (port 5173)
```

### 2. Deploy Contract (Optional — for on-chain mode)

**Option A: Local Devnet**
```bash
# Install Starknet tools (requires WSL on Windows)
curl --proto '=https' --tlsv1.2 -sSf https://sh.starkup.sh | sh

# Start devnet
starknet-devnet --seed=0

# Deploy
cd contracts
bash deploy.sh devnet
```

**Option B: Starknet Sepolia Testnet**
```bash
# Create and fund a Sepolia account
sncast account create --network=sepolia --name=sepolia
# Fund at https://starknet-faucet.vercel.app/

sncast account deploy --network=sepolia --name=sepolia

# Deploy
cd contracts
export STARKNET_OPERATOR_ADDRESS="0x<your-address>"
export STARKNET_OPERATOR_PRIVATE_KEY="0x<your-key>"
bash deploy.sh sepolia
```

### 3. Configure Environment

After deployment, update `backend/.env`:
```env
STARKNET_CONTRACT_ADDRESS="0x<deployed-address>"
STARKNET_OPERATOR_ADDRESS="0x<your-address>"
STARKNET_OPERATOR_PRIVATE_KEY="0x<your-key>"
```

And optionally `frontend/.env`:
```env
VITE_DARKPOOL_CONTRACT_ADDRESS="0x<deployed-address>"
```

## Starknet Flow

```
User (ArgentX)                Backend (Operator)           Starknet
     │                              │                         │
     │ 1. submit_commitment() ─────────────────────────────▶ │ On-chain
     │    (signed by user wallet)   │                         │
     │                              │                         │
     │ 2. POST /orders/create ─────▶│                         │
     │    (order details, off-chain)│                         │
     │                              │                         │
     │                              │ 3. runMatcher()         │
     │                              │    (FIFO matching)      │
     │                              │                         │
     │                              │ 4. record_match() ────▶ │ On-chain
     │                              │    (operator tx)        │
     │                              │                         │
     │                              │ 5. Proof generation     │
     │                              │    (ZK-STARK)           │
     │                              │                         │
     │                              │ 6. settle_match() ────▶ │ On-chain
     │                              │    (operator tx)        │
     │                              │                         │
     │ ◀── WebSocket: settled ──────│                         │
     │                              │                         │
```

## API Endpoints

### Starknet Status
```
GET /api/starknet/status
```
Returns network info, contract deployment status, on-chain stats.

## Key Files

| File | Purpose |
|------|---------|
| `contracts/src/lib.cairo` | Cairo smart contract |
| `contracts/abi/onyx_darkpool.json` | Contract ABI |
| `contracts/deploy.sh` | Deployment script |
| `frontend/src/app/hooks/useWallet.tsx` | Starknet wallet context |
| `frontend/src/app/services/starknet.config.ts` | Network/contract config |
| `frontend/src/app/services/starknet.service.ts` | Frontend chain interaction |
| `backend/src/services/starknet.config.ts` | Backend config |
| `backend/src/services/starknet.service.ts` | Backend chain interaction |
| `backend/src/routes/starknet.routes.ts` | API routes |
| `backend/src/services/matcher.service.ts` | Matcher + settlement pipeline |
