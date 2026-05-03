use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{GameAccount, GameStatus};
use crate::state::hint_ledger::{HintLedger, HintType};

#[derive(Accounts)]
pub struct ClaimHint<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameState,
        constraint = game.current_turn == player.key() @ MindDuelError::NotYourTurn,
    )]
    pub game: Account<'info, GameAccount>,

    #[account(
        init_if_needed,
        payer = player,
        space = HintLedger::LEN,
        seeds = [HINT_SEED, game.key().as_ref(), player.key().as_ref()],
        bump,
    )]
    pub hint_ledger: Account<'info, HintLedger>,

    /// CHECK: treasury receives 80% of hint fee
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: prize pool receives 20% of hint fee
    #[account(mut)]
    pub prize_pool: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimHint>, hint_type: HintType) -> Result<()> {
    let ledger = &mut ctx.accounts.hint_ledger;
    require!(!ledger.has_used(hint_type), MindDuelError::HintAlreadyUsed);

    let price = hint_type.price_lamports();
    let treasury_cut = price
        .checked_mul(HINT_TREASURY_BPS).ok_or(MindDuelError::Overflow)?
        .checked_div(BPS_DENOMINATOR).ok_or(MindDuelError::Overflow)?;
    let prize_cut = price.checked_sub(treasury_cut).ok_or(MindDuelError::Overflow)?;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        treasury_cut,
    )?;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.prize_pool.to_account_info(),
            },
        ),
        prize_cut,
    )?;

    ledger.mark_used(hint_type);

    Ok(())
}
