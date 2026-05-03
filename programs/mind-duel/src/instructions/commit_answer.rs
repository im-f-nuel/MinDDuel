use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{GameAccount, GameStatus, CellState};

#[derive(Accounts)]
pub struct CommitAnswer<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [GAME_SEED, game.player_one.as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameState,
        constraint = game.current_turn == player.key() @ MindDuelError::NotYourTurn,
        constraint = game.committed_hash == [0u8; 32] @ MindDuelError::CommitAlreadyExists,
    )]
    pub game: Account<'info, GameAccount>,
}

pub fn handler(ctx: Context<CommitAnswer>, answer_hash: [u8; 32], cell_index: u8) -> Result<()> {
    let game = &mut ctx.accounts.game;

    require!((cell_index as usize) < (game.board_size as usize).pow(2), MindDuelError::InvalidCellIndex);
    require!(game.board[cell_index as usize] == CellState::Empty, MindDuelError::CellOccupied);

    game.committed_hash = answer_hash;
    game.committed_cell = cell_index;

    let clock = Clock::get()?;
    game.last_action_ts = clock.unix_timestamp;

    Ok(())
}
