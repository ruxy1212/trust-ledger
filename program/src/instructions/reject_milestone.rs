use anchor_lang::prelude::*;
use crate::state::{Contract, MilestoneStatus};
use crate::errors::CapstoneError;

#[derive(Accounts)]
pub struct RejectMilestone<'info> {
    #[account(
        mut,
        has_one = client @ CapstoneError::Unauthorized,
    )]
    pub contract: Account<'info, Contract>,
    pub client: Signer<'info>,
}

pub fn handler(ctx: Context<RejectMilestone>, index: u8, reason: String) -> Result<()> {
    require!(reason.len() <= 200, CapstoneError::ReasonTooLong);

    let contract = &mut ctx.accounts.contract;
    require!(index < contract.milestone_count, CapstoneError::MilestoneOutOfRange);

    let status = contract.milestones[index as usize];

    // Frozen disputed milestones cannot be rejected
    require!(status != MilestoneStatus::Disputed, CapstoneError::MilestoneDisputed);
    require!(status == MilestoneStatus::Submitted, CapstoneError::MilestoneNotSubmitted);

    contract.milestones[index as usize] = MilestoneStatus::Rejected;
    contract.rejection_reasons[index as usize] = reason;

    Ok(())
}

