# 🔮 Onyx Protocol

**Privacy-preserving dark pool exchange on Starknet** — trade any ERC-20 pair with encrypted orders, ZK-STARK proofs, and on-chain settlement.

![Starknet](https://img.shields.io/badge/Starknet-Sepolia-blueviolet)
![Cairo](https://img.shields.io/badge/Cairo-2.11+-orange)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Overview

Onyx Protocol is a fully-featured dark pool DEX where order details (amount, price, direction) are hidden inside Pedersen commitment hashes. A backend matching engine pairs compatible orders, generates ZK-STARK validity proofs, and settles trades on-chain — all without revealing sensitive trade information to other participants.

### Key Features

- **Encrypted Orders** — Pedersen commitments hide order parameters on-chain
- **ZK-STARK Proofs** — Every match is cryptographically verified before settlement
- **ERC-20 Vault Custody** — Real token deposits, withdrawals, and shielded balances
- **Partial Fills** — Orders can be partially filled with remainder tracking
- **Multi-Pair Trading** — STRK/oETH, STRK/oSEP, oETH/oSEP
- **Live Oracle Prices** — CoinGecko-powered real-time exchange rates
- **Compliance Layer** — Time-limited viewing keys for auditors
- **Starknet Wallet Support** — Argent X and Braavos

---

## Architecture

```
┌──────────────────┐      ┌──────────────────────┐      ┌────────────────────┐
│   Frontend       │      │   Backend            │      │   Starknet         │
│   (React + Vite) │◄────►│   (Express + Prisma) │◄────►│   (Cairo Contract) │
│                  │  API │                      │  RPC │                    │
│  • Trade UI      │  +   │  • Order matching    │      │  • Commitments     │
│  • Vault mgmt    │  WS  │  • Proof generation  │      │  • Match recording │
│  • Analytics     │      │  • Price oracle      │      │  • Settlement      │
│  • Wallet connect│      │  • WebSocket events  │      │  • ERC-20 vault    │
└──────────────────┘      └──────────┬───────────┘      └────────────────────┘
                                     │
                               ┌─────┴─────┐
                               │ PostgreSQL │
                               └───────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contract** | Cairo 2.11+, Scarb, Starknet Foundry |
| **Backend** | Node.js, Express 5, Prisma ORM, starknet.js |
| **Frontend** | React 18, Vite, TailwindCSS 4, Recharts, Radix UI |
| **Database** | PostgreSQL 16 |
| **Blockchain** | Starknet Sepolia Testnet |
| **Wallets** | Argent X, Braavos |

---

## Project Structure

```
├── contracts/           # Cairo smart contracts
│   ├── src/
│   │   ├── lib.cairo          # OnyxDarkPool contract (commitments, matching, settlement, vault)
│   │   └── mock_erc20.cairo   # Mock ERC-20 for testing
│   ├── abi/                   # Compiled ABIs
│   └── Scarb.toml
│
├── backend/             # Express API server
│   ├── src/
│   │   ├── server.ts          # Entry point, middleware, routes
│   │   ├── services/          # Business logic (matcher, price, starknet, vault, etc.)
│   │   ├── routes/            # REST endpoints
│   │   ├── websocket/         # Real-time event broadcasting
│   │   └── utils/             # Helpers, validation
│   └── prisma/
│       └── schema.prisma      # Database schema
│
├── frontend/            # React SPA
│   └── src/app/
│       ├── pages/             # Trade, Vault, Analytics, History, Compliance, etc.
│       ├── services/          # API client, Starknet config, wallet integration
│       ├── hooks/             # useWallet, useWebSocket, useApi
│       └── components/        # Shared UI components
│
└── docker-compose.yml   # PostgreSQL for local development
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** (recommended) or npm
- **Docker** (for PostgreSQL)
- **Scarb** (for Cairo contracts, optional)

### 1. Clone & Install

```bash
git clone https://github.com/Shubhojit-17/OnyxProtocol.git
cd OnyxProtocol

# Backend
cd backend && pnpm install

# Frontend
cd ../frontend && pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL on port **5434** with user `onyx`, password `onyx`, database `onyx_protocol`.

### 3. Configure Environment

Create `backend/.env`:

```env
DATABASE_URL="postgresql://onyx:onyx@localhost:5434/onyx_protocol?schema=public"
PORT=3001
CORS_ORIGIN="http://localhost:5173"
NODE_ENV="development"

# Starknet (optional — system works in simulated mode without these)
STARKNET_RPC_URL="https://api.cartridge.gg/x/starknet/sepolia"
STARKNET_CONTRACT_ADDRESS="<your-contract-address>"
STARKNET_OPERATOR_PRIVATE_KEY="<your-operator-private-key>"
STARKNET_OPERATOR_ADDRESS="<your-operator-address>"
STARKNET_EXPLORER_URL="https://sepolia.voyager.online"

# Token Addresses (Starknet Sepolia)
STRK_TOKEN_ADDRESS="0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
ETH_TOKEN_ADDRESS="0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
oETH_TOKEN_ADDRESS="<your-oETH-token-address>"
oSEP_TOKEN_ADDRESS="<your-oSEP-token-address>"
```

### 4. Set Up Database

```bash
cd backend
pnpm db:push     # Push schema to database
pnpm db:seed     # Seed initial data
```

### 5. Run Development Servers

```bash
# Terminal 1 — Backend
cd backend && pnpm dev

# Terminal 2 — Frontend
cd frontend && pnpm dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001/api
- **WebSocket:** ws://localhost:3001/ws
- **Health Check:** http://localhost:3001/api/health

---

## Smart Contract

The **OnyxDarkPool** Cairo contract handles all on-chain operations:

| Function | Description |
|----------|-------------|
| `submit_commitment()` | Store a Pedersen commitment hash for a new order |
| `record_match()` | Record a match between buy/sell commitments (operator only) |
| `settle_match()` | Finalize after ZK-STARK proof verification (operator only) |
| `vault_deposit()` | Deposit ERC-20 tokens into the contract vault |
| `vault_withdraw()` | Withdraw tokens from the vault |
| `add_supported_token()` | Whitelist an ERC-20 token (operator only) |

### Build & Deploy

```bash
cd contracts
scarb build                    # Compile to Sierra + CASM
bash deploy_full.sh            # Deploy to Starknet Sepolia
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Server health + WS client count |
| `POST` | `/api/users/connect` | Connect wallet |
| `GET` | `/api/dashboard/overview` | Dashboard stats |
| `GET` | `/api/dashboard/price-history` | 24h price chart data per pair |
| `POST` | `/api/vault/deposit` | Deposit to vault |
| `POST` | `/api/vault/shield` | Shield balance (public → private) |
| `POST` | `/api/orders/create` | Create encrypted order |
| `GET` | `/api/orders/list` | List user's orders |
| `GET` | `/api/darkpool/stats` | Pool statistics + exchange rates |
| `GET` | `/api/analytics/*` | Volume, anonymity set, proof velocity |
| `GET` | `/api/history/trades` | User trade history |
| `POST` | `/api/compliance/generate-viewing-key` | Generate auditor viewing key |
| `GET` | `/api/starknet/status` | On-chain integration status |

---

## Trading Flow

```
1. User connects Starknet wallet (Argent X / Braavos)
2. Deposits tokens into the Onyx vault
3. Shields balance for privacy
4. Creates an encrypted order (commitment hash submitted on-chain)
5. Backend matcher pairs compatible buy/sell orders (every 10s)
6. ZK-STARK proof is generated for the matched trade
7. Settlement transaction is submitted on-chain
8. Tokens are transferred, balances updated
9. Real-time WebSocket notification sent to both parties
```

---

## Deployment

### Backend → Railway

The project includes `railway.json` and `backend/nixpacks.toml` for monorepo deployment.

1. Create a new project on [Railway](https://railway.app) from the GitHub repo
2. Add a **PostgreSQL** plugin
3. Set environment variables (see table below)
4. Railway auto-deploys on push

### Frontend → Vercel

1. Import the repo on [Vercel](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Framework: **Vite**
4. Set environment variables (see table below)

### Railway Environment Variables (Backend)

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Auto-set by Railway Postgres plugin |
| `CORS_ORIGIN` | `https://your-app.vercel.app` |
| `NODE_ENV` | `production` |
| `STARKNET_RPC_URL` | `https://api.cartridge.gg/x/starknet/sepolia` |
| `STARKNET_CONTRACT_ADDRESS` | Your deployed contract address |
| `STARKNET_OPERATOR_PRIVATE_KEY` | Operator account private key |
| `STARKNET_OPERATOR_ADDRESS` | Operator account address |
| `STARKNET_EXPLORER_URL` | `https://sepolia.voyager.online` |
| `STRK_TOKEN_ADDRESS` | STRK token contract address |
| `ETH_TOKEN_ADDRESS` | ETH token contract address |
| `oETH_TOKEN_ADDRESS` | oETH token contract address |
| `oSEP_TOKEN_ADDRESS` | oSEP token contract address |

> **Note:** Do not set `PORT` — Railway assigns it automatically.

### Vercel Environment Variables (Frontend)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-backend.up.railway.app/api` |
| `VITE_WS_URL` | `wss://your-backend.up.railway.app/ws` |
| `VITE_DARKPOOL_CONTRACT_ADDRESS` | Your deployed contract address (optional) |

---

## Database Schema

| Model | Purpose |
|-------|---------|
| **User** | Wallet addresses, faucet status |
| **UserSettings** | Theme, privacy, notification preferences |
| **VaultBalance** | Per-user per-asset public/shielded/locked balances |
| **OrderCommitment** | Encrypted orders with on-chain commitment hashes |
| **Match** | Paired buy/sell orders with proof status |
| **Proof** | ZK-STARK proof records and verification times |
| **SettlementTx** | On-chain settlement transaction records |
| **ComplianceViewingKey** | Time-limited auditor access keys |
| **ActivityEvent** | System event log |
| **AnalyticsSnapshot** | Periodic protocol metrics |

---

## Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Protocol overview, TVL, volume, recent activity |
| **Trade** | Create private orders with real-time price charts |
| **Dark Pool** | Pool depth, hidden order count, anonymity metrics |
| **Execution** | Match timeline, proof generation progress |
| **Vault** | Deposit, withdraw, shield/unshield balances, faucet |
| **Analytics** | Volume trends, proof velocity, liquidity growth |
| **History** | Personal trade history with CSV export |
| **Compliance** | Generate/revoke viewing keys for auditors |
| **Settings** | Theme, notifications, gas preferences |

---

## License

MIT
