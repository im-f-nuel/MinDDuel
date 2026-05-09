# MindDuel — Game Mechanics

This document covers every game mode, the commit-reveal answer scheme, the trivia flow, the hint economy, and all win/draw/timeout conditions.

---

## Core Concept

MindDuel is Tic Tac Toe with a knowledge gate: **you cannot place a piece unless you answer a trivia question correctly**. Each turn has two on-chain transactions — a commit and a reveal — so neither player can front-run or cheat by watching the blockchain.

Stakes are locked in a trustless escrow PDA before the game starts. The winner collects the full pot minus a 2.5% platform fee. There is no server involved in fund custody at any point.

---

## Game Modes

### Classic Duel (MVP)

- Standard 3x3 Tic Tac Toe board.
- First to get three marks in a row (horizontal, vertical, diagonal) wins.
- If all 9 cells are filled with no winner, the pot is split 50/50.
- Turn timeout: 24 hours (86,400 seconds). After that, either player can call `timeout_turn` to force the opponent's turn to pass, or `settle_game` which treats the timed-out position as a draw/win depending on board state.

### Shifting Board (Beta)

- Starts as 3x3 Classic.
- Every 3 rounds, the entire board is rotated in one of four directions: rows down, rows up, columns right, or columns left.
- The rotation direction is determined by `Clock::get()?.slot % 4` — unpredictable but deterministic and verifiable by all participants.
- Pieces keep their owner marks after the shift. A player who had three in a row might lose it; an opponent's pieces might align into a winning line.
- This creates dramatic mid-game reversals and forces both players to think beyond the current board state.

### Scale Up (Beta)

- Starts as 3x3. Win condition is always three in a row (not board-size-in-a-row).
- After round 4, the board grows to 4x4. Existing pieces are preserved in the top-left quadrant; new cells are empty.
- After round 9, the board grows to 5x5. Same expansion logic.
- Board never shrinks. The on-chain `board` field is always 25 cells (5x5 flat array); `board_size` tracks the active dimension.
- On a 4x4 or 5x5 board, the `determine_winner` function scans every possible 3-in-a-row window (rows, columns, both diagonals) — standard TTT win conditions remain, just in a larger space.

### Blitz (Coming Soon)

- 5-minute total turn time (300 seconds) enforced on-chain.
- If a player does not complete commit + reveal within 300 seconds of the previous action, the opponent can call `timeout_turn`, which clears the pending commit and flips the turn.
- In `reveal_answer`, if elapsed time since last action exceeds `BLITZ_TIMEOUT_SECS` the answer is treated as a wrong answer even if the hash matches. This means the cell is not placed and the turn passes.
- No extended thinking: you either know the answer or you lose the turn.

### vs AI (Practice)

- No on-chain stake. The AI opponent logic runs in the frontend.
- Results are recorded in the backend database as practice matches with opponent stored as `"AI"`.
- Excluded from the main leaderboard (which filters by valid Solana wallet addresses for the winner field).
- Full trivia flow still applies — the player must answer correctly to place their piece.

---

## Commit-Reveal Answer Scheme

The commit-reveal pattern prevents two categories of cheating:

1. **Answer snooping**: Without commit-reveal, a malicious player could watch the blockchain for the opponent's `revealAnswer` tx and submit their own answer only after seeing whether the opponent succeeded.
2. **Answer replay**: Re-using a previously seen (answer, nonce) pair to place a piece.

### How It Works

```mermaid
sequenceDiagram
    actor P as Player
    participant FE as Frontend
    participant BE as Backend
    participant CH as Solana Chain

    P->>FE: View trivia question
    FE->>BE: GET /api/trivia/question
    BE->>BE: Pick random question\nCreate session: hash(questionId, correctIndex)
    BE-->>FE: { sessionId, commitHash, question, options[] }

    P->>FE: Select answer (index 0-3)
    FE->>FE: nonce = crypto.getRandomValues(32 bytes)
    FE->>FE: answerHash = SHA-256([answerIndex byte, ...nonce])
    FE->>CH: commitAnswer(answerHash, cellIndex)
    Note over CH: Stores committed_hash, committed_cell\nResets committed_hash only on reveal
    CH-->>FE: Transaction confirmed

    P->>FE: (confirm submission)
    FE->>BE: POST /api/trivia/reveal { sessionId, answerIndex }
    BE-->>FE: { correct: true/false, correctIndex: N }

    FE->>CH: revealAnswer(answerIndex, nonce)
    Note over CH: Recomputes SHA-256([answerIndex, nonce])\nMust equal committed_hash
    CH->>CH: If correct: place mark on board
    CH->>CH: Apply mode mutation (ShiftingBoard / ScaleUp)
    CH->>CH: Clear committed_hash → [0u8; 32]
    CH->>CH: Switch current_turn to opponent
    CH-->>FE: AnswerRevealed event
```

