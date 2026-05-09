# Smart Contract Reference

| | |
|---|---|
| **Program ID** | `8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN` |
| **Network** | Solana Devnet |
| **Framework** | Anchor 0.30 (Rust) |
| **Instructions** | 14 total (8 SOL + 6 USDC variants) |
| **Explorer** | [View on Solana Explorer](https://explorer.solana.com/address/8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN?cluster=devnet) |

---

## Overview

The MindDuel Anchor program is the sole custodian of all player funds. It enforces four security invariants unconditionally:

- **Trustless escrow.** Funds can only leave via `settle_game`, `cancel_match`, or `resign_game` — and their USDC counterparts. No other path moves lamports out of escrow.
- **Commit-reveal integrity.** The SHA-256 hash committed in `commit_answer` must match exactly in `reveal_answer`. No trusted oracle is involved.
- **Turn discipline.** Only the player whose public key matches `game.current_turn` may commit or reveal.
- **State guards.** Every instruction validates `game.status` before executing any logic.

---

## Account Structures

### GameAccount

**PDA seeds:** `["game", player_one.pubkey]`
**Allocated space:** 196 bytes

```rust
pub struct GameAccount {
    pub player_one:       Pubkey,           // 32 — creator, plays as X
    pub player_two:       Pubkey,           // 32 — joiner, plays as O
    pub status:           GameStatus,       //  1
    pub mode:             GameMode,         //  1
    pub board:            [CellState; 25],  // 25 — flat 5×5; active area = board_size²
    pub board_size:       u8,               //  1 — active board dimension (3, 4, or 5)
    pub current_turn:     Pubkey,           // 32 — wallet that must act next
    pub stake_per_player: u64,              //  8 — lamports (SOL) or base units (USDC)
    pub pot_lamports:     u64,              //  8 — total currently in escrow
    pub committed_hash:   [u8; 32],         // 32 — SHA-256 of pending commit; zeroed between turns
    pub committed_cell:   u8,               //  1 — target cell index for pending commit
    pub last_action_ts:   i64,              //  8 — Unix timestamp of last turn action
    pub round:            u8,               //  1 — increments each turn
    pub drama_score:      u8,               //  1 — 0–100, +5 per turn
    pub bump:             u8,               //  1 — GameAccount PDA bump
    pub escrow_bump:      u8,               //  1 — Escrow PDA bump
    pub currency:         Currency,         //  1 — Sol or MockUsdc
}
```

**Invariants:**
- `committed_hash == [0u8; 32]` means no pending commit — the player is free to commit.
- `board[i]` for `i >= board_size²` is always `CellState::Empty`.
- `current_turn` is always one of `player_one` or `player_two` once the game is `Active`.

### HintLedger

**PDA seeds:** `["hint", game.pubkey, player.pubkey]`
**Allocated space:** 74 bytes
**Initialization:** `init_if_needed` — created on first hint purchase.

```rust
pub struct HintLedger {
    pub game:       Pubkey, // 32
    pub player:     Pubkey, // 32
    pub used_hints: u8,     //  1 — bitmask of purchased hints
    pub bump:       u8,     //  1
}
```

Bitmask layout:

| Bit | Hint Type |
|---|---|
| 0 | EliminateTwo |
| 1 | CategoryReveal |
| 2 | ExtraTime |
| 3 | FirstLetter |
| 4 | Skip |

Once a bit is set it can never be unset — each hint type is purchasable at most once per player per game.

---

## Enums

### GameStatus

| Variant | Description |
|---|---|
| `WaitingForPlayer` | Created by `player_one`; no opponent has joined yet |
| `Active` | Both players joined; game in progress |
| `Finished` | Settled (win, draw, or timeout) |
| `Cancelled` | Cancelled before second player joined |

### GameMode

| Variant | Frontend ID | Description |
|---|---|---|
| `Classic` | `classic` | Standard 3×3 |
| `ShiftingBoard` | `shifting` | Board rotates every 3 rounds via slot entropy |
| `ScaleUp` | `scaleup` | Board grows 3×3 → 4×4 → 5×5 |
| `Blitz` | `blitz` | 5-minute on-chain turn timer |

### CellState

| Variant | Description |
|---|---|
| `Empty` | Unoccupied |
| `X` | Placed by `player_one` |
| `O` | Placed by `player_two` |

### Currency

| Variant | Description |
|---|---|
| `Sol` | Native SOL (lamports) |
| `MockUsdc` | SPL mock-USDC (6 decimals) |

### HintType

| Variant | Bitmask | Price (SOL) | Price (USDC) |
|---|---|---|---|
| `EliminateTwo` | `0x01` | 0.002 SOL | 0.40 USDC |
| `CategoryReveal` | `0x02` | 0.001 SOL | 0.20 USDC |
| `ExtraTime` | `0x04` | 0.003 SOL | 0.60 USDC |
| `FirstLetter` | `0x08` | 0.001 SOL | 0.20 USDC |
| `Skip` | `0x10` | 0.005 SOL | 1.00 USDC |

---

## PDA Derivation

```rust
// GameAccount
PublicKey::find_program_address(
    &[b"game", player_one.as_ref()],
    &PROGRAM_ID,
)

// Escrow — SOL lamport holder
PublicKey::find_program_address(
    &[b"escrow", game_pubkey.as_ref()],
    &PROGRAM_ID,
)

// HintLedger
PublicKey::find_program_address(
    &[b"hint", game_pubkey.as_ref(), player_pubkey.as_ref()],
    &PROGRAM_ID,
)
```

For USDC games, the escrow PDA is the authority for a standard SPL associated token account (ATA):

```typescript
getAssociatedTokenAddressSync(usdcMint, escrowPda, /* allowOwnerOffCurve */ true)
```

---

## Instructions

### `initialize_game`

Create a new SOL-staked match and lock `player_one`'s stake in the escrow PDA.

**Constraints:**
- `stake_amount >= 10_000_000` (0.01 SOL minimum)
- `game` PDA must not already exist (enforces one active game per wallet)

**Accounts:**

| Account | Mut | Signer | Description |
|---|---|---|---|
| `player_one` | yes | yes | Game creator |
| `game` | yes | — | GameAccount PDA (init) |
| `escrow` | yes | — | Escrow PDA (receives stake) |
| `system_program` | — | — | Required for lamport transfer |

**Effect:** Initializes `GameAccount` with `status = WaitingForPlayer`, transfers `stake_amount` to escrow, emits `GameCreated`.

---

### `join_game`

Player two joins an existing SOL game and locks their matching stake.

**Constraints:**
- `game.status == WaitingForPlayer`
- `player_two != player_one`
- Game must not already have a second player

**Accounts:**

| Account | Mut | Signer | Description |
|---|---|---|---|
| `player_two` | yes | yes | Joining player |
| `game` | yes | — | Existing GameAccount |
| `escrow` | yes | — | Receives `player_two` stake |
| `system_program` | — | — | |

**Effect:** Sets `game.player_two`, transitions `game.status = Active`, updates `pot_lamports = stake_per_player × 2`.

---

### `commit_answer`

Lock in an answer commitment for the current turn.

**Constraints:**
- `game.status == Active`
- `game.current_turn == player.key()`
- `game.committed_hash == [0u8; 32]` (no existing commit)
- Cell index within `board_size²` bounds and target cell is `CellState::Empty`

**Accounts:**

| Account | Mut | Signer | Description |
|---|---|---|---|
| `player` | yes | yes | Current turn player |
| `game` | yes | — | Active GameAccount |

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `answer_hash` | `[u8; 32]` | SHA-256([answer_index byte, ...32-byte nonce]) |
| `cell_index` | `u8` | Target cell (0-indexed, row-major order) |

**Effect:** Stores `answer_hash` and `cell_index` in `GameAccount`, updates `last_action_ts`.

---

### `reveal_answer`

Reveal the committed answer. Optionally place a mark and apply board mode mutations.

**Constraints:**
- `game.status == Active`
- `game.current_turn == player.key()`
- `game.committed_hash != [0u8; 32]` (commit must exist)
- `SHA-256([answer_index, ...nonce]) == game.committed_hash`

**Accounts:**

| Account | Mut | Signer | Description |
|---|---|---|---|
| `player` | yes | yes | Current turn player |
| `game` | yes | — | Active GameAccount |

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `answer_index` | `u8` | 0–3 for an answer choice; `255` = explicit wrong answer |
| `nonce` | `[u8; 32]` | The same random nonce used during commit |

**Effect (in order):**
1. Verifies SHA-256 hash matches committed value.
2. Clears `committed_hash` to `[0u8; 32]`.
3. If `answer_index != 255` and not Blitz-timed-out: places `X` or `O` on `committed_cell`.
4. Applies mode mutation:
   - **ShiftingBoard:** every 3rd round, rotate board by `slot % 4` direction.
   - **ScaleUp:** grow board to 4×4 at `round >= 4`; to 5×5 at `round >= 9`.
5. Switches `current_turn` to opponent.
6. Increments `drama_score` (+5, max 100) and `round` (+1).
7. Updates `last_action_ts`.
8. Emits `AnswerRevealed { game, player, cell_index, correct }`.

**ShiftingBoard rotation directions:**

| `slot % 4` | Direction |
|---|---|
| 0 | Rows shift down — top row wraps to bottom |
| 1 | Rows shift up — bottom row wraps to top |
| 2 | Columns shift right — left column wraps to right |
| 3 | Columns shift left — right column wraps to left |

---

### `claim_hint`

Purchase a SOL hint for the current turn.

**Constraints:**
- `game.status == Active`
- `game.current_turn == player.key()`
- `hint_ledger.has_used(hint_type) == false`
- `treasury.key() == TREASURY_PUBKEY` (compile-time constant)

**Accounts:**

| Account | Mut | Signer | Description |
|---|---|---|---|
| `player` | yes | yes | Hint purchaser (current turn player) |
| `game` | — | — | Active game (for validation) |
| `hint_ledger` | yes | — | HintLedger PDA (`init_if_needed`) |
| `treasury` | yes | — | Hardcoded treasury wallet (receives 80%) |
| `prize_pool` | yes | — | Escrow PDA (receives 20%) |
| `system_program` | — | — | |

**Parameters:** `hint_type: HintType`

**Effect:** Transfers `price × 80%` to treasury, `price × 20%` to escrow, sets bitmask bit in `hint_ledger.used_hints`.

---

### `settle_game`

Distribute the SOL pot after the game ends.

**Constraints:**
- `game.status == Active` and `game.currency == Sol`
- At least one is true: winner found, board full, or turn timed out (>= 24h)
- `treasury.key() == TREASURY_PUBKEY`
- `player_one` and `player_two` addresses match `game` state

**Accounts:**

| Account | Mut | Signer | Description |
|---|---|---|---|
| `game` | yes | — | Active SOL game (closed after settle) |
| `escrow` | yes | — | Holds the pot |
| `player_one` | yes | — | Game creator |
| `player_two` | yes | — | Second player |
| `treasury` | yes | — | Hardcoded platform wallet |
| `system_program` | — | — | |

**Effect:**
1. Runs `determine_winner` — dynamic 3-in-a-row scan across the active board.
2. Calculates `fee = pot × 2.5%`.
3. Transfers fee to treasury.
4. Transfers `pot - fee` to winner (or splits equally on draw).
5. Sets `game.status = Finished`.
6. Closes `GameAccount` — rent lamports returned to `player_one`.
7. Emits `GameSettled { game, winner_mark, pot, fee }`.

---

### `timeout_turn`

Force a turn switch when the active player has not acted within the timeout window.

**Constraints:**
- `game.status == Active`
- `clock.unix_timestamp >= game.last_action_ts + timeout`
- Callable by **any signer** — no player restriction. This is intentional: the opponent (or a bot) can enforce timeouts without needing a specific authority.

**Accounts:**

| Account | Mut | Signer | Description |
|---|---|---|---|
| `caller` | — | yes | Any signer (typically the waiting player) |
| `game` | yes | — | Active game |

**Effect:** Clears `committed_hash`, switches `current_turn` to opponent, updates `last_action_ts`. The game remains `Active` — settle handles terminal cleanup.

---

## USDC Variants

Each USDC instruction mirrors its SOL counterpart but uses SPL token transfers via associated token accounts instead of raw lamport transfers.

| Instruction | USDC-Specific Behavior |
|---|---|
| `initialize_game_usdc` | Creates escrow ATA; transfers USDC from `player_one_ata` to `escrow_ata` |
| `join_game_usdc` | Transfers USDC from `player_two_ata` to `escrow_ata` |
| `settle_game_usdc` | Transfers USDC from `escrow_ata` to winner / players and `treasury_ata` |
| `cancel_match_usdc` | Refunds USDC from `escrow_ata` to `player_one_ata` |
| `claim_hint_usdc` | Transfers USDC from `player_ata` to `treasury_ata` (80%) and `escrow_ata` (20%) |
| `resign_game_usdc` | Opponent receives USDC prize from `escrow_ata` |

> The USDC mint used is a devnet mock mint. The backend faucet endpoint (`POST /api/faucet`) distributes 100 mock USDC per wallet per 24-hour window for testing.

---

## Security Model

### Escrow Safety

The escrow PDA is derived from `["escrow", game.pubkey]`. Its signing authority belongs exclusively to the program — no external keypair can sign as the escrow. The only instructions that move lamports out of escrow are the six settlement variants (`settle`, `cancel`, `resign` × SOL and USDC).

All six require strict account constraints — correct `player_one`, `player_two`, and `treasury` addresses — and the correct PDA bump stored in `game.escrow_bump`.

### Treasury Hardcoding

The treasury wallet address is a compile-time constant:

```rust
pub const TREASURY_PUBKEY: Pubkey = pubkey!("CPoofbZho4bJmSAyVJxfeMK9CoZpXpDYftctghwUJX86");
```

Every fee-paying instruction enforces:

```rust
constraint = treasury.key() == TREASURY_PUBKEY @ MindDuelError::Unauthorized
```

A caller cannot supply a different address to redirect platform fees.

### Replay Attack Prevention

`committed_hash` is cleared to `[0u8; 32]` at the very start of `reveal_answer` — before any board mutation or turn switch. This means:

1. Submitting the same `(answer_index, nonce)` pair on a subsequent turn fails because that turn's commit will have a different hash.
2. Calling `reveal_answer` twice for the same commit fails because the first call zeros the hash, causing the second call to fail the `NoCommitFound` constraint.

### Turn Enforcement

Both `commit_answer` and `reveal_answer` check `game.current_turn == player.key()`. This prevents:
- A player from committing on their opponent's turn.
- A player from placing two consecutive pieces by committing and revealing before the opponent acts.

### Early Settlement Prevention

```rust
require!(
    winner.is_some() || board_full || timed_out,
    MindDuelError::GameStillActive
);
```

Without this guard, a losing player could call `settle_game` on a live board and claim half the pot via the draw split.

### One Active Game Per Wallet

The `GameAccount` PDA is seeded with `player_one.pubkey`. Since `init` fails if the account already exists, a wallet can be `player_one` of only one game at a time. The frontend uses `hasOpenGame()` to surface a recovery flow rather than letting users encounter confusing transaction simulation errors.

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| 6000 | `InvalidGameState` | Game is not in the expected state for this instruction |
| 6001 | `NotYourTurn` | It is not this player's turn |
| 6002 | `HashMismatch` | The provided answer hash does not match the committed hash |
| 6003 | `InvalidCellIndex` | Cell index is out of bounds for the current board size |
| 6004 | `CellOccupied` | This cell is already occupied |
| 6005 | `NoCommitFound` | A commit must be made before revealing |
| 6006 | `CommitAlreadyExists` | A commit already exists for this turn |
| 6007 | `TurnNotTimedOut` | Turn has not yet reached the timeout threshold |
| 6008 | `InsufficientFunds` | Insufficient SOL for the selected hint |
| 6009 | `HintAlreadyUsed` | This hint type has already been used this game |
| 6010 | `StakeTooLow` | Stake amount is below the minimum (0.01 SOL) |
| 6011 | `GameAlreadyFull` | Player two has already joined this game |
| 6012 | `GameStillActive` | Cannot settle a game that is still in progress |
| 6013 | `Unauthorized` | Signer is not a participant or required authority |
| 6014 | `Overflow` | Arithmetic overflow in fee or distribution calculation |

---

## On-Chain Events

The program emits Anchor events that clients subscribe to via `program.addEventListener`:

| Event | Fields | Emitted By |
|---|---|---|
| `GameCreated` | `game, player_one, stake_amount, mode` | `initialize_game` |
| `AnswerRevealed` | `game, player, cell_index, correct` | `reveal_answer` |
| `GameSettled` | `game, winner_mark (Option<bool>), pot, fee` | `settle_game` |

`winner_mark` values: `Some(true)` = X won, `Some(false)` = O won, `None` = draw.

---

## Constants Reference

```rust
PLATFORM_FEE_BPS             = 250        // 2.5%
BPS_DENOMINATOR              = 10_000
HINT_TREASURY_BPS            = 8_000      // 80%
HINT_PRIZE_BPS               = 2_000      // 20%
TURN_TIMEOUT_SECS            = 86_400     // 24 hours
BLITZ_TIMEOUT_SECS           = 300        // 5 minutes
EPIC_DRAMA_THRESHOLD         = 80

HINT_ELIMINATE_TWO_LAMPORTS  = 2_000_000  // 0.002 SOL
HINT_CATEGORY_LAMPORTS       = 1_000_000  // 0.001 SOL
HINT_EXTRA_TIME_LAMPORTS     = 3_000_000  // 0.003 SOL
HINT_FIRST_LETTER_LAMPORTS   = 1_000_000  // 0.001 SOL
HINT_SKIP_LAMPORTS           = 5_000_000  // 0.005 SOL

GAME_SEED    = b"game"
HINT_SEED    = b"hint"
ESCROW_SEED  = b"escrow"
```
