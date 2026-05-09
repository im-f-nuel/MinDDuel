# MindDuel — System Architecture

This document describes the full technical architecture of MindDuel: how every layer connects, how data flows between components, and how the on-chain and off-chain systems interact.

---

## High-Level Overview

MindDuel is a three-layer system:

1. **Frontend (Next.js)** — React UI, wallet integration, on-chain transaction construction.
2. **Backend (Fastify)** — Stateless trivia API, commit-reveal anti-cheat session store, match metadata DB, WebSocket relay, tournament orchestration.
3. **Solana / Anchor** — Trustless escrow, trivia-gated move validation, fund settlement. The on-chain program is the ultimate source of truth for all game state.

The backend never holds player funds and never can. All financial logic is enforced by the Anchor program.

---

## System Architecture Diagram

```mermaid
flowchart TB
    subgraph Browser["Browser (Next.js 14)"]
        UI["React UI\n(pages + components)"]
        WA["@solana/wallet-adapter\n(Phantom / Backpack)"]
        AC["anchor-client.ts\n(tx builder + sponsor flow)"]
        TS["useTriviaSession\n(commit-reveal, client-side)"]
        GS["useGameState\n(Solana WS subscription)"]
        WS_CLIENT["WebSocket client\n(/ws/:matchId)"]
    end

    subgraph Backend["Backend (Fastify — Railway)"]
        TR["GET /api/trivia/question\nPOST /api/trivia/reveal"]
        MR["POST /api/match/create\nPOST /api/match/join\nPOST /api/match/finish"]
        SR["GET /api/leaderboard\nGET /api/history/:player"]
        WS_SRV["WS /ws/:matchId\n(relay + viewer count)"]
        DB["Neon PostgreSQL\n(match history, badges)"]
        CR["commit-reveal store\n(in-memory, TTL 10min)"]
        SP["Sponsor keypair\n(fee payer for txs)"]
    end

    subgraph Solana["Solana Devnet"]
        PG["Anchor Program\n8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN"]
        GA["GameAccount PDA\nseed: [game, player_one]"]
        EA["Escrow PDA\nseed: [escrow, game]"]
        HL["HintLedger PDA\nseed: [hint, game, player]"]
        TR_W["Treasury Wallet\n(hardcoded)"]
    end

    UI --> WA
    UI --> TS
    UI --> WS_CLIENT
    WA --> AC
    TS --> AC
    AC -->|"build tx"| WA
    AC -->|"sponsor sign"| SP
    AC -->|"sendRawTx"| Solana

    UI -->|"GET question"| TR
    UI -->|"POST reveal"| TR
    TR --> CR

    UI -->|"create/join match"| MR
    UI -->|"finish match"| MR
    MR --> DB

    UI -->|"leaderboard/history"| SR
    SR --> DB

    GS -->|"accountSubscribe WS"| GA
    WS_CLIENT <-->|"board_updated, viewer_count"| WS_SRV

    PG --> GA
    PG --> EA
    PG --> HL
    PG -->|"2.5% fee"| TR_W
```

---

## Data Flow: One Full Turn

```mermaid
sequenceDiagram
    actor Player
    participant UI as Frontend
    participant BE as Backend
    participant Chain as Solana

    Player->>UI: Select cell, choose answer
    UI->>BE: GET /api/trivia/question
    BE-->>UI: { sessionId, commitHash, question, options }

    Player->>UI: Click answer option
    UI->>UI: generateNonce() → 32-byte random
    UI->>UI: SHA-256([answerIndex, ...nonce]) → answerHash
    UI->>Chain: commitAnswer(answerHash, cellIndex)
    Chain-->>UI: tx confirmed

    UI->>BE: POST /api/trivia/reveal { sessionId, answerIndex }
    BE-->>UI: { correct: true, correctIndex: 2 }

    UI->>Chain: revealAnswer(answerIndex, nonce)
    Chain->>Chain: verify SHA-256([answerIndex, ...nonce]) == committed_hash
    Chain->>Chain: place mark on board if correct
    Chain->>Chain: apply mode mutation (shift / grow)
    Chain->>Chain: switch current_turn
    Chain-->>UI: tx confirmed + AnswerRevealed event

    UI->>BE: POST /api/match/finish (if game over)
    BE->>DB: record match result, award badges
    UI->>Chain: settleGame() → distribute pot
```

---

## Frontend Component Tree

