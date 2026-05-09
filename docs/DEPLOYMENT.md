# MindDuel — Deployment Guide

This guide covers the full deployment pipeline from a clean checkout to a running production system on Solana devnet with Railway (backend) and Vercel (frontend).

---

## Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 20.x | https://nodejs.org |
| Rust | stable (1.75+) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | 1.18+ | https://docs.solana.com/cli/install-solana-cli-tools |
| Anchor CLI | 0.30.x | `cargo install --git https://github.com/coral-xyz/anchor avm --locked` then `avm install 0.30.0 && avm use 0.30.0` |
| Railway CLI | latest | `npm install -g @railway/cli` |
| Vercel CLI | latest | `npm install -g vercel` |

**Verify installation:**
```bash
solana --version          # solana-cli 1.18.x
anchor --version          # anchor-cli 0.30.x
node --version            # v20.x.x
```

---

## Step 1: Clone and Install

```bash
git clone https://github.com/<your-org>/mind-duel.git
cd mind-duel
npm install
```

---

## Step 2: Configure Solana CLI for Devnet

```bash
solana config set --url devnet
solana-keygen new --outfile ~/.config/solana/id.json   # skip if you already have a keypair
solana airdrop 2                                         # fund deployer wallet
solana balance                                           # confirm balance
```

---

## Step 3: Build the Anchor Program

```bash
anchor build
```

This compiles the Rust program and generates:
- `target/deploy/mind_duel.so` — deployable BPF binary
- `target/idl/mind_duel.json` — ABI for frontend/tests
- `target/types/mind_duel.ts` — TypeScript types (if `idl` generation enabled)

**Check for errors:**
```bash
cargo clippy --manifest-path programs/mind-duel/Cargo.toml
```

---

## Step 4: Deploy the Program to Devnet

```bash
anchor deploy --provider.cluster devnet
```

After successful deployment, note the **Program ID** printed in the output. It should match `8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN` if you are using the project keypair at `target/deploy/mind_duel-keypair.json`.

**Upload the IDL** (required for Anchor client auto-resolution):
```bash
anchor idl init \
  --filepath target/idl/mind_duel.json \
  8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN \
  --provider.cluster devnet
```

To update an existing IDL after a program upgrade:
```bash
anchor idl upgrade \
  --filepath target/idl/mind_duel.json \
  8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN \
  --provider.cluster devnet
```

**Verify deployment:**
```bash
solana program show 8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN --url devnet
```

---

## Step 5: Set Up Mock USDC Mint (Devnet)

The backend includes a setup script to create a mock USDC SPL token:

```bash
cd backend
npm install
npm run setup:usdc
```

Note the mint pubkey printed. You will need it for both backend and frontend env vars.

---

## Step 6: Generate Deployment Keypairs

Create the backend keypairs for sponsored transactions and badge minting. Keep these files out of version control.

```bash
mkdir -p backend/.keys
solana-keygen new --outfile backend/.keys/sponsor.json --no-bip39-passphrase
solana-keygen new --outfile backend/.keys/badge-minter.json --no-bip39-passphrase

# Fund the sponsor wallet (it pays tx fees for users)
solana transfer $(solana-keygen pubkey backend/.keys/sponsor.json) 0.5 --url devnet --allow-unfunded-recipient

# Verify
solana balance $(solana-keygen pubkey backend/.keys/sponsor.json) --url devnet
```

---

## Step 7: Configure Backend Environment

Create `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@host.neon.tech/mindduel?sslmode=require

# Server
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,https://mindduel.app

# Solana
RPC_URL=https://api.devnet.solana.com
MOCK_USDC_MINT=<mint pubkey from setup:usdc>

# Keypairs (local dev — use Railway secret files in prod)
SPONSOR_KEYPAIR_PATH=.keys/sponsor.json
BADGE_MINTER_KEYPAIR_PATH=.keys/badge-minter.json

# Optional: allow Vercel preview deployments to access the API
ALLOW_VERCEL_PREVIEW=1
```

**Test backend locally:**
```bash
cd backend
npm run dev
curl http://localhost:3001/health
```

---

## Step 8: Configure Frontend Environment

Create `frontend/.env.local`:

```env
# Solana
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN

# Backend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

# Mock USDC
NEXT_PUBLIC_MOCK_USDC_MINT=<mint pubkey from setup:usdc>
```

**Test frontend locally:**
```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

---

## Step 9: Deploy Backend to Railway

### 9a. Create a Railway project

```bash
railway login
cd backend
railway init
# Follow prompts to create a new project
```

### 9b. Set environment variables in Railway

Go to your Railway project → Variables → Raw Editor and paste:

```
DATABASE_URL=postgresql://...
PORT=3001
ALLOWED_ORIGINS=https://mindduel.app
RPC_URL=https://api.devnet.solana.com
MOCK_USDC_MINT=<mint pubkey>
ALLOW_VERCEL_PREVIEW=1
```

### 9c. Add secret files for keypairs

In Railway → Settings → Secret Files, add:

| Path | Content |
|---|---|
| `.keys/sponsor.json` | Contents of `backend/.keys/sponsor.json` |
| `.keys/badge-minter.json` | Contents of `backend/.keys/badge-minter.json` |

Then set in Railway Variables:
```
SPONSOR_KEYPAIR_PATH=.keys/sponsor.json
BADGE_MINTER_KEYPAIR_PATH=.keys/badge-minter.json
```

### 9d. Deploy

```bash
railway up
```

Note the deployed URL (e.g., `https://mind-duel-backend.railway.app`).

