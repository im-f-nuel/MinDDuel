use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{Currency, GameAccount, GameStatus};

#[derive(Accounts)]
pub struct JoinGameUsdc<'info> {
    #[account(mut)]
    pub player_two: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [GAME_SEED, game.player_one.as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::WaitingForPlayer @ MindDuelError::GameAlreadyFull,
        constraint = game.player_one != player_two.key() @ MindDuelError::Unauthorized,
        constraint = game.currency == Currency::MockUsdc @ MindDuelError::InvalidGameState,
    )]
    pub game: Account<'info, GameAccount>,

    /// CHECK: escrow PDA — authority over escrow_ata
    #[account(
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump = game.escrow_bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    /// Escrow USDC ATA (already created by initializeGameUsdc)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_ata: Account<'info, TokenAccount>,

    /// Player two USDC ATA (source)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = player_two,
    )]
    pub player_two_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinGameUsdc>) -> Result<()> {
    let stake = ctx.accounts.game.stake_per_player;

    require!(
        ctx.accounts.player_two_ata.amount >= stake,
        MindDuelError::InsufficientFunds
    );

    let player_two_key = ctx.accounts.player_two.key();
    let game_key = ctx.accounts.game.key();

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.player_two_ata.to_account_info(),
                to: ctx.accounts.escrow_ata.to_account_info(),
                authority: ctx.accounts.player_two.to_account_info(),
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
    emit!(PlayerJoinedUsdc {
        game: game_key,
        player_two: player_two_key,
        pot_amount: pot,
    });

    Ok(())
}

#[event]
pub struct PlayerJoinedUsdc {
    pub game: Pubkey,
    pub player_two: Pubkey,
    pub pot_amount: u64,
}
