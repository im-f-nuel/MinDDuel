# Deployment Guide

This guide walks through the complete deployment pipeline — from a clean repository checkout to a fully running system on Solana devnet with Railway (backend) and Vercel (frontend).

---

## Prerequisites

| Tool | Required Version | Install |
|---|---|---|
| Node.js | 20.x | https://nodejs.org |
| Rust | stable (1.75+) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | 1.18+ | https://docs.solana.com/cli/install-solana-cli-tools |
| Anchor CLI | 0.30.x | `cargo install --git https://github.com/coral-xyz/anchor avm --locked` |
| Railway CLI | latest | `npm install -g @railway/cli` |
| Vercel CLI | latest | `npm install -g vercel` |

**Verify your setup:**

```bash
solana --version    # solana-cli 1.18.x
anchor --version    # anchor-cli 0.30.x
node --version      # v20.x.x
```

---

## Step 1 — Clone and Install

```bash
git clone https://github.com/<your-org>/mind-duel.git
cd mind-duel
npm install
```

---

## Step 2 — Configure Solana CLI for Devnet

```bash
solana config set --url devnet
solana-keygen new --outfile ~/.config/solana/id.json   # skip if you already have a keypair
solana airdrop 2                                         # fund the deployer wallet
solana balance                                           # confirm balance
```

---

## Step 3 — Build the Anchor Program

```bash
anchor build
```

This compiles the Rust program and generates:

- `target/deploy/mind_duel.so` — deployable BPF binary
- `target/idl/mind_duel.json` — ABI used by frontend and tests
- `target/types/mind_duel.ts` — TypeScript type definitions

**Optional — lint the contract before deploying:**

```bash
cargo clippy --manifest-path programs/mind-duel/Cargo.toml
```

---

## Step 4 — Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

After a successful deploy, the output will print the Program ID. It should match `8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN` if you are using the project's keypair at `target/deploy/mind_duel-keypair.json`.

**Upload the IDL** so the Anchor client can auto-resolve types:

```bash
anchor idl init \
  --filepath target/idl/mind_duel.json \
  8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN \
  --provider.cluster devnet
```

**Verify the deployment:**

```bash
solana program show 8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN --url devnet
```

---

## Step 5 — Set Up Mock USDC Mint

The backend includes a setup script to create the mock USDC SPL token on devnet:

```bash
cd backend
npm install
npm run setup:usdc
```

Note the mint public key printed to the console — you will need it for both backend and frontend environment variables.

---

## Step 6 — Generate Deployment Keypairs

Create the backend keypairs used for sponsored transactions and badge minting. Keep these files out of version control.

```bash
mkdir -p backend/.keys
solana-keygen new --outfile backend/.keys/sponsor.json --no-bip39-passphrase
solana-keygen new --outfile backend/.keys/badge-minter.json --no-bip39-passphrase

# Fund the sponsor wallet — it pays transaction fees on behalf of users
solana transfer \
  $(solana-keygen pubkey backend/.keys/sponsor.json) \
  0.5 \
  --url devnet \
  --allow-unfunded-recipient

# Confirm balance
solana balance $(solana-keygen pubkey backend/.keys/sponsor.json) --url devnet
```

---

## Step 7 — Configure the Backend

Create `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@host.neon.tech/mindduel?sslmode=require

# Server
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,https://mindduel.app

# Solana
RPC_URL=https://api.devnet.solana.com
MOCK_USDC_MINT=<mint pubkey from Step 5>

# Keypairs (use Railway secret files in production)
SPONSOR_KEYPAIR_PATH=.keys/sponsor.json
BADGE_MINTER_KEYPAIR_PATH=.keys/badge-minter.json

# Optional: allow Vercel preview deployments to call the API
ALLOW_VERCEL_PREVIEW=1
```

**Test locally:**

```bash
cd backend
npm run dev
curl http://localhost:3001/health
```

---

## Step 8 — Configure the Frontend

Create `frontend/.env.local`:

```env
# Solana
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN

# Backend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

# Mock USDC
NEXT_PUBLIC_MOCK_USDC_MINT=<mint pubkey from Step 5>
```

**Test locally:**

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

---

## Step 9 — Deploy Backend to Railway

### 9a. Initialize the Railway project

```bash
railway login
cd backend
railway init
# Follow the prompts to create a new project
```

### 9b. Set environment variables

In Railway → Variables → Raw Editor, paste:

```
DATABASE_URL=postgresql://...
PORT=3001
ALLOWED_ORIGINS=https://mindduel.app
RPC_URL=https://api.devnet.solana.com
MOCK_USDC_MINT=<mint pubkey>
ALLOW_VERCEL_PREVIEW=1
```

### 9c. Add secret keypair files

In Railway → Settings → Secret Files, add:

| Mount path | Content |
|---|---|
| `.keys/sponsor.json` | Contents of `backend/.keys/sponsor.json` |
| `.keys/badge-minter.json` | Contents of `backend/.keys/badge-minter.json` |

Then add to Railway Variables:

```
SPONSOR_KEYPAIR_PATH=.keys/sponsor.json
BADGE_MINTER_KEYPAIR_PATH=.keys/badge-minter.json
```

### 9d. Deploy

```bash
railway up
```

Note the deployed service URL (e.g., `https://mind-duel-backend.railway.app`).

---

