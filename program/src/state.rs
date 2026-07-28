use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MilestoneStatus {
    NotSubmitted,
    Submitted,
    Approved,
    Rejected,
    Disputed,
}

#[account]
#[derive(InitSpace)]
pub struct FreelancerProfile {
    pub freelancer: Pubkey,
    #[max_len(50)]
    pub display_name: String,
}

#[account]
#[derive(InitSpace)]
pub struct ReputationRecord {
    pub completed_count: u32,
    pub disputed_count: u32,
}

#[account]
#[derive(InitSpace)]
pub struct Contract {
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub amount: u64,
    pub milestone_count: u8,
    pub base_payout: u64,
    pub remainder: u64,
    #[max_len(10)] // Supports up to 10 milestones max
    pub milestones: Vec<MilestoneStatus>,
    #[max_len(10, 200)] // Array of rejection reasons per milestone index
    pub rejection_reasons: Vec<String>,
}
