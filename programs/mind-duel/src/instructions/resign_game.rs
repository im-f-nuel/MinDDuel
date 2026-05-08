use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{Currency, GameAccount, GameStatus};

/// Resign a SOL match. The signer concedes; the OPPONENT receives the prize
/// (pot − platform fee). Closes the GameAccount so the wallet can be
/// re-used. The signer must be one of the two players.
#[derive(Accounts)]
pub struct ResignGame<'info> {
    #[account(mut)]
    pub resigner: Signer<'info>,

    #[account(
        mut,
        seeds = [GAME_SEED, game.player_one.as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameState,
        constraint = game.currency == Currency::Sol @ MindDuelError::InvalidGameState,
        constraint = (resigner.key() == game.player_one || resigner.key() == game.player_two)
            @ MindDuelError::Unauthorized,
        // Rent goes to player_one regardless of who resigned — that's the
        // wallet that paid for the account on init.
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

    /// CHECK: player one wallet — receives prize if player_two resigned, also
    /// receives the GameAccount rent on close.
    #[account(mut, constraint = player_one.key() == game.player_one)]
    pub player_one: UncheckedAccount<'info>,

    /// CHECK: player two wallet — receives prize if player_one resigned.
    #[account(mut, constraint = player_two.key() == game.player_two)]
    pub player_two: UncheckedAccount<'info>,

    /// CHECK: treasury for platform fee
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ResignGame>) -> Result<()> {
    let game_key = ctx.accounts.game.key();
    let escrow_bump = ctx.accounts.game.escrow_bump;
    let pot = ctx.accounts.game.pot_lamports;

    let resigner_key = ctx.accounts.resigner.key();
    let p1 = ctx.accounts.game.player_one;
    let winner_is_p1 = resigner_key != p1; // if resigner != p1, then p1 wins

    let fee = pot.checked_mul(PLATFORM_FEE_BPS).ok_or(MindDuelError::Overflow)?
        .checked_div(BPS_DENOMINATOR).ok_or(MindDuelError::Overflow)?;
    let prize = pot.checked_sub(fee).ok_or(MindDuelError::Overflow)?;

    let seeds = &[ESCROW_SEED, game_key.as_ref(), &[escrow_bump]];
    let signer = &[&seeds[..]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
            signer,
        ),
        fee,
    )?;

    let winner_account = if winner_is_p1 {
        ctx.accounts.player_one.to_account_info()
    } else {
        ctx.accounts.player_two.to_account_info()
    };

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: winner_account,
            },
            signer,
        ),
        prize,
    )?;

    emit!(GameResigned {
        game: game_key,
        resigner: resigner_key,
        winner_is_x: winner_is_p1,
        pot,
        fee,
    });

    Ok(())
}

#[event]
pub struct GameResigned {
    pub game: Pubkey,
    pub resigner: Pubkey,
    pub winner_is_x: bool,
    pub pot: u64,
    pub fee: u64,
}
