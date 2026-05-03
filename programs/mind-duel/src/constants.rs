/// Platform fee in basis points (2.5%)
pub const PLATFORM_FEE_BPS: u64 = 250;

/// Denominator for basis points
pub const BPS_DENOMINATOR: u64 = 10_000;

/// Hint revenue: 80% to treasury, 20% to prize pool
pub const HINT_TREASURY_BPS: u64 = 8_000;
pub const HINT_PRIZE_BPS: u64 = 2_000;

/// Turn timeout in seconds (24 hours)
pub const TURN_TIMEOUT_SECS: i64 = 86_400;

/// Blitz mode timeout in seconds (5 minutes)
pub const BLITZ_TIMEOUT_SECS: i64 = 300;

/// Drama score threshold for Epic Game NFT
pub const EPIC_DRAMA_THRESHOLD: u8 = 80;

/// Hint prices in lamports
pub const HINT_ELIMINATE_TWO_LAMPORTS: u64 = 2_000_000;   // 0.002 SOL
pub const HINT_CATEGORY_LAMPORTS: u64 = 1_000_000;         // 0.001 SOL
pub const HINT_EXTRA_TIME_LAMPORTS: u64 = 3_000_000;       // 0.003 SOL
pub const HINT_FIRST_LETTER_LAMPORTS: u64 = 1_000_000;     // 0.001 SOL
pub const HINT_SKIP_LAMPORTS: u64 = 5_000_000;             // 0.005 SOL

/// PDA seeds
pub const GAME_SEED: &[u8] = b"game";
pub const HINT_SEED: &[u8] = b"hint";
pub const ESCROW_SEED: &[u8] = b"escrow";
