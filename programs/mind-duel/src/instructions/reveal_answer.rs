use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{GameAccount, GameStatus, CellState};

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
    let game = &mut ctx.accounts.game;

    // Verify SHA-256([answer_index, ...nonce]) == committed_hash
    let mut preimage = [0u8; 33];
    preimage[0] = answer_index;
    preimage[1..].copy_from_slice(&nonce);
    let computed = hash::hash(&preimage).to_bytes();

    require!(computed == game.committed_hash, MindDuelError::HashMismatch);

    // Clear commit
    game.committed_hash = [0u8; 32];

    // answer_index == 255 signals wrong answer — no piece placed
    let cell = game.committed_cell;
    if answer_index != 255 {
        let mark = if game.current_turn == game.player_one {
            CellState::X
        } else {
            CellState::O
        };
        game.board[cell as usize] = mark;
    }

    // Switch turns
    game.current_turn = if game.current_turn == game.player_one {
        game.player_two
    } else {
        game.player_one
    };

    game.drama_score = game.drama_score.saturating_add(5).min(100);

    let clock = Clock::get()?;
    game.last_action_ts = clock.unix_timestamp;
    game.round = game.round.saturating_add(1);

    let correct = answer_index != 255;
    emit!(AnswerRevealed {
        game: game_key,
        player: player_key,
        cell_index: cell,
        correct,
    });

    Ok(())
}

#[event]
pub struct AnswerRevealed {
    pub game: Pubkey,
    pub player: Pubkey,
    pub cell_index: u8,
    pub correct: bool,
}