## Step 10 — Set Up Neon PostgreSQL

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string and set it as `DATABASE_URL` in Railway.
3. Run schema migrations:

```bash
cd backend
npm run db:migrate
```

---

## Step 11 — Deploy Frontend to Vercel

### 11a. Link the project

```bash
cd frontend
vercel link
```

### 11b. Set environment variables

In Vercel → Settings → Environment Variables:

| Variable | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_RPC_ENDPOINT` | `https://api.devnet.solana.com` | All |
| `NEXT_PUBLIC_PROGRAM_ID` | `8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN` | All |
| `NEXT_PUBLIC_MOCK_USDC_MINT` | `<mint pubkey>` | All |
| `NEXT_PUBLIC_API_URL` | `https://mind-duel-backend.railway.app` | Production |
| `NEXT_PUBLIC_BACKEND_URL` | `https://mind-duel-backend.railway.app` | Production |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Development |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3001` | Development |

### 11c. Deploy

```bash
vercel --prod
```

Or connect the GitHub repository to Vercel for automatic deployments on every push.

---

## Environment Variable Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `PORT` | No | HTTP port (default: `3001`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `RPC_URL` | No | Solana RPC endpoint (default: public devnet) |
| `MOCK_USDC_MINT` | Yes | SPL mint address for mock USDC |
| `SPONSOR_KEYPAIR_PATH` | No | Path to sponsor keypair JSON file |
| `SPONSOR_KEYPAIR` | No | Sponsor keypair as JSON string (alternative to path) |
| `BADGE_MINTER_KEYPAIR_PATH` | No | Path to badge minter keypair JSON file |
| `ALLOW_VERCEL_PREVIEW` | No | Set to `1` to allow `*.vercel.app` CORS origins |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_RPC_ENDPOINT` | Yes | Solana RPC URL |
| `NEXT_PUBLIC_PROGRAM_ID` | Yes | Deployed Anchor program ID |
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL for trivia and match calls |
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Backend base URL for `anchor-client.ts` |
| `NEXT_PUBLIC_MOCK_USDC_MINT` | Yes (for USDC) | Mock USDC SPL mint public key |

---

## Post-Deploy Checklist

### Smart Contract

- [ ] `solana program show <PROGRAM_ID> --url devnet` confirms deployment
- [ ] `anchor idl fetch <PROGRAM_ID> --url devnet` returns the full IDL
- [ ] `anchor test` passes all test cases locally

### Backend

- [ ] `GET /health` returns `{ "status": "ok" }` from the Railway URL
- [ ] `GET /api/trivia/question` returns a question
- [ ] `GET /api/trivia/stats` returns non-zero counts
- [ ] `GET /api/leaderboard` returns a valid response (empty is acceptable)
- [ ] `GET /api/sponsor/pubkey` returns a non-null public key
- [ ] Sponsor wallet balance: `solana balance <sponsor_pubkey> --url devnet`

### Frontend

- [ ] Homepage loads at the production URL
- [ ] Wallet connect works (Phantom / Backpack on devnet)
- [ ] No console errors on initial page load
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] Lobby loads and displays all game modes
- [ ] Match creation returns a valid join code

### End-to-End Flow

- [ ] Create a match from wallet A
- [ ] Join the match from wallet B
- [ ] Both wallets stake SOL successfully
- [ ] Player A selects a cell and submits `commitAnswer` — tx confirms on devnet
- [ ] Player A submits `revealAnswer` — board updates with the placed mark
- [ ] Turn passes to Player B; Player B completes a turn
- [ ] Game plays to completion (win or draw)
- [ ] `settleGame` confirms on-chain; winner receives funds
- [ ] Match appears in `/api/leaderboard` after `POST /api/match/finish`

---

## Upgrading the Program

To redeploy with the same Program ID (upgrade authority must be the original deployer keypair):

```bash
anchor build
anchor upgrade target/deploy/mind_duel.so \
  --program-id 8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN \
  --provider.cluster devnet

anchor idl upgrade \
  --filepath target/idl/mind_duel.json \
  8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN \
  --provider.cluster devnet
```

### Backend upgrade (Railway)

```bash
cd backend && railway up
```

Railway performs zero-downtime rolling deploys automatically.

### Frontend upgrade (Vercel)

```bash
cd frontend && vercel --prod
```

Or push to the connected GitHub branch.

---

## Troubleshooting

**`anchor build` fails with BPF toolchain error**

```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
# Then retry anchor build
```

**`anchor deploy` fails — insufficient SOL**

```bash
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet   # run twice — devnet cap is 2 SOL per request
```

**Frontend shows "Program not found" error**

Verify that `NEXT_PUBLIC_PROGRAM_ID` matches the deployed program ID exactly and that the IDL was uploaded with `anchor idl init`.

**Backend warns "DATABASE_URL not set"**

The server starts but match and leaderboard routes will fail. Add `DATABASE_URL` to Railway Variables and redeploy.

**Transactions fail with "Blockhash not found"**

Devnet can lag under load. Increase the confirmation timeout or switch to a paid RPC endpoint (Alchemy, QuickNode).

**Sponsor sign fails with "Origin not allowed by CORS"**

Add the frontend URL to `ALLOWED_ORIGINS` in Railway Variables. For Vercel preview deployments, set `ALLOW_VERCEL_PREVIEW=1`.
