use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{Currency, GameAccount, GameStatus};

/// Cancel a SOL match that's still in `WaitingForPlayer` (no opponent has
/// joined). Refunds the full escrow back to player_one and closes the
/// GameAccount PDA, freeing the wallet to create a new match.
///
/// Only callable by player_one. There is no fee — the match never started,
/// so no platform value was created.
#[derive(Accounts)]
pub struct CancelMatch<'info> {
    #[account(mut)]
    pub player_one: Signer<'info>,

    #[account(
        mut,
        seeds = [GAME_SEED, player_one.key().as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::WaitingForPlayer @ MindDuelError::InvalidGameState,
        constraint = game.currency == Currency::Sol @ MindDuelError::InvalidGameState,
        constraint = game.player_one == player_one.key() @ MindDuelError::Unauthorized,
        close = player_one,
    )]
    pub game: Account<'info, GameAccount>,

    /// CHECK: escrow PDA
    #[account(
        mut,
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump = game.escrow_bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelMatch>) -> Result<()> {
    let game_key = ctx.accounts.game.key();
    let escrow_bump = ctx.accounts.game.escrow_bump;
    let pot = ctx.accounts.game.pot_lamports;

    // Refund full pot to player_one — no fee since the match never started.
    let seeds = &[ESCROW_SEED, game_key.as_ref(), &[escrow_bump]];
    let signer = &[&seeds[..]];
    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.player_one.to_account_info(),
            },
            signer,
        ),
        pot,
    )?;

    emit!(MatchCancelled { game: game_key, refunded: pot });
    Ok(())
}

#[event]
pub struct MatchCancelled {
    pub game: Pubkey,
    pub refunded: u64,
}
