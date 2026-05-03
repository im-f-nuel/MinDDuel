use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{GameAccount, GameStatus, GameMode};

#[derive(Accounts)]
pub struct TimeoutTurn<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [GAME_SEED, game.player_one.as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameState,
    )]
    pub game: Account<'info, GameAccount>,
}

pub fn handler(ctx: Context<TimeoutTurn>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;

    let timeout = if game.mode == GameMode::Blitz {
        BLITZ_TIMEOUT_SECS
    } else {
        TURN_TIMEOUT_SECS
    };

    require!(
        clock.unix_timestamp >= game.last_action_ts + timeout,
        MindDuelError::TurnNotTimedOut
    );

    // Switch turns and clear any pending commit
    game.current_turn = if game.current_turn == game.player_one {
        game.player_two
    } else {
        game.player_one
    };
    game.committed_hash = [0u8; 32];
    game.last_action_ts = clock.unix_timestamp;

    Ok(())
}
