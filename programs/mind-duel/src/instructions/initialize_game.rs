use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{GameAccount, GameMode, GameStatus};

#[derive(Accounts)]
pub struct InitializeGame<'info> {
    #[account(mut)]
    pub player_one: Signer<'info>,

    #[account(
        init,
        payer = player_one,
        space = GameAccount::LEN,
        seeds = [GAME_SEED, player_one.key().as_ref()],
        bump,
    )]
    pub game: Account<'info, GameAccount>,

    /// CHECK: escrow PDA, holds lamport pot
    #[account(
        mut,
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeGame>, stake_amount: u64, mode: GameMode) -> Result<()> {
    require!(stake_amount >= 10_000_000, MindDuelError::StakeTooLow); // min 0.01 SOL

    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;

    game.player_one = ctx.accounts.player_one.key();
    game.status = GameStatus::WaitingForPlayer;
    game.mode = mode;
    game.board = Default::default();
    game.board_size = 3;
    game.current_turn = ctx.accounts.player_one.key();
    game.stake_per_player = stake_amount;
    game.last_action_ts = clock.unix_timestamp;
    game.bump = ctx.bumps.game;
    game.escrow_bump = ctx.bumps.escrow;

    // Transfer stake from player_one to escrow
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player_one.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        ),
        stake_amount,
    )?;

    game.pot_lamports = stake_amount;

    emit!(GameCreated {
        game: ctx.accounts.game.key(),
        player_one: ctx.accounts.player_one.key(),
        stake_amount,
        mode,
    });

    Ok(())
}

#[event]
pub struct GameCreated {
    pub game: Pubkey,
    pub player_one: Pubkey,
    pub stake_amount: u64,
    pub mode: GameMode,
}
