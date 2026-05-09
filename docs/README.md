# MindDuel

> **Trivia-Gated PvP Tic Tac Toe — Trustlessly on Solana**

MindDuel is a fully on-chain competitive game built for the **Colosseum Frontier 2026 Hackathon** (100xDevs Track). Two players lock real SOL or USDC into a trustless escrow, then race to claim board cells by answering trivia questions correctly. Every stake, every move, and every settlement is enforced by an Anchor smart contract — no operator can touch the funds.

---

## Quick Links

| Resource | Link |
|---|---|
| Live Demo | [mindduel.app](https://mindduel.app) |
| Solana Explorer | [Program on Devnet](https://explorer.solana.com/address/8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN?cluster=devnet) |
| Demo Video (90s pitch) | *(added before submission)* |
| Demo Video (technical walkthrough) | *(added before submission)* |

---

## Program ID

```
8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN
```

Network: **Solana Devnet**
Framework: **Anchor 0.30**

Treasury (hardcoded compile-time constant — cannot be redirected):

```
CPoofbZho4bJmSAyVJxfeMK9CoZpXpDYftctghwUJX86
```

---

## What is MindDuel?

MindDuel puts knowledge at the center of competitive gaming. Before a player can place a piece on the board, they must answer a trivia question correctly. Wrong answer? The turn passes. The player who combines board strategy with broader knowledge wins — and wins real money.

### Core Differentiators

**Trivia gates every move.** You cannot place a piece by luck or brute force. Knowledge and board strategy combine to determine the winner.

**Commit-reveal anti-cheat.** Players commit `SHA-256(answer_index || nonce)` on-chain before revealing. There is no trusted oracle — the contract verifies the hash directly. Neither the platform nor the opponent can see your answer before you reveal it.

**Three distinct game modes.** Classic 3×3, Shifting Board (the entire board rotates every 3 rounds using slot entropy), and Scale Up (board grows 3×3 → 4×4 → 5×5 as correct answers accumulate).

**Dual-currency escrow.** Native SOL and mock USDC (SPL) are both supported, each with dedicated Anchor instruction variants.

**On-chain hint economy.** Players pay micro-fees (0.001–0.005 SOL) for in-game assistance. 20% of each hint fee boosts the winner's pot; 80% goes to the platform treasury — all enforced on-chain, not by a server.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Anchor 0.30 (Rust), Solana Devnet |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Wallet | `@solana/wallet-adapter` (Phantom / Backpack) |
| SPL Tokens | `@solana/spl-token` — mock USDC ATA flows |
| Animations | Framer Motion |
| Real-time | WebSocket via Fastify `@fastify/websocket` |
| Backend | Fastify + Zod, Node.js 20 |
| Database | Neon (PostgreSQL) via Drizzle ORM |
| Hosting (Frontend) | Vercel |
| Hosting (Backend) | Railway |
| Trivia | Curated question bank — 6 categories, 3 difficulty tiers |

---

## Repository Structure

```
mind-duel/
├── Anchor.toml                   # Anchor workspace config
├── Cargo.toml                    # Rust workspace root
├── package.json                  # npm workspaces root
│
├── programs/mind-duel/src/       # Anchor smart contract
│   ├── lib.rs                    # Entry point, instruction dispatch
│   ├── constants.rs              # Fees, timeouts, PDA seeds, treasury pubkey
│   ├── errors.rs                 # MindDuelError enum (15 variants)
│   ├── state/                    # game.rs, hint_ledger.rs
│   └── instructions/             # One file per instruction (14 total)
│
├── frontend/                     # Next.js 14 application
│   └── src/
│       ├── app/                  # Pages: /, /lobby, /game/[matchId], /result, ...
│       ├── components/           # game/, ui/, wallet/, layout/
│       ├── hooks/                # useGameState, useTriviaSession, useHint, ...
│       └── lib/                  # anchor-client.ts, trivia.ts, constants.ts
│
├── backend/                      # Fastify API server (port 3001)
│   └── src/
│       ├── routes/               # trivia, match, stats, ws, tournament, faucet, sponsor
│       ├── lib/                  # db, commit-reveal, badges, tournament-store
│       └── data/                 # questions.ts — curated question bank
│
└── docs/                         # This documentation suite
```

---

## Getting Started

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Node.js | 20.x |
| Rust | stable (1.75+) |
| Solana CLI | 1.18+ |
| Anchor CLI | 0.30.x |

### 1. Clone and install

```bash
git clone https://github.com/<your-org>/mind-duel.git
cd mind-duel
npm install
```

### 2. Build and deploy the Anchor program

```bash
anchor build
anchor deploy --provider.cluster devnet
anchor idl init \
  --filepath target/idl/mind_duel.json \
  8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN \
  --provider.cluster devnet
```

### 3. Configure environment variables

**Frontend** — create `frontend/.env.local`:

```env
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_MOCK_USDC_MINT=<mint pubkey from backend setup>
```

**Backend** — create `backend/.env`:

```env
DATABASE_URL=postgresql://...
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000
RPC_URL=https://api.devnet.solana.com
MOCK_USDC_MINT=<mint pubkey>
SPONSOR_KEYPAIR_PATH=.keys/sponsor.json
BADGE_MINTER_KEYPAIR_PATH=.keys/badge-minter.json
```

### 4. Start the services

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
# Open http://localhost:3000
```

---

## Running Tests

```bash
# Full Anchor test suite
anchor test

# Isolate a specific test case
anchor test -- --grep "settle game"

# Frontend static checks
cd frontend && npm run lint && npm run typecheck
```

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](./ARCHITECTURE.md) | System design, data flow, component structure |
| [Game Mechanics](./GAME_MECHANICS.md) | Game modes, commit-reveal scheme, hint economy |
| [Smart Contract](./SMART_CONTRACT.md) | All 14 instructions, account schemas, security model |
| [API Reference](./API.md) | Full REST and WebSocket API documentation |
| [Deployment Guide](./DEPLOYMENT.md) | Step-by-step deployment to devnet, Railway, Vercel |
| [Hackathon Submission](./HACKATHON.md) | Problem statement, technical achievements, demo guide |

---

## Team

| Name | Role | Contact |
|---|---|---|
| Ezra Nahamry | Founder · Full-Stack · Smart Contract | ezranhmry@gmail.com |

*Built solo for the 100xDevs track — Colosseum Frontier 2026.*

---

## License

MIT
