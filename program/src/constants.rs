pub const PROFILE_SEED: &[u8] = b"profile";
pub const CONTRACT_SEED: &[u8] = b"contract";
pub const VAULT_SEED: &[u8] = b"vault";
pub const REPUTATION_SEED: &[u8] = b"reputation";
pub const BADGE_SEED: &[u8] = b"badge";

pub const MIN_ESCROW_LAMPORTS: u64 = 10_000_000; // 0.01 SOL minimum contract escrow
pub const MIN_MILESTONE_PAYOUT_LAMPORTS: u64 = 2_000_000; // 0.002 SOL minimum payout floor per milestone

pub const CONFIG_SEED: &[u8] = b"config";
pub const MAX_FEE_BASIS_POINTS: u16 = 1000; // 10% maximum protocol fee (1000 bps)

