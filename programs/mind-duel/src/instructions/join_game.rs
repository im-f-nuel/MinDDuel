use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{GameAccount, GameStatus};

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(mut)]
    pub player_two: Signer<'info>,

    #[account(
        mut,
        seeds = [GAME_SEED, game.player_one.as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::WaitingForPlayer @ MindDuelError::GameAlreadyFull,
        constraint = game.player_one != player_two.key() @ MindDuelError::Unauthorized,
    )]
    pub game: Account<'info, GameAccount>,

    /// CHECK: escrow PDA that holds the pot
    #[account(
        mut,
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump = game.escrow_bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinGame>) -> Result<()> {
    let stake = ctx.accounts.game.stake_per_player;
    let player_two_key = ctx.accounts.player_two.key();
    let game_key = ctx.accounts.game.key();

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player_two.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        ),
        stake,
    )?;

    let game = &mut ctx.accounts.game;
    game.player_two = player_two_key;
    game.pot_lamports = game.pot_lamports
        .checked_add(stake)
        .ok_or(MindDuelError::Overflow)?;
    game.status = GameStatus::Active;

    let clock = Clock::get()?;
    game.last_action_ts = clock.unix_timestamp;

    let pot = game.pot_lamports;
    emit!(PlayerJoined {
        game: game_key,
        player_two: player_two_key,
        pot_lamports: pot,
    });

    Ok(())
}

#[event]
pub struct PlayerJoined {
    pub game: Pubkey,
    pub player_two: Pubkey,
    pub pot_lamports: u64,
}