---

## Step 10: Set Up Neon PostgreSQL Database

1. Create a Neon project at https://neon.tech.
2. Copy the connection string and add it to `DATABASE_URL`.
3. Run schema migrations:
```bash
cd backend
npm run db:migrate    # applies Drizzle schema to Neon
```

---

## Step 11: Deploy Frontend to Vercel

### 11a. Configure Vercel project

```bash
cd frontend
vercel link   # link to your Vercel project
```

### 11b. Set Vercel environment variables

In Vercel project → Settings → Environment Variables, add:

| Variable | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_RPC_ENDPOINT` | `https://api.devnet.solana.com` | All |
| `NEXT_PUBLIC_PROGRAM_ID` | `8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN` | All |
| `NEXT_PUBLIC_API_URL` | `https://mind-duel-backend.railway.app` | Production |
| `NEXT_PUBLIC_BACKEND_URL` | `https://mind-duel-backend.railway.app` | Production |
| `NEXT_PUBLIC_MOCK_USDC_MINT` | `<mint pubkey>` | All |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Development |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3001` | Development |

### 11c. Deploy

```bash
vercel --prod
```

Or connect your GitHub repository to Vercel for automatic deployments on push.

---

## Environment Variables — Full Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `PORT` | No | HTTP port (default: 3001) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `RPC_URL` | No | Solana RPC endpoint (default: public devnet) |
| `SOLANA_RPC_URL` | No | Alias for `RPC_URL` |
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
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL (for trivia/match calls) |
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Backend base URL (for anchor-client.ts) |
| `NEXT_PUBLIC_MOCK_USDC_MINT` | Yes (for USDC) | Mock USDC SPL mint pubkey |

---

## Post-Deploy Checklist

### Smart Contract
- [ ] `solana program show <PROGRAM_ID> --url devnet` confirms deployment
- [ ] IDL uploaded: `anchor idl fetch <PROGRAM_ID> --url devnet` returns the IDL
- [ ] `anchor test` passes all test cases locally

### Backend
- [ ] `GET /health` returns `{ "status": "ok" }` from the Railway URL
- [ ] `GET /api/trivia/question` returns a question
- [ ] `GET /api/trivia/stats` returns non-zero counts
- [ ] Database connected: `GET /api/leaderboard` returns (empty is OK)
- [ ] `GET /api/sponsor/pubkey` returns a non-null pubkey
- [ ] Sponsor wallet has SOL: `solana balance <sponsor_pubkey> --url devnet`

### Frontend
- [ ] Homepage loads at the production URL
- [ ] Wallet connect works (Phantom / Backpack)
- [ ] No console errors on page load
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Game lobby loads and shows available modes
- [ ] Match creation shows a join code

### End-to-End Flow
- [ ] Create a match from one wallet
- [ ] Join the match from a second wallet
- [ ] Both wallets stake SOL
- [ ] First player selects a cell and answers a question
- [ ] `commitAnswer` transaction confirmed on devnet
- [ ] `revealAnswer` transaction confirmed; board updates
- [ ] Game plays to completion
- [ ] `settleGame` confirms; winner receives funds
- [ ] Match appears in `/api/leaderboard` after `POST /api/match/finish`

---

## Upgrade Procedure

### Program Upgrade (keep same Program ID)

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

Note: Program upgrades on Solana are only possible if the program account was originally deployed with an upgrade authority. The upgrade authority is the deployer's keypair.

### Backend Upgrade (Railway)

```bash
cd backend
railway up
```

Railway performs zero-downtime rolling deploys.

### Frontend Upgrade (Vercel)

```bash
cd frontend
vercel --prod
```

Or push to the connected GitHub branch for automatic deployment.

---

## Troubleshooting

### `anchor build` fails with BPF toolchain error
```bash
solana-install update
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
# Then retry anchor build
```

### `anchor deploy` fails — insufficient SOL
```bash
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet   # run twice — devnet limit is 2 SOL per request
```

### Frontend shows "Program not found" error
Ensure `NEXT_PUBLIC_PROGRAM_ID` matches the deployed program ID exactly. Also confirm the IDL was uploaded to devnet.

### Backend `DATABASE_URL not set` warning
The server starts but match/leaderboard routes will fail. Set `DATABASE_URL` in Railway Variables and redeploy.

### Transactions fail with "Blockhash not found"
Devnet can be slow. Increase the confirmation timeout or switch to a paid RPC endpoint (Alchemy, QuickNode).

### Sponsor sign fails — "Origin not allowed by CORS"
Add the frontend URL to `ALLOWED_ORIGINS` in the Railway environment variables. If using Vercel preview deployments, set `ALLOW_VERCEL_PREVIEW=1`.
