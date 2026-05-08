use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{Currency, GameAccount, GameStatus};

/// USDC variant of cancel_match — refund the full pot of USDC tokens
/// to player_one and close the GameAccount.
#[derive(Accounts)]
pub struct CancelMatchUsdc<'info> {
    #[account(mut)]
    pub player_one: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [GAME_SEED, player_one.key().as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::WaitingForPlayer @ MindDuelError::InvalidGameState,
        constraint = game.currency == Currency::MockUsdc @ MindDuelError::InvalidGameState,
        constraint = game.player_one == player_one.key() @ MindDuelError::Unauthorized,
        close = player_one,
    )]
    pub game: Account<'info, GameAccount>,

    /// CHECK: escrow PDA — authority of escrow_ata
    #[account(
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump = game.escrow_bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = player_one,
    )]
    pub player_one_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelMatchUsdc>) -> Result<()> {
    let game_key = ctx.accounts.game.key();
    let escrow_bump = ctx.accounts.game.escrow_bump;
    let pot = ctx.accounts.game.pot_lamports;

    let seeds = &[ESCROW_SEED, game_key.as_ref(), &[escrow_bump]];
    let signer = &[&seeds[..]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.escrow_ata.to_account_info(),
                to: ctx.accounts.player_one_ata.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer,
        ),
        pot,
    )?;

    emit!(MatchCancelledUsdc { game: game_key, refunded: pot });
    Ok(())
}

#[event]
pub struct MatchCancelledUsdc {
    pub game: Pubkey,
    pub refunded: u64,
}
