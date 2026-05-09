use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{CellState, Currency, GameAccount, GameStatus};

#[derive(Accounts)]
pub struct SettleGameUsdc<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, game.player_one.as_ref()],
        bump = game.bump,
        constraint = game.status == GameStatus::Active @ MindDuelError::InvalidGameState,
        constraint = game.currency == Currency::MockUsdc @ MindDuelError::InvalidGameState,
        close = player_one,
    )]
    pub game: Account<'info, GameAccount>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    /// CHECK: escrow PDA — signer for token transfers
    #[account(
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump = game.escrow_bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    /// Escrow USDC ATA (source of all payouts)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: player one wallet — receives GameAccount rent on close
    #[account(mut, constraint = player_one.key() == game.player_one)]
    pub player_one: UncheckedAccount<'info>,

    /// Player one USDC ATA (destination)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = player_one,
    )]
    pub player_one_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: player two wallet
    #[account(constraint = player_two.key() == game.player_two)]
    pub player_two: UncheckedAccount<'info>,

    /// Player two USDC ATA (destination)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = player_two,
    )]
    pub player_two_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: treasury wallet — must be the hardcoded platform wallet
    #[account(constraint = treasury.key() == TREASURY_PUBKEY @ MindDuelError::Unauthorized)]
    pub treasury: UncheckedAccount<'info>,

    /// Treasury USDC ATA (fee destination)
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

pub fn handler(ctx: Context<SettleGameUsdc>) -> Result<()> {
    let game_key = ctx.accounts.game.key();
    let board_size = ctx.accounts.game.board_size as usize;
    let escrow_bump = ctx.accounts.game.escrow_bump;
    let winner = determine_winner(&ctx.accounts.game.board, board_size);
    let pot = ctx.accounts.game.pot_lamports;
    let is_x_winner = winner.map(|m| m == CellState::X);

    // Same completion check as settle_game (SOL): require winner OR full board OR timeout.
    let board_full = ctx.accounts.game.board[..board_size * board_size]
        .iter()
        .all(|c| *c != CellState::Empty);
    let now = Clock::get()?.unix_timestamp;
    let timed_out = now.saturating_sub(ctx.accounts.game.last_action_ts) >= TURN_TIMEOUT_SECS;
    require!(
        winner.is_some() || board_full || timed_out,
        MindDuelError::GameStillActive
    );

    let fee = pot.checked_mul(PLATFORM_FEE_BPS).ok_or(MindDuelError::Overflow)?
        .checked_div(BPS_DENOMINATOR).ok_or(MindDuelError::Overflow)?;
    let prize = pot.checked_sub(fee).ok_or(MindDuelError::Overflow)?;

    let seeds = &[ESCROW_SEED, game_key.as_ref(), &[escrow_bump]];
    let signer = &[&seeds[..]];

    // Fee to treasury ATA
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

    match is_x_winner {
        Some(true) => {
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
                prize,
            )?;
        }
        Some(false) => {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    SplTransfer {
                        from: ctx.accounts.escrow_ata.to_account_info(),
                        to: ctx.accounts.player_two_ata.to_account_info(),
                        authority: ctx.accounts.escrow.to_account_info(),
                    },
                    signer,
                ),
                prize,
            )?;
        }
        None => {
            // Draw: 50/50
            let half = prize.checked_div(2).ok_or(MindDuelError::Overflow)?;
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
                half,
            )?;
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    SplTransfer {
                        from: ctx.accounts.escrow_ata.to_account_info(),
                        to: ctx.accounts.player_two_ata.to_account_info(),
                        authority: ctx.accounts.escrow.to_account_info(),
                    },
                    signer,
                ),
                half,
            )?;
        }
    }

    ctx.accounts.game.status = GameStatus::Finished;

    emit!(GameSettledUsdc {
        game: game_key,
        winner_mark: is_x_winner,
        pot,
        fee,
    });

    Ok(())
}

fn determine_winner(board: &[CellState; 25], size: usize) -> Option<CellState> {
    for r in 0..size {
        for c in 0..size.saturating_sub(2) {
            let a = r * size + c;
            if board[a] != CellState::Empty && board[a] == board[a + 1] && board[a + 1] == board[a + 2] {
                return Some(board[a]);
            }
        }
    }
    for c in 0..size {
        for r in 0..size.saturating_sub(2) {
            let a = r * size + c;
            let b = (r + 1) * size + c;
            let ci = (r + 2) * size + c;
            if board[a] != CellState::Empty && board[a] == board[b] && board[b] == board[ci] {
                return Some(board[a]);
            }
        }
    }
    for r in 0..size.saturating_sub(2) {
        for c in 0..size.saturating_sub(2) {
            let a = r * size + c;
            let b = (r + 1) * size + c + 1;
            let ci = (r + 2) * size + c + 2;
            if board[a] != CellState::Empty && board[a] == board[b] && board[b] == board[ci] {
                return Some(board[a]);
            }
        }
    }
    for r in 0..size.saturating_sub(2) {
        for c in 2..size {
            let a = r * size + c;
            let b = (r + 1) * size + c - 1;
            let ci = (r + 2) * size + c - 2;
            if board[a] != CellState::Empty && board[a] == board[b] && board[b] == board[ci] {
                return Some(board[a]);
            }
        }
    }
    None
}

#[event]
pub struct GameSettledUsdc {
    pub game: Pubkey,
    pub winner_mark: Option<bool>,
    pub pot: u64,
    pub fee: u64,
}
