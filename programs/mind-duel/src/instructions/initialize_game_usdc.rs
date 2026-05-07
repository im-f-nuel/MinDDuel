use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};
use crate::constants::*;
use crate::errors::MindDuelError;
use crate::state::game::{Currency, GameAccount, GameMode, GameStatus};

#[derive(Accounts)]
pub struct InitializeGameUsdc<'info> {
    #[account(mut)]
    pub player_one: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = player_one,
        space = GameAccount::LEN,
        seeds = [GAME_SEED, player_one.key().as_ref()],
        bump,
    )]
    pub game: Account<'info, GameAccount>,

    /// CHECK: escrow PDA — authority over escrow_ata
    #[account(
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    /// Escrow USDC ATA, owned by escrow PDA
    #[account(
        init_if_needed,
        payer = player_one,
        associated_token::mint = usdc_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_ata: Account<'info, TokenAccount>,

    /// Player one USDC ATA (source)
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

pub fn handler(
    ctx: Context<InitializeGameUsdc>,
    stake_amount: u64,
    mode: GameMode,
) -> Result<()> {
    // min 1 USDC (6 decimals)
    require!(stake_amount >= 1_000_000, MindDuelError::StakeTooLow);
    require!(
        ctx.accounts.player_one_ata.amount >= stake_amount,
        MindDuelError::InsufficientFunds
    );

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
    game.currency = Currency::MockUsdc;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.player_one_ata.to_account_info(),
                to: ctx.accounts.escrow_ata.to_account_info(),
                authority: ctx.accounts.player_one.to_account_info(),
            },
        ),
        stake_amount,
    )?;

    game.pot_lamports = stake_amount;

    emit!(GameCreatedUsdc {
        game: ctx.accounts.game.key(),
        player_one: ctx.accounts.player_one.key(),
        stake_amount,
        mode,
    });

    Ok(())
}

#[event]
pub struct GameCreatedUsdc {
    pub game: Pubkey,
    pub player_one: Pubkey,
    pub stake_amount: u64,
    pub mode: GameMode,
}
