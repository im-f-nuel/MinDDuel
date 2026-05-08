use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{Currency, GameAccount, GameStatus};
use crate::state::hint_ledger::{HintLedger, HintType};

#[derive(Accounts)]
pub struct ClaimHintUsdc<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameState,
        constraint = game.currency == Currency::MockUsdc @ MindDuelError::InvalidGameState,
        constraint = game.current_turn == player.key() @ MindDuelError::NotYourTurn,
    )]
    pub game: Box<Account<'info, GameAccount>>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = player,
        space = HintLedger::LEN,
        seeds = [HINT_SEED, game.key().as_ref(), player.key().as_ref()],
        bump,
    )]
    pub hint_ledger: Box<Account<'info, HintLedger>>,

    /// Player's USDC ATA (source of payment)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = player,
    )]
    pub player_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: treasury wallet — receives 80% of hint fee
    pub treasury: UncheckedAccount<'info>,

    /// Treasury USDC ATA (created if missing so the first hint per treasury works)
    #[account(
        init_if_needed,
        payer = player,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: prize pool — the match's escrow PDA, receives 20% to boost the winner's pot
    #[account(
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump = game.escrow_bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    /// Escrow USDC ATA (prize pool destination)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimHintUsdc>, hint_type: HintType) -> Result<()> {
    let ledger = &mut ctx.accounts.hint_ledger;
    require!(!ledger.has_used(hint_type), MindDuelError::HintAlreadyUsed);

    let price = hint_type.price_usdc_base_units();
    let treasury_cut = price
        .checked_mul(HINT_TREASURY_BPS).ok_or(MindDuelError::Overflow)?
        .checked_div(BPS_DENOMINATOR).ok_or(MindDuelError::Overflow)?;
    let prize_cut = price.checked_sub(treasury_cut).ok_or(MindDuelError::Overflow)?;

    // Treasury cut: player → treasury_ata
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.player_ata.to_account_info(),
                to: ctx.accounts.treasury_ata.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        ),
        treasury_cut,
    )?;

    // Prize pool cut: player → escrow_ata (boosts the match pot)
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.player_ata.to_account_info(),
                to: ctx.accounts.escrow_ata.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        ),
        prize_cut,
    )?;

    // Boost the on-chain pot record so settle pays out the boosted amount.
    ctx.accounts.game.pot_lamports = ctx.accounts.game.pot_lamports
        .checked_add(prize_cut)
        .ok_or(MindDuelError::Overflow)?;

    ledger.mark_used(hint_type);

    emit!(HintClaimedUsdc {
        game: ctx.accounts.game.key(),
        player: ctx.accounts.player.key(),
        hint_type,
        price,
    });

    Ok(())
}

#[event]
pub struct HintClaimedUsdc {
    pub game: Pubkey,
    pub player: Pubkey,
    pub hint_type: HintType,
    pub price: u64,
}
