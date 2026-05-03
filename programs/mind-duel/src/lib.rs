use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod mind_duel {
    use super::*;

    pub fn initialize_game(
        ctx: Context<InitializeGame>,
        stake_amount: u64,
        mode: GameMode,
    ) -> Result<()> {
        instructions::initialize_game::handler(ctx, stake_amount, mode)
    }

    pub fn commit_answer(
        ctx: Context<CommitAnswer>,
        answer_hash: [u8; 32],
        cell_index: u8,
    ) -> Result<()> {
        instructions::commit_answer::handler(ctx, answer_hash, cell_index)
    }

    pub fn reveal_answer(
        ctx: Context<RevealAnswer>,
        answer_index: u8,
        nonce: [u8; 32],
    ) -> Result<()> {
        instructions::reveal_answer::handler(ctx, answer_index, nonce)
    }

    pub fn claim_hint(ctx: Context<ClaimHint>, hint_type: HintType) -> Result<()> {
        instructions::claim_hint::handler(ctx, hint_type)
    }

    pub fn settle_game(ctx: Context<SettleGame>) -> Result<()> {
        instructions::settle_game::handler(ctx)
    }

    pub fn timeout_turn(ctx: Context<TimeoutTurn>) -> Result<()> {
        instructions::timeout_turn::handler(ctx)
    }
}

// ─── Re-exported types ────────────────────────────────────────────
pub use state::game::{GameAccount, GameMode, GameStatus, CellState};
pub use state::hint_ledger::HintType;