```
app/
├── layout.tsx                  # Root layout: ThemeProvider, ClientProviders (WalletAdapter)
├── page.tsx                    # Landing / home
├── lobby/
│   └── page.tsx                # Create match, join by code, matchmaking queue
├── game/
│   └── [matchId]/
│       └── page.tsx            # Game room: board + trivia + hints
├── result/
│   └── page.tsx                # Win / draw / loss screen with on-chain proof
├── leaderboard/
│   └── page.tsx                # Global leaderboard (from backend DB)
├── history/
│   └── page.tsx                # Player match history
├── tournaments/
│   ├── page.tsx                # List open tournaments
│   └── [id]/page.tsx           # Tournament bracket view
├── spectate/
│   └── [matchId]/page.tsx      # Read-only spectator view
└── profile/
    └── page.tsx                # Player profile + earned badges

components/
├── game/
│   ├── BoardRenderer.tsx       # Tic Tac Toe board grid, Framer Motion cell animations
│   ├── TriviaPanel.tsx         # Question display, answer options, countdown timer
│   ├── HintPanel.tsx           # Hint selector + on-chain claim confirmation
│   ├── ScoreBar.tsx            # Pot display, drama score, round counter
│   └── GameHeader.tsx          # Player avatars, current turn indicator
├── ui/
│   ├── Button.tsx              # Primary / secondary / danger variants
│   ├── Card.tsx                # Panel wrapper (dark indigo background)
│   ├── Badge.tsx               # Chip / tag component
│   ├── Modal.tsx               # Dialog with Framer Motion overlay
│   ├── Toast.tsx               # Bottom-right notification, auto-dismiss 3s
│   ├── Skeleton.tsx            # Shimmer placeholder (animate-pulse)
│   ├── SkeletonRow.tsx         # Table-row placeholder
│   ├── Icons.tsx               # SVG icon library
│   ├── StateIcons.tsx          # Win / lose / draw / waiting icons
│   └── ConfirmDialog.tsx       # Two-step action confirmation
├── wallet/
│   └── WalletButton.tsx        # Connect / disconnect wallet pill
└── layout/
    ├── NavBar.tsx              # Top navigation
    ├── BottomTabBar.tsx        # Mobile bottom tab navigation
    └── Footer.tsx

hooks/
├── useGameState.ts             # Subscribe to GameAccount PDA via Solana RPC WebSocket
├── useAnchorClient.ts          # Build AnchorClient from connected wallet
├── useTriviaSession.ts         # Client-side commit-reveal: generateNonce, SHA-256 hash
├── useHint.ts                  # Claim hint on-chain + fetch hint data from backend
└── useNetworkCheck.ts          # Detect devnet / mainnet mismatch

lib/
├── anchor-client.ts            # All Anchor tx builders (initializeGame, commitAnswer, ...)
├── trivia.ts                   # Fetch trivia question, hash helpers
├── api.ts                      # Backend REST client (typed fetch wrappers)
├── constants.ts                # PROGRAM_ID, TREASURY_ADDRESS, STAKE_TIERS, HINTS, ...
├── sounds.ts                   # Sound effect manager
├── tokens.ts                   # Design token helpers
├── signing-signal.ts           # Shows "awaiting wallet signature" banner during tx
└── utils.ts                    # General utilities (cn, truncateAddress, ...)
```

---

## Backend Architecture

```
backend/src/
├── index.ts                    # Fastify server bootstrap, CORS, plugin registration
├── routes/
│   ├── trivia.ts               # GET /api/trivia/question, POST /api/trivia/reveal,
│   │                           # GET /api/trivia/peek, GET /api/trivia/categories,
│   │                           # GET /api/trivia/stats
│   ├── match.ts                # POST /api/match/create, POST /api/match/join,
│   │                           # GET /api/match/:matchId, POST/DELETE /api/match/queue,
│   │                           # GET /api/match/player/:playerId
│   ├── stats.ts                # GET /api/leaderboard, GET /api/history/:player,
│   │                           # POST /api/match/finish, POST /api/match/vsai,
│   │                           # GET /api/badges/:player
│   ├── tournament.ts           # POST /api/tournament/create, GET /api/tournament/list,
│   │                           # GET /api/tournament/:id, POST /api/tournament/:id/join,
│   │                           # GET /api/tournament/:id/bracket
│   ├── faucet.ts               # POST /api/faucet (devnet mock-USDC dispenser)
│   ├── sponsor.ts              # GET /api/sponsor/pubkey, POST /api/sponsor/sign-tx
│   └── ws.ts                   # WS /ws/:matchId (rooms, broadcast, heartbeat, rate-limit)
├── lib/
│   ├── db.ts                   # Drizzle ORM + Neon PostgreSQL connection
│   ├── schema.ts               # Drizzle table schemas (matches, badges, tournaments)
│   ├── match-store.ts          # Match CRUD, matchmaking queue, leaderboard queries
│   ├── commit-reveal.ts        # In-memory session store with 10-minute TTL
│   ├── badges.ts               # Badge type metadata + award logic
│   └── tournament-store.ts     # Tournament creation, join, bracket generation
└── data/
    └── questions.ts            # Curated question bank: 6 categories, 3 difficulties
```

---

## Anchor Program Structure