### Hash Construction

```typescript
// Frontend (trivia.ts)
const preimage = new Uint8Array(33)
preimage[0] = answerIndex          // 0, 1, 2, or 3
preimage.set(nonce, 1)             // 32-byte random nonce
const hashBuffer = await crypto.subtle.digest('SHA-256', preimage)
```

```rust
// Program (reveal_answer.rs)
let mut preimage = [0u8; 33];
preimage[0] = answer_index;
preimage[1..].copy_from_slice(&nonce);
let computed = hash::hash(&preimage).to_bytes();
require!(computed == game.committed_hash, MindDuelError::HashMismatch);
```

The `hash::hash` used in the Anchor program is `solana_program::hash::hash`, which is SHA-256. Both sides produce identical output for the same input.

### Wrong Answer Convention

When the frontend determines the answer is wrong (after receiving `correct: false` from the backend), it calls `revealAnswer` with `answer_index = 255`. The program treats any `answer_index == 255` as "wrong answer" — the cell is not placed, but the committed hash is still cleared and the turn passes to the opponent. This allows the game to continue even when a player gets a question wrong.

---

## Trivia Question Flow

1. Frontend calls `GET /api/trivia/question?categories=Math,Science&difficulty=medium`.
2. Backend selects a random question from the filtered pool. If the filtered pool has fewer than 3 questions, it falls back to the full question bank.
3. Backend creates a commit-reveal session in memory (10-minute TTL): stores `questionId` and `correctIndex` keyed by a random `sessionId`.
4. Backend returns the question **without** the `correctIndex`, along with the `sessionId` and a `commitHash` (server-side hash of the correct answer). The `commitHash` is informational — the on-chain commitment uses a hash the client generates independently.
5. Player answers. Frontend generates its own 32-byte nonce, computes `SHA-256([answerIndex, ...nonce])`, and submits `commitAnswer` on-chain.
6. Frontend calls `POST /api/trivia/reveal { sessionId, answerIndex }`. Backend checks the session and returns `{ correct, correctIndex }`.
7. Frontend calls `revealAnswer` on-chain with the actual `answerIndex` (or 255 if wrong) and the nonce. The program verifies the hash.

### Question Categories

| Category | Description |
|---|---|
| General Knowledge | Broad trivia across all topics |
| Crypto & Web3 | Blockchain, DeFi, NFTs, Solana ecosystem |
| Science | Physics, biology, chemistry |
| History | World history, key events |
| Math | Arithmetic, algebra, logic |
| Pop Culture | Movies, music, internet culture |

### Difficulty Tiers

| Tier | Time Limit |
|---|---|
| Easy | 30 seconds |
| Medium | 20 seconds |
| Hard | 15 seconds |

---

## Hint System

Hints are purchased on-chain. Each hint transfers a micro-fee from the player's wallet to the treasury (80%) and the match's escrow/prize pool (20%). The escrow addition means buying hints slightly increases the winner's payout — incentivizing skillful use rather than pure pay-to-win.

### Hint Types and Prices

| Hint | SOL Price | USDC Price | Effect |
|---|---|---|---|
| Eliminate 2 | 0.002 SOL | 0.40 USDC | Backend reveals two wrong answer indices |
| Category Reveal | 0.001 SOL | 0.20 USDC | Question's category is shown |
| Extra Time | 0.003 SOL | 0.60 USDC | Adds 30 seconds to the client-side timer |
| First Letter | 0.001 SOL | 0.20 USDC | Backend reveals the first letter of the correct answer |
| Skip Question | 0.005 SOL | 1.00 USDC | Treats current question as a "wrong answer skip" and advances turn |

### Hint Anti-Double-Spend

Each hint type is tracked as a bitmask bit in the `HintLedger` PDA:

```
Bit 0 → EliminateTwo
Bit 1 → CategoryReveal
Bit 2 → ExtraTime
Bit 3 → FirstLetter
Bit 4 → Skip
```

