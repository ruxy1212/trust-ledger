use anchor_lang::prelude::*;

#[error_code]
pub enum CapstoneError {
    #[msg("Wrong wallet signs an instruction that requires client or freelancer")]
    Unauthorized,
    #[msg("Milestone index doesn't exist on this contract")]
    MilestoneOutOfRange,
    #[msg("Milestone is not in the Submitted state")]
    MilestoneNotSubmitted,
    #[msg("Milestone is not in the Rejected state")]
    NotYetRejected,
    #[msg("Milestone is frozen in a Disputed state")]
    MilestoneDisputed,
    #[msg("Milestone count must be greater than zero")]
    InvalidMilestoneCount,
    #[msg("Freelancer display name is too long (max 50 chars)")]
    NameTooLong,
    #[msg("Rejection reason is too long (max 200 chars)")]
    ReasonTooLong,
    #[msg("The previous milestone must be approved before this one can be submitted")]
    PreviousMilestoneNotApproved,
    #[msg("badge_token_account is not the freelancer's associated token account for badge_mint")]
    InvalidBadgeTokenAccount,
    #[msg("Failed to construct a Token-2022 badge instruction")]
    BadgeSetupFailed,
    #[msg("A client cannot create a contract with themselves as the freelancer")]
    SelfContractNotAllowed,
    #[msg("Contract amount must be at least MIN_ESCROW_LAMPORTS")]
    EscrowTooSmall,
    #[msg("Base milestone payout must be at least MIN_MILESTONE_PAYOUT_LAMPORTS")]
    MilestonePayoutTooSmall,
    #[msg("Milestone must be in Submitted or Rejected state to raise a dispute")]
    MilestoneNotDisputable,
    #[msg("Milestone must be in Disputed state to be resolved")]
    MilestoneNotDisputed,
    #[msg("Dispute resolution requires matching agreement or unilateral concession")]
    DisputeResolutionMismatch,
}
