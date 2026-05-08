use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{Currency, GameAccount, GameStatus};

/// USDC variant of resign — opponent gets prize in USDC, fee to treasury,
/// GameAccount closed.
#[derive(Accounts)]
pub struct ResignGameUsdc<'info> {
    #[account(mut)]
    pub resigner: Signer<'info>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [GAME_SEED, game.player_one.as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameState,
        constraint = game.currency == Currency::MockUsdc @ MindDuelError::InvalidGameState,
        constraint = (resigner.key() == game.player_one || resigner.key() == game.player_two)
            @ MindDuelError::Unauthorized,
        close = player_one,
    )]
    pub game: Box<Account<'info, GameAccount>>,

    /// CHECK: escrow PDA
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
    pub escrow_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: player one wallet — receives close-rent on game account.
    #[account(mut, constraint = player_one.key() == game.player_one)]
    pub player_one: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = player_one,
    )]
    pub player_one_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: player two wallet
    #[account(constraint = player_two.key() == game.player_two)]
    pub player_two: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = player_two,
    )]
    pub player_two_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: treasury wallet
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ResignGameUsdc>) -> Result<()> {
    let game_key = ctx.accounts.game.key();
    let escrow_bump = ctx.accounts.game.escrow_bump;
    let pot = ctx.accounts.game.pot_lamports;

    let resigner_key = ctx.accounts.resigner.key();
    let winner_is_p1 = resigner_key != ctx.accounts.game.player_one;

    let fee = pot.checked_mul(PLATFORM_FEE_BPS).ok_or(MindDuelError::Overflow)?
        .checked_div(BPS_DENOMINATOR).ok_or(MindDuelError::Overflow)?;
    let prize = pot.checked_sub(fee).ok_or(MindDuelError::Overflow)?;

    let seeds = &[ESCROW_SEED, game_key.as_ref(), &[escrow_bump]];
    let signer = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.escrow_ata.to_account_info(),
                to: ctx.accounts.treasury_ata.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer,
        ),
        fee,
    )?;

    let winner_ata = if winner_is_p1 {
        ctx.accounts.player_one_ata.to_account_info()
    } else {
        ctx.accounts.player_two_ata.to_account_info()
    };

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.escrow_ata.to_account_info(),
                to: winner_ata,
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer,
        ),
        prize,
    )?;

    emit!(GameResignedUsdc {
        game: game_key,
        resigner: resigner_key,
        winner_is_x: winner_is_p1,
        pot,
        fee,
    });

    Ok(())
}

#[event]
pub struct GameResignedUsdc {
    pub game: Pubkey,
    pub resigner: Pubkey,
    pub winner_is_x: bool,
    pub pot: u64,
    pub fee: u64,
}
