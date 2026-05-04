use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{GameAccount, GameStatus, CellState};

#[derive(Accounts)]
pub struct SettleGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, game.player_one.as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameState,
    )]
    pub game: Account<'info, GameAccount>,

    /// CHECK: escrow PDA
    #[account(
        mut,
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump = game.escrow_bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    /// CHECK: player one wallet
    #[account(mut, constraint = player_one.key() == game.player_one)]
    pub player_one: UncheckedAccount<'info>,

    /// CHECK: player two wallet
    #[account(mut, constraint = player_two.key() == game.player_two)]
    pub player_two: UncheckedAccount<'info>,

    /// CHECK: treasury
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SettleGame>) -> Result<()> {
    // Capture everything from game before any borrows
    let game_key = ctx.accounts.game.key();
    let board_size = ctx.accounts.game.board_size as usize;
    let escrow_bump = ctx.accounts.game.escrow_bump;
    let winner = determine_winner(&ctx.accounts.game.board, board_size);
    let pot = ctx.accounts.game.pot_lamports;
    let is_x_winner = winner.map(|m| m == CellState::X);

    let fee = pot.checked_mul(PLATFORM_FEE_BPS).ok_or(MindDuelError::Overflow)?
        .checked_div(BPS_DENOMINATOR).ok_or(MindDuelError::Overflow)?;
    let prize = pot.checked_sub(fee).ok_or(MindDuelError::Overflow)?;

    let seeds = &[ESCROW_SEED, game_key.as_ref(), &[escrow_bump]];
    let signer = &[&seeds[..]];

    // Pay fee to treasury
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

    match is_x_winner {
        Some(true) => {
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.player_one.to_account_info(),
                    },
                    signer,
                ),
                prize,
            )?;
        }
        Some(false) => {
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.player_two.to_account_info(),
                    },
                    signer,
                ),
                prize,
            )?;
        }
        None => {
            // Draw: split 50/50
            let half = prize.checked_div(2).ok_or(MindDuelError::Overflow)?;
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.player_one.to_account_info(),
                    },
                    signer,
                ),
                half,
            )?;
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.player_two.to_account_info(),
                    },
                    signer,
                ),
                half,
            )?;
        }
    }

    // Mutable borrow only after all transfers are done
    ctx.accounts.game.status = GameStatus::Finished;

    emit!(GameSettled {
        game: game_key,
        winner_mark: is_x_winner,
        pot,
        fee,
    });

    Ok(())
}

/// Dynamic 3-in-a-row win detection for any board size (3×3, 4×4, 5×5).
fn determine_winner(board: &[CellState; 25], size: usize) -> Option<CellState> {
    // Check rows
    for r in 0..size {
        for c in 0..size.saturating_sub(2) {
            let a = r * size + c;
            let b = a + 1;
            let c_idx = a + 2;
            if board[a] != CellState::Empty && board[a] == board[b] && board[b] == board[c_idx] {
                return Some(board[a]);
            }
        }
    }
    // Check columns
    for c in 0..size {
        for r in 0..size.saturating_sub(2) {
            let a = r * size + c;
            let b = (r + 1) * size + c;
            let c_idx = (r + 2) * size + c;
            if board[a] != CellState::Empty && board[a] == board[b] && board[b] == board[c_idx] {
                return Some(board[a]);
            }
        }
    }
    // Check diagonals (top-left → bottom-right)
    for r in 0..size.saturating_sub(2) {
        for c in 0..size.saturating_sub(2) {
            let a = r * size + c;
            let b = (r + 1) * size + c + 1;
            let c_idx = (r + 2) * size + c + 2;
            if board[a] != CellState::Empty && board[a] == board[b] && board[b] == board[c_idx] {
                return Some(board[a]);
            }
        }
    }
    // Check diagonals (top-right → bottom-left)
    for r in 0..size.saturating_sub(2) {
        for c in 2..size {
            let a = r * size + c;
            let b = (r + 1) * size + c - 1;
            let c_idx = (r + 2) * size + c - 2;
            if board[a] != CellState::Empty && board[a] == board[b] && board[b] == board[c_idx] {
                return Some(board[a]);
            }
        }
    }
    None
}

#[event]
pub struct GameSettled {
    pub game: Pubkey,
    /// true = X won, false = O won, None = draw
    pub winner_mark: Option<bool>,
    pub pot: u64,
    pub fee: u64,
}
