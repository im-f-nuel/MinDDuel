use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{GameAccount, GameMode, GameStatus, CellState};

#[derive(Accounts)]
pub struct RevealAnswer<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [GAME_SEED, game.player_one.as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameState,
        constraint = game.current_turn == player.key() @ MindDuelError::NotYourTurn,
        constraint = game.committed_hash != [0u8; 32] @ MindDuelError::NoCommitFound,
    )]
    pub game: Account<'info, GameAccount>,
}

pub fn handler(ctx: Context<RevealAnswer>, answer_index: u8, nonce: [u8; 32]) -> Result<()> {
    let game_key = ctx.accounts.game.key();
    let player_key = ctx.accounts.player.key();
    let now = Clock::get()?.unix_timestamp;
    let slot = Clock::get()?.slot;

    // ── Mode-specific timing enforcement ──────────────────────────────────
    //
    // Blitz: each turn must complete (commit → reveal) within BLITZ_TIMEOUT_SECS
    // counted from the previous action. Anyone exceeding the window forfeits
    // the turn — we record it as a "wrong answer" so the piece is not placed
    // and turn passes to the opponent. This is enforced on-chain so no
    // off-chain stalling is possible.
    let elapsed = now.saturating_sub(ctx.accounts.game.last_action_ts);
    let blitz_timeout = ctx.accounts.game.mode == GameMode::Blitz && elapsed > BLITZ_TIMEOUT_SECS;

    let game = &mut ctx.accounts.game;

    // Verify SHA-256([answer_index, ...nonce]) == committed_hash
    let mut preimage = [0u8; 33];
    preimage[0] = answer_index;
    preimage[1..].copy_from_slice(&nonce);
    let computed = hash::hash(&preimage).to_bytes();

    require!(computed == game.committed_hash, MindDuelError::HashMismatch);

    // Clear commit
    game.committed_hash = [0u8; 32];

    // Determine effective answer correctness:
    //   - answer_index == 255 → wrong answer (frontend convention)
    //   - blitz_timeout       → forced forfeit
    let correct = answer_index != 255 && !blitz_timeout;
    let cell = game.committed_cell;

    if correct {
        let mark = if game.current_turn == game.player_one {
            CellState::X
        } else {
            CellState::O
        };
        game.board[cell as usize] = mark;
    }

    // Track move counter — each successful place advances ScaleUp progress.
    // We re-use drama_score lower bits is risky; instead use round counter
    // which already increments per turn.

    // ── Mode-specific board mutations ────────────────────────────────────
    match game.mode {
        GameMode::ShiftingBoard => {
            // Every 3 rounds (after this turn), rotate the active board.
            // Direction & axis chosen from current slot hash for unbiased entropy.
            let r = game.round;
            let bs = game.board_size as usize;
            if r > 0 && (r + 1) % 3 == 0 {
                shift_board(&mut game.board, bs, slot);
            }
        }
        GameMode::ScaleUp => {
            // Grow the board after a correct answer — but only when the
            // active area is fully reached and we haven't hit the 5×5 cap.
            // Triggers: after round 4 → 4×4, after round 9 → 5×5.
            if correct {
                let current_size = game.board_size;
                let current_round = game.round;
                let new_size: Option<u8> = if current_round >= 9 && current_size < 5 {
                    Some(5)
                } else if current_round >= 4 && current_size < 4 {
                    Some(4)
                } else {
                    None
                };
                if let Some(size) = new_size {
                    grow_board(&mut game.board, current_size as usize, size as usize);
                    game.board_size = size;
                }
            }
        }
        _ => { /* Classic / Blitz: no board mutation */ }
    }

    // Switch turns
    game.current_turn = if game.current_turn == game.player_one {
        game.player_two
    } else {
        game.player_one
    };

    game.drama_score = game.drama_score.saturating_add(5).min(100);
    game.last_action_ts = now;
    game.round = game.round.saturating_add(1);

    emit!(AnswerRevealed {
        game: game_key,
        player: player_key,
        cell_index: cell,
        correct,
    });

    Ok(())
}

/// Rotate active rows down by 1 within the active size×size area.
/// Uses `entropy` to pick rotation direction (rows up vs down vs cols left/right).
fn shift_board(board: &mut [CellState; 25], size: usize, entropy: u64) {
    let mode = entropy % 4; // 0..3 → 4 distinct shifts
    let mut snapshot = [CellState::Empty; 25];
    for r in 0..size {
        for c in 0..size {
            snapshot[r * size + c] = board[r * size + c];
        }
    }
    for r in 0..size {
        for c in 0..size {
            let (sr, sc) = match mode {
                0 => ((r + size - 1) % size, c),       // shift rows down
                1 => ((r + 1) % size, c),              // shift rows up
                2 => (r, (c + size - 1) % size),       // shift cols right
                _ => (r, (c + 1) % size),              // shift cols left
            };
            board[r * size + c] = snapshot[sr * size + sc];
        }
    }
}

/// Re-anchor the existing size×size board into the top-left of a new size,
/// padding the new edges with Empty cells.
fn grow_board(board: &mut [CellState; 25], old_size: usize, new_size: usize) {
    if new_size <= old_size { return; }
    let mut snapshot = [CellState::Empty; 25];
    for r in 0..old_size {
        for c in 0..old_size {
            snapshot[r * old_size + c] = board[r * old_size + c];
        }
    }
    for cell in board.iter_mut() { *cell = CellState::Empty; }
    for r in 0..old_size {
        for c in 0..old_size {
            board[r * new_size + c] = snapshot[r * old_size + c];
        }
    }
}

#[event]
pub struct AnswerRevealed {
    pub game: Pubkey,
    pub player: Pubkey,
    pub cell_index: u8,
    pub correct: bool,
}