Once a bit is set for a `(game, player)` pair, calling `claim_hint` with that hint type again fails with `MindDuelError::HintAlreadyUsed`. The ledger is initialized on first hint purchase and persists for the match lifetime.

### Hint Revenue Split

```
Player pays hint_price
  ├─ 80% → Treasury wallet (CPoofbZho4bJmSAyVJxfeMK9CoZpXpDYftctghwUJX86)
  └─ 20% → Escrow PDA (added to prize pool)
```

---

## Win / Draw / Timeout Conditions

### Win Detection

The `determine_winner` function in `settle_game.rs` performs a dynamic scan for any three-in-a-row within the active `board_size x board_size` area. It checks:

- All horizontal windows (3 consecutive cells in each row)
- All vertical windows (3 consecutive cells in each column)
- All top-left to bottom-right diagonal windows
- All top-right to bottom-left diagonal windows

This handles all board sizes (3x3, 4x4, 5x5) using the same algorithm: slide a 3-cell window over every possible line.

### Settlement Conditions

`settle_game` (and `settle_game_usdc`) enforces that the game is genuinely over before distributing funds. At least one of these must be true:

| Condition | Description |
|---|---|
| Winner found | `determine_winner` returns `Some(mark)` |
| Board full | All `board_size^2` active cells are non-empty (draw) |
| Turn timed out | `now - last_action_ts >= TURN_TIMEOUT_SECS` (24h for Classic/Shifting/ScaleUp; 300s for Blitz) |

If none of these hold, `settle_game` returns `MindDuelError::GameStillActive`. This prevents a losing player from settling early to capture a 50/50 draw split.

### Fund Distribution

| Outcome | Distribution |
|---|---|
| Player X wins | X receives `pot - fee`; treasury receives `fee` (2.5%) |
| Player O wins | O receives `pot - fee`; treasury receives `fee` (2.5%) |
| Draw | Each player receives `(pot - fee) / 2`; treasury receives `fee` (2.5%) |

### Resign

Either player in an active game can call `resign_game`. The resigning player concedes immediately. The opponent receives `pot - fee`. The `GameAccount` is closed and rent is refunded to `player_one`.

### Cancel

A game in `WaitingForPlayer` status (no second player has joined yet) can be cancelled by `player_one` via `cancel_match`. The full stake is refunded and the `GameAccount` is closed.

---

## Economic Model

| Item | Value |
|---|---|
| Minimum stake (SOL) | 0.01 SOL |
| Platform fee | 2.5% of total pot |
| Hint: Eliminate 2 | 0.002 SOL / 0.40 USDC |
| Hint: Category Reveal | 0.001 SOL / 0.20 USDC |
| Hint: Extra Time | 0.003 SOL / 0.60 USDC |
| Hint: First Letter | 0.001 SOL / 0.20 USDC |
| Hint: Skip Question | 0.005 SOL / 1.00 USDC |
| Hint revenue: treasury | 80% |
| Hint revenue: prize pool | 20% |
| Draw resolution | 50/50 split after fee |
| Epic Game NFT trigger | Drama score >= 80 |
| Drama score increment | +5 per turn (capped at 100) |

### Stake Tiers (Frontend Classification)

| Tier | Range | Description |
|---|---|---|
| Casual | 0.01 – 0.1 SOL | Low risk, good for beginners |
| Challenger | 0.1 – 1 SOL | Balanced for experienced players |
| High Stakes | > 1 SOL | Maximum risk and reward |

---

## Turn Timeout Details

| Mode | Timeout | Enforced By |
|---|---|---|
| Classic | 24 hours | `timeout_turn` or `settle_game` (timed_out check) |
| Shifting Board | 24 hours | Same as Classic |
| Scale Up | 24 hours | Same as Classic |
| Blitz | 5 minutes | `timeout_turn` OR `revealAnswer` blitz check |

For Blitz mode, even a submitted reveal is treated as wrong if `now - last_action_ts > 300s`. This means a player who takes longer than 5 minutes cannot benefit from a correct answer — the reveal still clears the committed hash and switches turns, but no piece is placed.

---

## Drama Score

The `drama_score` field in `GameAccount` increments by +5 per turn, capped at 100. When it reaches or exceeds 80 (`EPIC_DRAMA_THRESHOLD`), the frontend and backend badge system flag the match as an "Epic Game" eligible for an NFT badge. The score is on-chain, so it cannot be falsified.
