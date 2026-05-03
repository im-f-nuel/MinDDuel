use anchor_lang::prelude::*;

#[error_code]
pub enum MindDuelError {
    #[msg("Game is not in the expected state for this instruction")]
    InvalidGameState,

    #[msg("It is not this player's turn")]
    NotYourTurn,

    #[msg("The provided answer hash does not match the committed hash")]
    HashMismatch,

    #[msg("Cell index is out of bounds for the current board size")]
    InvalidCellIndex,

    #[msg("This cell is already occupied")]
    CellOccupied,

    #[msg("A commit must be made before revealing")]
    NoCommitFound,

    #[msg("A commit already exists for this turn")]
    CommitAlreadyExists,

    #[msg("Turn has not yet timed out")]
    TurnNotTimedOut,

    #[msg("Insufficient SOL for the selected hint")]
    InsufficientFunds,

    #[msg("This hint type has already been used in this game")]
    HintAlreadyUsed,

    #[msg("Stake amount is below the minimum allowed")]
    StakeTooLow,

    #[msg("Player two has already joined this game")]
    GameAlreadyFull,

    #[msg("Cannot settle a game that is still active")]
    GameStillActive,

    #[msg("Unauthorized: signer is not a participant in this game")]
    Unauthorized,

    #[msg("Arithmetic overflow")]
    Overflow,
}
