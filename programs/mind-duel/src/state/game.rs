use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct GameAccount {
    /// Player who created the game (mark: X)
    pub player_one: Pubkey,
    /// Player who joined the game (mark: O)
    pub player_two: Pubkey,
    /// Current game status
    pub status: GameStatus,
    /// Game mode
    pub mode: GameMode,
    /// Flat board — always 25 cells (max 5×5). board_size tells active area.
    pub board: [CellState; 25],
    /// Current board size (3 for 3×3, 4 for 4×4, etc.)
    pub board_size: u8,
    /// Whose turn it is
    pub current_turn: Pubkey,
    /// Lamports locked per player
    pub stake_per_player: u64,
    /// Total pot in escrow
    pub pot_lamports: u64,
    /// Committed answer hash for the current turn (zeroed when no commit)
    pub committed_hash: [u8; 32],
    /// Cell index the current player wants to place on
    pub committed_cell: u8,
    /// Unix timestamp of the last turn action
    pub last_action_ts: i64,
    /// Round counter (increments each time both players have had a turn)
    pub round: u8,
    /// Drama score 0–100
    pub drama_score: u8,
    /// Bump for the game PDA
    pub bump: u8,
    /// Bump for the escrow PDA
    pub escrow_bump: u8,
    /// Currency used for staking
    pub currency: Currency,
}

impl GameAccount {
    pub const LEN: usize = 8   // discriminator
        + 32  // player_one
        + 32  // player_two
        + 1   // status
        + 1   // mode
        + 25  // board (max 5×5)
        + 1   // board_size
        + 32  // current_turn
        + 8   // stake_per_player
        + 8   // pot_lamports
        + 32  // committed_hash
        + 1   // committed_cell
        + 8   // last_action_ts
        + 1   // round
        + 1   // drama_score
        + 1   // bump
        + 1   // escrow_bump
        + 1;  // currency
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum GameStatus {
    #[default]
    WaitingForPlayer,
    Active,
    Finished,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum GameMode {
    #[default]
    Classic,
    ShiftingBoard,
    ScaleUp,
    Blitz,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum CellState {
    #[default]
    Empty,
    X,
    O,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum Currency {
    #[default]
    Sol,
    MockUsdc,
}
