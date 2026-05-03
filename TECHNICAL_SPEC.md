# MindDuel — Technical Specification
## Smart Contract & Backend Requirements

> Colosseum Frontier 2026 · 100xDevs Track · Built on Solana  
> Version: 1.0 · Last updated: 2026-05-03

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Smart Contract — Anchor Program](#2-smart-contract--anchor-program)
   - [Account Structures](#21-account-structures)
   - [Instructions](#22-instructions)
   - [Error Codes](#23-error-codes)
   - [Board Shift Randomness](#24-board-shift-randomness)
   - [Drama Score](#25-drama-score)
   - [Security Model](#26-security-model)
3. [Backend — Fastify Service](#3-backend--fastify-service)
   - [Trivia Engine](#31-trivia-engine)
   - [Matchmaking Service](#32-matchmaking-service)
   - [WebSocket Real-time Sync](#33-websocket-real-time-sync)
   - [Leaderboard Indexer](#34-leaderboard-indexer)
   - [NFT Trigger Service](#35-nft-trigger-service)
   - [API Routes Reference](#36-api-routes-reference)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [Environment & Deployment](#5-environment--deployment)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Player)                     │
│  Next.js 14 · WalletAdapter · Framer Motion             │
└────────┬──────────────────────────┬─────────────────────┘
         │  RPC / WS subscription   │  REST + WS
         ▼                          ▼
┌─────────────────┐      ┌──────────────────────────┐
│  Solana Devnet  │      │  Backend (Fastify :3001)  │
│  Anchor Program │◄────►│  Trivia · Match · Indexer │
│  QuickNode RPC  │      │  WebSocket · NFT Trigger  │
└─────────────────┘      └──────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Metaplex (NFT) │
│  Soulbound Badge│
│  Epic Game NFT  │
└─────────────────┘
```

### Layer Responsibilities

| Layer | Owns | Does NOT own |
|---|---|---|
| Anchor Program | Game state, escrow, win detection, hint ledger, drama score | Question content, matchmaking, leaderboard cache |
| Backend | Commit-reveal salt, trivia questions, matchmaking queue, leaderboard index | Escrow funds, board state |
| Frontend | UI rendering, wallet signing, WebSocket listener | Any game state truth |

**Golden rule:** The Anchor program is the single source of truth for all game state. The backend is stateless relative to game outcomes.

---

## 2. Smart Contract — Anchor Program

**Crate:** `mind-duel`  
**Program ID:** `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS` (devnet placeholder)  
**Anchor version:** `0.30.x`

### 2.1 Account Structures

#### `GameAccount` — PDA
Seeds: `["game", player_one.key(), player_two.key()]`

```rust
#[account]
pub struct GameAccount {
    // ── Players ──────────────────────────────────────────
    pub player_one:          Pubkey,       // X player (match creator)
    pub player_two:          Pubkey,       // O player (joiner)

    // ── Escrow ───────────────────────────────────────────
    pub wager_lamports:      u64,          // per-player deposit (equal)
    pub total_pot_lamports:  u64,          // wager_lamports × 2
    pub platform_fee_bps:    u16,          // 250 = 2.5%
    pub p1_deposited:        bool,
    pub p2_deposited:        bool,

    // ── Board state ──────────────────────────────────────
    pub board:               [u8; 25],     // 5×5 max; 0=empty 1=X 2=O
    pub board_size:          u8,           // 3 | 4 | 5
    pub game_mode:           GameMode,
    pub current_turn:        u8,           // 1=X 2=O
    pub round_counter:       u16,          // incremented each half-turn
    pub move_count:          u8,           // total pieces placed

    // ── Status ───────────────────────────────────────────
    pub status:              GameStatus,
    pub winner:              Option<Pubkey>,
    pub created_at:          i64,          // Unix timestamp
    pub last_action_at:      i64,

    // ── Trivia commit-reveal ──────────────────────────────
    pub answer_hash:         [u8; 32],     // keccak256(answer + salt); 0 if no pending question
    pub question_id:         String,       // max 36 chars (UUID)
    pub p1_consecutive_wrong: u8,
    pub p2_consecutive_wrong: u8,

    // ── Hint ledger ───────────────────────────────────────
    pub p1_hints_used:       [bool; 5],    // [eliminate2, category, extra_time, first_letter, skip]
    pub p2_hints_used:       [bool; 5],
    pub total_hint_revenue:  u64,

    // ── Drama score ───────────────────────────────────────
    pub drama_score:         u32,
    pub board_shifts:        u8,
    pub comebacks:           u8,
    pub max_consecutive_correct: u8,

    // ── Scale Up mode state ───────────────────────────────
    pub p1_streak:           u8,
    pub p2_streak:           u8,
    pub expansion_triggered: bool,

    // ── Timeout ───────────────────────────────────────────
    pub turn_timeout_seconds: u32,         // 86400 standard, 300 blitz
    pub p1_timeout_count:    u8,
    pub p2_timeout_count:    u8,

    // ── Flags ─────────────────────────────────────────────
    pub is_free_play:        bool,
    pub is_epic:             bool,         // drama_score ≥ EPIC_THRESHOLD
    pub bump:                u8,
}
```

**Space:** `8 + 32×2 + 8×3 + 2 + 2 + 25 + 1 + (1+4) + 1×5 + 36 + 1×2 + 5×2 + 8 + 4×4 + 1×2 + 1 + 4 + 1×3 + 1×2 + 1 ≈ 320 bytes`  
Use `#[account(init, ..., space = 400)]` (pad for safety).

---

#### `HintLedger` — PDA
Seeds: `["hint_ledger", game.key()]`

```rust
#[account]
pub struct HintLedger {
    pub game:            Pubkey,
    pub entries:         Vec<HintEntry>,   // max 20 entries per match
    pub total_collected: u64,              // lamports collected this match
    pub bump:            u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct HintEntry {
    pub player:    Pubkey,
    pub hint_type: HintType,
    pub cost:      u64,
    pub round:     u16,
    pub timestamp: i64,
}
```

**Space:** `8 + 32 + (4 + 20 × 58) + 8 + 1 = 1181 bytes`

---

#### `LeaderboardEntry` — PDA
Seeds: `["leaderboard", wallet.key()]`

```rust
#[account]
pub struct LeaderboardEntry {
    pub wallet:           Pubkey,
    pub total_wins:       u32,
    pub total_losses:     u32,
    pub total_draws:      u32,
    pub ranked_points:    i64,
    pub sol_earned:       i64,             // net lamports (can be negative)
    pub current_streak:   u8,
    pub best_streak:      u8,
    pub last_played_at:   i64,
    pub bump:             u8,
}
```

**Space:** `8 + 32 + 4×3 + 8 + 8 + 1×2 + 8 + 1 = 82 bytes`

---

#### `ProtocolConfig` — PDA (singleton)
Seeds: `["protocol_config"]`

```rust
#[account]
pub struct ProtocolConfig {
    pub authority:          Pubkey,        // admin multisig
    pub treasury:           Pubkey,        // hint revenue destination
    pub platform_fee_bps:   u16,           // 250
    pub hint_treasury_pct:  u8,            // 80 (80% to treasury)
    pub hint_prize_pct:     u8,            // 20 (20% to weekly prize pool)
    pub epic_threshold:     u32,           // drama score >= this → epic
    pub prize_pool_balance: u64,
    pub bump:               u8,
}
```

---

### 2.2 Instructions

#### `initialize_game`

**Purpose:** Create GameAccount PDA and set initial state.

```rust
// Accounts
pub struct InitializeGame<'info> {
    #[account(mut)]
    pub player_one: Signer<'info>,

    /// CHECK: validated by constraint
    pub player_two: AccountInfo<'info>,

    #[account(
        init,
        payer = player_one,
        space = 400,
        seeds = [b"game", player_one.key().as_ref(), player_two.key().as_ref()],
        bump
    )]
    pub game: Account<'info, GameAccount>,

    #[account(
        init,
        payer = player_one,
        space = 1200,
        seeds = [b"hint_ledger", game.key().as_ref()],
        bump
    )]
    pub hint_ledger: Account<'info, HintLedger>,

    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

// Parameters
pub struct InitializeGameParams {
    pub wager_lamports:      u64,    // 0 if free play
    pub game_mode:           GameMode,
    pub turn_timeout_seconds: u32,
    pub is_free_play:        bool,
    pub trivia_category:     String,
}
```

**Validation:**
- `wager_lamports > 0 || is_free_play == true`
- `player_one != player_two`
- `game_mode` is a valid enum variant

**Logic:**
1. Initialize GameAccount with all fields.
2. Set `status = GameStatus::WaitingForDeposit` (or `Active` if free play).
3. Set `board = [0u8; 25]`, `board_size = 3`.
4. Set `current_turn = 1` (X goes first = player_one).
5. Emit `GameInitialized` event.

---

#### `deposit`

**Purpose:** Lock player's wager into the GameAccount PDA escrow.

```rust
pub struct Deposit<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        constraint = game.player_one == player.key() || game.player_two == player.key()
            @ MindDuelError::UnauthorizedPlayer,
        constraint = game.status == GameStatus::WaitingForDeposit
            @ MindDuelError::InvalidGameStatus,
    )]
    pub game: Account<'info, GameAccount>,

    pub system_program: Program<'info, System>,
}
```

**Logic:**
1. Transfer `game.wager_lamports` from `player` to `game` PDA.
2. Set `p1_deposited = true` or `p2_deposited = true` accordingly.
3. If both deposited → set `status = GameStatus::Active`, `created_at = Clock::get()?.unix_timestamp`.
4. Emit `BothDeposited` event when match becomes active.

**Error cases:**
- Player already deposited → `AlreadyDeposited`
- Wrong amount → handled by the transfer (insufficient funds = system error)

---

#### `commit_answer`

**Purpose:** Player commits a hashed answer before the answer is revealed. Prevents front-running.

```rust
pub struct CommitAnswer<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameStatus,
        constraint = is_current_player(&game, &player.key()) @ MindDuelError::NotYourTurn,
        constraint = game.answer_hash == [0u8; 32] @ MindDuelError::AnswerAlreadyCommitted,
    )]
    pub game: Account<'info, GameAccount>,
}

pub struct CommitAnswerParams {
    pub answer_hash: [u8; 32],    // keccak256(answer_text + salt)
    pub question_id: String,      // UUID from backend
    pub cell_index:  u8,          // 0–8 (3×3) or 0–24 (5×5); chosen cell
}
```

**Logic:**
1. Validate `cell_index` is within `board_size × board_size` and is empty.
2. Store `answer_hash`, `question_id`, `pending_cell = cell_index`.
3. Set `last_action_at = Clock::get()?.unix_timestamp`.
4. Emit `AnswerCommitted` event.

---

#### `reveal_answer`

**Purpose:** Backend reveals salt → contract verifies → places piece or forfeits turn.

```rust
pub struct RevealAnswer<'info> {
    /// The trivia backend server — must be a trusted signer
    #[account(
        constraint = *reveal_authority.key == config.reveal_authority
            @ MindDuelError::UnauthorizedReveal
    )]
    pub reveal_authority: Signer<'info>,

    #[account(
        mut,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameStatus,
        constraint = game.answer_hash != [0u8; 32] @ MindDuelError::NoPendingAnswer,
    )]
    pub game: Account<'info, GameAccount>,

    #[account(mut)]
    pub winner_account: Option<AccountInfo<'info>>,   // populated on game end

    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

pub struct RevealAnswerParams {
    pub salt:              String,
    pub correct_answer:    String,
    pub player_answer:     String,
}
```

**Logic:**
1. Compute `expected_hash = keccak256(correct_answer + salt)`.
2. Verify `expected_hash == game.answer_hash`. If not → `InvalidReveal` error.
3. Compute `is_correct = keccak256(player_answer + salt) == game.answer_hash`.
4. Clear `game.answer_hash = [0u8; 32]`.

**If correct:**
- Place piece on `pending_cell`: set `board[pending_cell] = current_turn`.
- Increment `move_count`.
- Update streaks, drama score.
- Check win condition (see Win Detection below).
- If no win and board not full: advance turn, increment `round_counter`.
- In Shifting Board mode: check if shift is due (every 3 rounds).
- In Scale Up mode: check if expansion is due (3-streak).

**If wrong or timeout:**
- Clear `pending_cell`.
- Update consecutive wrong count.
- Forfeit turn → advance to opponent.
- Opponent gets a bonus consecutive move (next turn starts immediately).
- Add drama points for comeback opportunity.

**Win Detection:**
```rust
fn check_winner(board: &[u8; 25], size: u8) -> Option<u8> {
    let n = size as usize;
    let win_len = if size == 5 { 4 } else { size as usize };
    // check rows, cols, diagonals for win_len consecutive same value
    // returns Some(1) for X, Some(2) for O, None otherwise
}
```

**After win detected:**
- Set `game.status = GameStatus::Finished`, `game.winner = Some(player_pubkey)`.
- Transfer `total_pot - platform_fee` to winner.
- Transfer `platform_fee` to `protocol_config.treasury`.
- Emit `GameFinished` event.

**Draw (board full, no winner):**
- Classic/Blitz/Scale Up: split pot 50/50, both receive `(total_pot / 2) - (platform_fee / 2)`.
- Scale Up special: set `status = SuddenDeath`, issue one final question.
- Emit `Draw` event.

---

#### `claim_hint`

**Purpose:** Player purchases a hint mid-turn. Transfers micro-SOL to treasury.

```rust
pub struct ClaimHint<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameStatus,
        constraint = is_current_player(&game, &player.key()) @ MindDuelError::NotYourTurn,
        constraint = game.answer_hash != [0u8; 32] @ MindDuelError::NoPendingAnswer,
    )]
    pub game: Account<'info, GameAccount>,

    #[account(mut, seeds = [b"hint_ledger", game.key().as_ref()], bump = hint_ledger.bump)]
    pub hint_ledger: Account<'info, HintLedger>,

    #[account(mut, constraint = *treasury.key == config.treasury)]
    pub treasury: AccountInfo<'info>,

    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

pub struct ClaimHintParams {
    pub hint_type: HintType,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum HintType {
    Eliminate2,     // 0.002 SOL = 2_000_000 lamports
    CategoryReveal, // 0.001 SOL = 1_000_000 lamports
    ExtraTime,      // 0.003 SOL = 3_000_000 lamports  (Blitz only)
    FirstLetter,    // 0.001 SOL = 1_000_000 lamports
    SkipQuestion,   // 0.005 SOL = 5_000_000 lamports
}
```

**Logic:**
1. Validate player hasn't already used this hint type this turn (use `p1_hints_used` / `p2_hints_used`).
2. Calculate `cost = hint_cost(hint_type)`.
3. Transfer `cost` from `player` to `treasury`.
4. Mark hint as used in `hints_used` array.
5. Add `HintEntry` to `hint_ledger.entries`.
6. Update `game.total_hint_revenue += cost`.
7. Emit `HintPurchased` event with `{ player, hint_type, cost, round }`.

**Note:** The actual hint effect (e.g., which 2 answers to eliminate) is handled by the backend, not on-chain. The contract only records that the hint was purchased.

---

#### `timeout_turn`

**Purpose:** Anyone can call this after turn timeout expires to force-forfeit the inactive player.

```rust
pub struct TimeoutTurn<'info> {
    pub caller: Signer<'info>,  // can be anyone (permissionless)

    #[account(
        mut,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameStatus,
    )]
    pub game: Account<'info, GameAccount>,

    pub clock: Sysvar<'info, Clock>,
    pub system_program: Program<'info, System>,
}
```

**Logic:**
1. Compute `elapsed = clock.unix_timestamp - game.last_action_at`.
2. Validate `elapsed >= game.turn_timeout_seconds as i64` → else `TurnNotTimedOut`.
3. Increment `p1_timeout_count` or `p2_timeout_count` for inactive player.
4. If timeout count >= 3: forfeit match, opponent wins, trigger settle_game.
5. Otherwise: forfeit turn, advance to opponent.
6. Emit `TurnTimedOut` event.

---

#### `settle_game`

**Purpose:** Called internally after win/draw detection, or directly after 3 consecutive timeouts. Distributes funds.

```rust
pub struct SettleGame<'info> {
    #[account(
        mut,
        constraint = game.status == GameStatus::Finished || game.status == GameStatus::Draw
            @ MindDuelError::InvalidGameStatus,
    )]
    pub game: Account<'info, GameAccount>,

    #[account(mut)]
    pub winner: AccountInfo<'info>,

    #[account(mut)]
    pub loser: AccountInfo<'info>,

    #[account(mut, constraint = *treasury.key == config.treasury)]
    pub treasury: AccountInfo<'info>,

    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}
```

**Logic:**
1. If `status == Draw`: split pot 50/50 (minus fee from each half).
2. If `status == Finished`: full pot to winner minus fee.
3. Platform fee: `fee = total_pot * platform_fee_bps / 10_000`.
4. Transfer to winner: `total_pot - fee` (or `total_pot / 2 - fee / 2` for draw).
5. Transfer fee to treasury.
6. Update `LeaderboardEntry` for both players (ranked points, win/loss, sol_earned).
7. Check drama score → if `drama_score >= config.epic_threshold`, set `game.is_epic = true`.
8. Check streak for badge NFT eligibility → emit `BadgeEligible` event if streak == 3, 5, or 10.
9. Set `status = GameStatus::Settled`.

**Ranked Points formula:**
```
Winner: +10 + (wager_tier_bonus) + (drama_bonus)
Loser:  −4
Draw:   +2 each
wager_tier_bonus: casual=0, challenger=5, high_stakes=10
drama_bonus: drama_score / 100 (capped at 5)
```

---

#### `shift_board` (internal, called within `reveal_answer`)

**Purpose:** Execute a board shift in Shifting Board mode. Not a standalone instruction — called internally every 3 rounds.

```rust
fn shift_board(game: &mut GameAccount, slot_hash: [u8; 32]) {
    // seed = keccak256(slot_hash + game.key + round_counter)
    let seed = keccak256(&[slot_hash, game.key().to_bytes(), game.round_counter.to_le_bytes()].concat());
    let direction = seed[0] % 4; // 0=row_left 1=row_right 2=col_up 3=col_down
    let index = seed[1] % game.board_size;
    // perform shift, wrap-around pieces fall off (no infinite board)
    // update game.board in place
    game.board_shifts += 1;
    game.drama_score += DRAMA_SHIFT_BONUS;
}
```

---

#### `expand_board` (internal, Scale Up mode only)

**Purpose:** Expand board from 3×3 → 4×4 → 5×5 when a 3-streak is achieved.

```rust
fn expand_board(game: &mut GameAccount) {
    // new_size = current board_size + 1 (max 5)
    // existing pieces mapped to new grid (centered)
    // win condition updates automatically based on board_size
    game.board_size += 1;
    game.drama_score += DRAMA_EXPANSION_BONUS;
}
```

---

#### `mint_badge` (CPI to Metaplex)

**Purpose:** Mint a soulbound streak badge NFT after eligible streak.

```rust
pub struct MintBadge<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    pub leaderboard: Account<'info, LeaderboardEntry>,

    // Metaplex accounts...
    pub metadata_program: Program<'info, Metadata>,
    // ... (standard Metaplex CPI accounts)
}

pub struct MintBadgeParams {
    pub badge_type: BadgeType,   // Streak3 | Streak5 | Streak10 | Flawless | BigStake
}
```

**Soulbound enforcement:**
- `update_authority` set to program PDA, not recipient.
- `is_mutable = false`.
- No `freeze_authority` or `master_edition` — prevents listing on marketplaces.

---

### 2.3 Error Codes

```rust
#[error_code]
pub enum MindDuelError {
    #[msg("You are not a player in this game")]
    UnauthorizedPlayer,

    #[msg("It is not your turn")]
    NotYourTurn,

    #[msg("Game is not in the required status for this instruction")]
    InvalidGameStatus,

    #[msg("An answer has already been committed this turn")]
    AnswerAlreadyCommitted,

    #[msg("No pending answer to reveal")]
    NoPendingAnswer,

    #[msg("The reveal does not match the committed hash")]
    InvalidReveal,

    #[msg("Only the authorized reveal authority can call this")]
    UnauthorizedReveal,

    #[msg("The selected cell is already occupied")]
    CellOccupied,

    #[msg("Cell index is out of bounds for current board size")]
    InvalidCellIndex,

    #[msg("This hint type has already been used this turn")]
    HintAlreadyUsed,

    #[msg("Extra Time hint is only available in Blitz mode")]
    HintNotAvailableInMode,

    #[msg("Player has already deposited")]
    AlreadyDeposited,

    #[msg("Wager amounts must match")]
    WagerMismatch,

    #[msg("Turn has not yet timed out")]
    TurnNotTimedOut,

    #[msg("Board expansion requires both players' 3-streak (Scale Up mode)")]
    ExpansionNotEligible,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
```

---

### 2.4 Board Shift Randomness

Used in **Shifting Board** mode. Fully deterministic and publicly verifiable.

```
shift_seed = keccak256(
    recent_slot_hash (32 bytes)  +
    game_pubkey      (32 bytes)  +
    round_counter    (2 bytes LE)
)

direction = shift_seed[0] % 4
    0 → row shift left
    1 → row shift right
    2 → col shift up
    3 → col shift down

affected_index = shift_seed[1] % board_size
```

**Shift warning:** The shift parameters for round `N+1` are computed and emitted as an event at round `N` — giving players 1 round advance notice.

**Piece behavior during shift:**
- Pieces shift with their row/column.
- Pieces shifted off the edge are **removed** (wrap-around is not supported).
- If a removal creates a winning line for the opponent, the win is valid.

---

### 2.5 Drama Score

Drama score determines whether a match qualifies as an **Epic Game** (mintable as NFT).

```rust
const DRAMA_SHIFT_BONUS:       u32 = 15;   // per board shift
const DRAMA_EXPANSION_BONUS:   u32 = 20;   // per board expansion
const DRAMA_COMEBACK_BONUS:    u32 = 30;   // trailing by 2 moves and winning
const DRAMA_CONSECUTIVE_BONUS: u32 = 10;   // per consecutive correct answer (≥3)
const DRAMA_OVERTIME_BONUS:    u32 = 25;   // sudden death question
const DRAMA_HINT_BONUS:        u32 = 5;    // per hint purchase
const EPIC_THRESHOLD:          u32 = 80;   // drama_score ≥ 80 → Epic Game
```

**Comeback detection:**
```
is_comeback = (loser's piece count) <= (winner's piece count - 2)
              AND loser wins the match
```

---

### 2.6 Security Model

| Threat | Mitigation |
|---|---|
| Front-running (reading correct answer from mempool) | Commit-reveal scheme: answer hash committed before question shown |
| Admin key fund drain | No admin can touch escrow. Only `settle_game` can transfer out |
| Replay attack | `answer_hash` cleared to `[0u8;32]` after reveal |
| Wrong signer claiming win | `winner` account validated against `game.winner` in `settle_game` |
| Infinite timeout loop | `timeout_turn` is permissionless — anyone can call it |
| Board shift manipulation | Shift seed includes `game_pubkey` — unique per match |
| Underfunded deposit | System program rejects transfer if insufficient lamports |
| Double-deposit | `AlreadyDeposited` error if `p1_deposited == true` |
| 3 consecutive timeouts = forfeit | Prevents indefinite game lock |

---

## 3. Backend — Fastify Service

**Runtime:** Node.js 20 + Fastify 4 + TypeScript  
**Port:** `3001`  
**Database:** In-memory cache (Redis-compatible Map) for hackathon; PostgreSQL for production

---

### 3.1 Trivia Engine

#### Responsibilities
- Serve trivia questions to frontend
- Generate and store commit-reveal salts
- Reveal salt to Anchor program when player submits answer
- Cache questions to avoid API rate limits

#### Question Sources
1. **Open Trivia DB** (`https://opentdb.com/api.php`) — primary source
2. **Custom Web3 bank** — Solana, DeFi, NFT, Anchor-specific questions (stored locally in `backend/src/data/web3_questions.json`)

#### Trivia Session Flow

```
1. Frontend requests question:
   GET /trivia/question?category=web3&difficulty=medium&game_id=<UUID>

2. Backend:
   a. Fetch question from pool (cached)
   b. Generate salt: salt = crypto.randomBytes(32).toString('hex')
   c. Compute hash: answer_hash = keccak256(correct_answer + salt)
   d. Store in session: sessionMap.set(question_id, { salt, correct_answer, game_id, expires_at })
   e. Return to frontend: { question_id, question, options, time_limit, category }
      (correct_answer is NEVER in the response)

3. Frontend calls commit_answer on-chain with { answer_hash, question_id, cell_index }

4. Player submits answer via frontend → frontend sends to backend:
   POST /trivia/reveal
   Body: { question_id, player_answer, game_id, player_pubkey }

5. Backend calls reveal_answer instruction on-chain:
   { salt, correct_answer, player_answer }
   (backend is the reveal_authority signer)
```

#### Session Storage Schema

```typescript
interface TriviaSession {
  questionId:    string
  gameId:        string
  salt:          string
  correctAnswer: string
  category:      string
  difficulty:    'easy' | 'medium' | 'hard'
  expiresAt:     number   // Date.now() + timeout_ms
  revealed:      boolean
}

// Map key: questionId
const sessions = new Map<string, TriviaSession>()
```

#### Question Cache

```typescript
interface CachedQuestion {
  id:            string
  question:      string
  options:       string[]    // 4 choices, shuffled
  correctIndex:  number      // 0–3 (NOT sent to client directly; stored server-side)
  correctAnswer: string      // stored server-side only
  category:      string
  difficulty:    'easy' | 'medium' | 'hard'
  source:        'opentdb' | 'custom'
  timeLimit:     number      // seconds: easy=15 medium=20 hard=25 blitz=10
}
```

**Cache refresh:** Every 60 minutes, pull 50 questions per category from Open Trivia DB. Keep minimum 200 questions in cache at all times.

---

### 3.2 Matchmaking Service

#### Matchmaking Queue Entry

```typescript
interface QueueEntry {
  playerId:      string    // wallet pubkey
  wagerTier:     'casual' | 'challenger' | 'high_stakes' | 'free'
  wagerAmount:   number    // lamports
  gameMode:      GameMode
  category:      string[]
  joinedAt:      number
  socketId:      string    // WebSocket connection ID
}
```

#### Matchmaking Logic

```
1. Player joins queue: POST /match/queue
2. Server searches for compatible opponent:
   - Same wager_tier
   - Same game_mode
   - At least 1 overlapping category
   - Joined within last 60 seconds (prevent stale matches)
3. Match found:
   a. Server creates GameAccount PDA via `initialize_game` instruction
      (player_one = first queued, player_two = matched)
   b. Notify both players via WebSocket: { type: 'MATCH_FOUND', matchId, opponentPubkey }
   c. Both players shown deposit screen
4. No match after 30 seconds: extend to 120 seconds, then fail with 'NO_OPPONENT_FOUND'
   → UI offers vs-AI fallback
```

#### Private Match (Share Link)

```
POST /match/create
Body: { hostPubkey, wagerAmount, gameMode, category[] }
Response: { matchId, joinCode: "MNDL-XXXX", expiresAt }

GET /match/join/:joinCode
Response: { matchId, hostPubkey, wagerAmount, gameMode }
```

---

### 3.3 WebSocket Real-time Sync

**Primary:** Solana account subscription via QuickNode WebSocket  
**Fallback:** Polling every 3 seconds if WebSocket fails

#### Backend WebSocket Server (for client connections)

```typescript
// ws://localhost:3001/ws
interface WsClientMessage {
  type: 'SUBSCRIBE_GAME' | 'PING'
  matchId?: string
}

interface WsServerMessage {
  type:
    | 'GAME_STATE_UPDATE'   // board state changed
    | 'TURN_CHANGED'        // whose turn it is
    | 'TRIVIA_QUESTION'     // new question for current player
    | 'ANSWER_RESULT'       // correct / wrong
    | 'BOARD_SHIFT_WARNING' // 1 round before shift
    | 'BOARD_SHIFTED'       // shift executed
    | 'BOARD_EXPANDED'      // Scale Up expansion
    | 'GAME_FINISHED'       // winner / draw
    | 'HINT_USED'           // opponent bought a hint
    | 'PLAYER_TIMEOUT'      // someone timed out
    | 'MATCH_FOUND'         // matchmaking success
    | 'ERROR'
    | 'PONG'
  payload: Record<string, unknown>
}
```

#### Solana Account Subscription

```typescript
// Subscribe to GameAccount PDA changes
const subscriptionId = connection.onAccountChange(
  gamePubkey,
  (accountInfo) => {
    const decoded = program.coder.accounts.decode('GameAccount', accountInfo.data)
    broadcastGameUpdate(matchId, decoded)
  },
  'confirmed'
)
```

---

### 3.4 Leaderboard Indexer

The backend maintains an indexed copy of leaderboard data by reading on-chain `LeaderboardEntry` PDAs. This enables fast leaderboard queries without expensive on-chain reads.

#### Indexer Loop

```
Every 60 seconds:
1. Fetch all LeaderboardEntry PDAs using getProgramAccounts()
2. Sort by ranked_points DESC
3. Update in-memory leaderboard cache
4. Mark top 10 for weekly prize eligibility
```

#### Leaderboard Cache Schema

```typescript
interface LeaderboardRow {
  rank:          number
  wallet:        string
  wins:          number
  losses:        number
  draws:         number
  rankedPoints:  number
  solEarned:     number    // in SOL (not lamports)
  winRate:       number    // 0–100
  currentStreak: number
  bestStreak:    number
  lastPlayedAt:  string    // ISO date
}
```

---

### 3.5 NFT Trigger Service

The backend listens for `BadgeEligible` and `GameFinished` events from the Anchor program and triggers Metaplex mints accordingly.

#### Streak Badge Mint

```typescript
async function mintStreakBadge(recipientPubkey: string, streakLength: 3 | 5 | 10) {
  const metadata = {
    name: `MindDuel Streak Badge — ${streakLength} Wins`,
    symbol: 'MDUEL',
    uri: `https://mindduel.app/badges/streak-${streakLength}.json`,
    sellerFeeBasisPoints: 0,
    isMutable: false,
  }
  // CPI via mintBadge instruction OR direct Metaplex Umi call
}
```

#### Epic Game NFT Mint (optional, player-triggered)

```
POST /nft/mint-epic
Body: { matchId, playerPubkey, signedTx }
```

Epic Game NFT metadata includes:
- Full move history (JSON array of all board states)
- All questions and answers (correct/wrong)
- Final board image (SVG generated server-side)
- Drama score and match duration
- Both player wallet addresses

---

### 3.6 API Routes Reference

#### Trivia

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/trivia/question` | None | Get question for a game turn |
| `POST` | `/trivia/reveal` | None | Submit answer, trigger reveal on-chain |
| `GET` | `/trivia/categories` | None | List available categories |
| `GET` | `/trivia/health` | None | Cache status and question count |

**`GET /trivia/question`**

Query params:
```
category: string        (general | crypto_web3 | science | history | pop_culture | all)
difficulty: string      (easy | medium | hard | blitz)
game_id: string         (UUID — used to link session)
exclude_ids: string[]   (already seen questions this match)
```

Response `200`:
```json
{
  "questionId": "uuid-v4",
  "question": "What is the smallest unit of SOL?",
  "options": ["Wei", "Satoshi", "Lamport", "Gwei"],
  "category": "Crypto & Web3",
  "timeLimit": 20,
  "difficulty": "easy"
}
```

Note: `correctAnswer` and `correctIndex` are **never** in this response.

---

**`POST /trivia/reveal`**

Body:
```json
{
  "questionId": "uuid-v4",
  "playerAnswer": "Lamport",
  "gamePubkey": "base58...",
  "playerPubkey": "base58..."
}
```

Response `200`:
```json
{
  "correct": true,
  "correctAnswer": "Lamport",
  "onChainTxId": "base58_tx_signature"
}
```

The backend signs and submits `reveal_answer` to Solana. The `correct` field in the response matches on-chain state.

---

#### Matchmaking

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/match/queue` | Wallet sig | Join matchmaking queue |
| `DELETE` | `/match/queue` | Wallet sig | Leave queue |
| `POST` | `/match/create` | Wallet sig | Create private match |
| `GET` | `/match/join/:code` | None | Get match details by join code |
| `GET` | `/match/:matchId` | None | Get current match state |
| `GET` | `/match/:matchId/replay` | None | Get full match replay data |

**`POST /match/queue`**

Body:
```json
{
  "playerPubkey": "base58...",
  "wagerTier": "casual",
  "wagerLamports": 50000000,
  "gameMode": "classic",
  "categories": ["general", "crypto_web3"],
  "signature": "base58_signed_msg"
}
```

Response `200` (matched immediately):
```json
{
  "status": "matched",
  "matchId": "base58_game_pda",
  "opponentPubkey": "base58...",
  "youAre": "X"
}
```

Response `202` (queued):
```json
{
  "status": "queued",
  "queuePosition": 3,
  "estimatedWaitSeconds": 15
}
```

---

#### Leaderboard

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/leaderboard` | None | Top 100 players |
| `GET` | `/leaderboard/player/:pubkey` | None | Single player stats |
| `GET` | `/leaderboard/weekly` | None | This week's top 10 |

**`GET /leaderboard`**

Query params:
```
period: alltime | week | today     (default: alltime)
limit:  number                     (default: 100, max: 100)
offset: number                     (default: 0)
```

Response `200`:
```json
{
  "period": "alltime",
  "updatedAt": "2026-05-03T12:00:00Z",
  "total": 1240,
  "rows": [
    {
      "rank": 1,
      "wallet": "base58...",
      "wins": 312,
      "losses": 84,
      "draws": 12,
      "rankedPoints": 3420,
      "solEarned": 28.44,
      "winRate": 77,
      "currentStreak": 14,
      "bestStreak": 22
    }
  ]
}
```

---

#### NFT

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/nft/mint-epic` | Wallet sig | Trigger Epic Game NFT mint |
| `GET` | `/nft/badges/:pubkey` | None | List player's badges |
| `GET` | `/nft/epic/:matchId` | None | Epic Game NFT metadata |

---

#### Health & Meta

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service status, cache counts, Solana RPC latency |
| `GET` | `/config` | Public protocol config (fees, hint prices) |

---

### Input Validation Rules (all routes)

All routes use **Zod** schemas. Common rules:

```typescript
const PubkeySchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
const UuidSchema   = z.string().uuid()
const GameModeSchema = z.enum(['classic', 'shifting', 'scaleup', 'blitz'])
const CategorySchema = z.enum(['general', 'crypto_web3', 'science', 'history', 'pop_culture', 'all'])
```

Validation failures return `400` with:
```json
{ "error": "VALIDATION_ERROR", "details": [{ "field": "...", "message": "..." }] }
```

---

## 4. Data Flow Diagrams

### Complete Turn Flow (Stake Mode)

```
Player (Browser)           Backend (:3001)            Anchor Program
─────────────────         ────────────────            ──────────────
Click board cell
                    ──GET /trivia/question──►
                    ◄── { questionId, q, opts }──
Store questionId
Show question + timer

[Player selects answer]
                    ──POST /trivia/reveal──►
                                          sign reveal_answer tx
                                          ──────────────────────►
                                                                  hash verify
                                                                  place piece / forfeit
                                                                  check win
                                          ◄── tx signature ──────
                    ◄── { correct, txId } ──
Show result + tx
  ↓ (WebSocket)
Game state update   ◄── WS: GAME_STATE_UPDATE ──     [onAccountChange fires]
Animate board
```

### Matchmaking Flow

```
Player A                  Backend                   Player B
────────                 ─────────                 ────────
POST /match/queue ──►
                         Queue = [A]
                                           ◄── POST /match/queue
                         Match A ↔ B
                         initialize_game tx ──► Solana
                         ◄── tx confirmed ──────────────
WS: MATCH_FOUND ◄──      Notify both    ──────────────► WS: MATCH_FOUND
Show deposit screen                                Show deposit screen
deposit() tx ──► Solana                            deposit() tx ──► Solana
                         [both deposited]
WS: MATCH_ACTIVE ◄──     Notify both    ──────────────► WS: MATCH_ACTIVE
```

---

## 5. Environment & Deployment

### Environment Variables

```bash
# Backend (.env)
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
REVEAL_AUTHORITY_KEYPAIR=<base58_or_path>   # the backend's signing keypair
TREASURY_PUBKEY=<base58>
OPENTDB_API_URL=https://opentdb.com/api.php
QUESTION_CACHE_SIZE=200
SESSION_TTL_MS=120000          # 2 minutes per trivia session
```

```bash
# Frontend (.env.local)
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
NEXT_PUBLIC_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

### Smart Contract Deployment Checklist

```bash
# 1. Build
anchor build

# 2. Run all tests
anchor test

# 3. Deploy to devnet
anchor deploy --provider.cluster devnet

# 4. Initialize ProtocolConfig (one-time)
anchor run init-protocol --provider.cluster devnet

# 5. Upload IDL
anchor idl init --filepath target/idl/mind_duel.json <PROGRAM_ID> --provider.cluster devnet

# 6. Verify
anchor idl fetch <PROGRAM_ID> --provider.cluster devnet
```

### Test Coverage Requirements

| Instruction | Happy Path | Error Paths |
|---|---|---|
| `initialize_game` | ✓ | player_one == player_two, invalid mode |
| `deposit` | ✓ | wrong amount, already deposited, wrong player |
| `commit_answer` | ✓ | not your turn, already committed, occupied cell |
| `reveal_answer` | ✓ correct | wrong hash, no pending, unauthorized signer |
| `reveal_answer` | ✓ wrong | board full draw, win detection |
| `claim_hint` | ✓ each type | hint already used, not your turn, no pending Q |
| `timeout_turn` | ✓ | turn not timed out, 3rd timeout = forfeit |
| `settle_game` | win | draw 50/50, platform fee |
| `shift_board` | every 3 rounds | randomness derivation |
| `expand_board` | 3-streak | max size 5×5 |

---

*End of Technical Specification*  
*MindDuel · Colosseum Frontier 2026 · 100xDevs Track*
