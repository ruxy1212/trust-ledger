pub const PROFILE_SEED: &[u8] = b"profile";
pub const CONTRACT_SEED: &[u8] = b"contract";
pub const VAULT_SEED: &[u8] = b"vault";
pub const REPUTATION_SEED: &[u8] = b"reputation";
pub const BADGE_SEED: &[u8] = b"badge";

pub const MIN_ESCROW_LAMPORTS: u64 = 10_000_000; // 0.01 SOL minimum contract escrow
pub const MAX_ESCROW_LAMPORTS: u64 = 100_000_000_000; // 100 SOL maximum contract escrow (anti-fraud ceiling)
pub const MIN_MILESTONE_PAYOUT_LAMPORTS: u64 = 2_000_000; // 0.002 SOL minimum payout floor per milestone
pub const MAX_MILESTONE_PAYOUT_LAMPORTS: u64 = 100_000_000_000; // 100 SOL maximum payout ceiling per milestone

pub const MIN_ESCROW_USDC: u64 = 1_000_000; // 1 USDC minimum (6 decimals)
pub const MAX_ESCROW_USDC: u64 = 50_000_000_000; // 50,000 USDC maximum (6 decimals)
pub const MIN_MILESTONE_PAYOUT_USDC: u64 = 200_000; // 0.2 USDC minimum payout floor
pub const MAX_MILESTONE_PAYOUT_USDC: u64 = 50_000_000_000; // 50,000 USDC maximum payout floor

pub const DEVNET_USDC_MINT: &str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

pub const CONFIG_SEED: &[u8] = b"config";
pub const MAX_FEE_BASIS_POINTS: u16 = 1000; // 10% maximum protocol fee (1000 bps)