```
programs/mind-duel/src/
├── lib.rs                      # Program entry point, all instruction handlers dispatched
├── constants.rs                # PLATFORM_FEE_BPS, hint prices, PDA seeds, TREASURY_PUBKEY
├── errors.rs                   # MindDuelError enum (15 variants with descriptive messages)
├── state/
│   ├── mod.rs                  # Re-exports game + hint_ledger
│   ├── game.rs                 # GameAccount, GameStatus, GameMode, CellState, Currency
│   └── hint_ledger.rs          # HintLedger, HintType (bitmask-based used-hints tracking)
└── instructions/
    ├── mod.rs                  # Re-exports all instruction modules
    ├── initialize_game.rs      # SOL escrow game creation
    ├── join_game.rs            # Player two joins, stakes match
    ├── commit_answer.rs        # Store answer hash on-chain
    ├── reveal_answer.rs        # Verify hash, place mark, mode mutations
    ├── claim_hint.rs           # SOL hint purchase with 80/20 split
    ├── settle_game.rs          # Distribute pot (win / draw / timeout)
    ├── timeout_turn.rs         # Force turn switch after timeout
    ├── cancel_match.rs         # Cancel waiting SOL match, full refund
    ├── resign_game.rs          # Concede active SOL match
    ├── initialize_game_usdc.rs # USDC SPL-token variant of initialize
    ├── join_game_usdc.rs       # USDC join
    ├── settle_game_usdc.rs     # USDC settle (ATA transfers)
    ├── cancel_match_usdc.rs    # USDC cancel
    ├── claim_hint_usdc.rs      # USDC hint purchase
    └── resign_game_usdc.rs     # USDC resign
```

---

## PDA Derivation

All program-derived addresses use these deterministic seeds:

| Account | Seeds | Purpose |
|---|---|---|
| `GameAccount` | `["game", player_one.pubkey]` | One game per wallet at a time |
| `Escrow` | `["escrow", game.pubkey]` | Holds pot lamports (SOL) or ATA (USDC) |
| `HintLedger` | `["hint", game.pubkey, player.pubkey]` | Tracks used hints per player per game |

The escrow PDA is a system-owned account for SOL games and the authority for an SPL ATA for USDC games. All fund transfers out of escrow require the program's PDA signature — no external party can drain it.

---

## Sponsorship Flow (Gasless UX)

To avoid users needing SOL for transaction fees on devnet demos, the backend acts as a fee-payer sponsor:

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend (sponsor keypair)
    participant Sol as Solana

    FE->>BE: GET /api/sponsor/pubkey
    BE-->>FE: { pubkey: "SponsorAddr..." }
    FE->>FE: tx.feePayer = sponsorPubkey
    FE->>Sol: getLatestBlockhash
    FE->>FE: serialize tx (no user sig yet)
    FE->>BE: POST /api/sponsor/sign-tx { wireBase64 }
    BE->>BE: sponsor.signTransaction(tx)
    BE-->>FE: { signedBase64 }
    FE->>FE: wallet.signTransaction(partial)
    FE->>Sol: sendRawTransaction(fullySignedTx)
    Sol-->>FE: signature
```

If the sponsor endpoint is unreachable, the frontend falls back to user-paid transactions transparently.

---

## Real-Time WebSocket Architecture

```mermaid
flowchart LR
    P1["Player 1\nBrowser"] -->|"WS connect\n/ws/:matchId"| ROOM
    P2["Player 2\nBrowser"] -->|"WS connect\n/ws/:matchId"| ROOM
    SP["Spectators"] -->|"WS connect?role=spectator"| ROOM

    subgraph ROOM["Backend WS Room"]
        direction TB
        BRD["broadcastFromPlayer\n(player events → all others)"]
        BTV["broadcastViewerCount\n(on connect/disconnect)"]
        HB["Heartbeat\n(ping every 30s, kick at 90s stale)"]
        RL["Rate limit\n(60 msgs / 30s window)"]
        SZ["Size limit\n(4KB max payload)"]
    end

    ROOM -->|"board_updated\nstate\nviewer_count"| P1
    ROOM -->|"board_updated\nstate\nviewer_count"| P2
    ROOM -->|"state\nviewer_count"| SP
```

Key properties:
- Spectators receive all events but their messages are dropped (read-only).
- The latest `board_updated` event is cached per room so late-joining clients replay the last board state immediately on connect.
- The room is destroyed (map entry deleted) when the last socket disconnects.

---

## Design Tokens

```
Background:  #0D0D1A  (deep navy-black)
Card surface: #14142B  (dark indigo)
Primary accent: #7C3AED  (violet-600) — active turn, CTA buttons
Secondary: #06B6D4  (cyan-500) — hint panel, info
Success: #10B981  (emerald-500) — correct answer, win
Danger: #EF4444  (red-500) — wrong answer, timeout
Text primary: #F1F5F9  (slate-100)
Text secondary: #94A3B8  (slate-400)
Border: #1E1E3F  (indigo-950)
```

Fonts: `Space Grotesk` (headings) + `Inter` (body/UI), served from Google Fonts.
