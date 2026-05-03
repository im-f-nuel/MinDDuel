use anchor_lang::prelude::*;

#[account]
pub struct HintLedger {
    pub game: Pubkey,
    pub player: Pubkey,
    pub used_hints: u8,
    pub bump: u8,
}

impl HintLedger {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 1;

    pub fn has_used(&self, hint: HintType) -> bool {
        self.used_hints & hint.bitmask() != 0
    }

    pub fn mark_used(&mut self, hint: HintType) {
        self.used_hints |= hint.bitmask();
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum HintType {
    EliminateTwo,
    CategoryReveal,
    ExtraTime,
    FirstLetter,
    Skip,
}

impl HintType {
    pub fn bitmask(self) -> u8 {
        match self {
            HintType::EliminateTwo  => 1 << 0,
            HintType::CategoryReveal => 1 << 1,
            HintType::ExtraTime     => 1 << 2,
            HintType::FirstLetter   => 1 << 3,
            HintType::Skip          => 1 << 4,
        }
    }

    pub fn price_lamports(self) -> u64 {
        use crate::constants::*;
        match self {
            HintType::EliminateTwo  => HINT_ELIMINATE_TWO_LAMPORTS,
            HintType::CategoryReveal => HINT_CATEGORY_LAMPORTS,
            HintType::ExtraTime     => HINT_EXTRA_TIME_LAMPORTS,
            HintType::FirstLetter   => HINT_FIRST_LETTER_LAMPORTS,
            HintType::Skip          => HINT_SKIP_LAMPORTS,
        }
    }
}
