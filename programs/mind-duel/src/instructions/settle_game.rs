use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{GameAccount, GameStatus, CellState};

const WIN_LINES: [[usize; 3]; 8] = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];

#[derive(Accounts)]
pub struct SettleGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, game.player_one.as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::Active @ MindDuelError::GameStillActive,
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
    let game = &mut ctx.accounts.game;
    let board = &game.board;

    let winner = determine_winner(board);
    let pot = game.pot_lamports;
    let fee = pot.checked_mul(PLATFORM_FEE_BPS).ok_or(MindDuelError::Overflow)?
        .checked_div(BPS_DENOMINATOR).ok_or(MindDuelError::Overflow)?;
    let prize = pot.checked_sub(fee).ok_or(MindDuelError::Overflow)?;

    let seeds = &[ESCROW_SEED, ctx.accounts.game.to_account_info().key.as_ref(), &[game.escrow_bump]];
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

    match winner {
        Some(mark) => {
            let recipient = if mark == CellState::X {
                ctx.accounts.player_one.to_account_info()
            } else {
                ctx.accounts.player_two.to_account_info()
            };
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: recipient,
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

    game.status = GameStatus::Finished;

    emit!(GameSettled {
        game: ctx.accounts.game.key(),
        winner_mark: winner.map(|m| m == CellState::X),
        pot,
        fee,
    });

    Ok(())
}

fn determine_winner(board: &[CellState; 9]) -> Option<CellState> {
    for &[a, b, c] in &WIN_LINES {
        if board[a] != CellState::Empty && board[a] == board[b] && board[b] == board[c] {
            return Some(board[a]);
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
