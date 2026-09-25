use anchor_lang::prelude::*;
use crate::state::{Contract, MilestoneStatus};
use crate::errors::CapstoneError;

#[derive(Accounts)]
pub struct SubmitMilestone<'info> {
    #[account(
        mut,
        has_one = freelancer @ CapstoneError::Unauthorized,
    )]
    pub contract: Account<'info, Contract>,
    pub freelancer: Signer<'info>,
}

pub fn handler(ctx: Context<SubmitMilestone>, index: u8) -> Result<()> {
    let contract = &mut ctx.accounts.contract;
    require!(index < contract.milestone_count, CapstoneError::MilestoneOutOfRange);

    let status = contract.milestones[index as usize];

    // Frozen disputed milestones cannot be resubmitted
    require!(status != MilestoneStatus::Disputed, CapstoneError::MilestoneDisputed);
    // Valid start states: NotSubmitted (first time) or Rejected (after a rejection)
    require!(
        status == MilestoneStatus::NotSubmitted || status == MilestoneStatus::Rejected,
        CapstoneError::MilestoneNotSubmitted
    );

    // Milestones must be worked in order. Index 0 has no predecessor; every
    // other index requires the one before it to already be settled (Approved or Resolved)
    if index > 0 {
        let prev_status = contract.milestones[(index - 1) as usize];
        let is_prev_settled = prev_status == MilestoneStatus::Approved
            || prev_status == MilestoneStatus::ResolvedRelease
            || prev_status == MilestoneStatus::ResolvedRefund
            || prev_status == MilestoneStatus::ResolvedSplit;
        require!(
            is_prev_settled,
            CapstoneError::PreviousMilestoneNotApproved
        );
    }

    contract.milestones[index as usize] = MilestoneStatus::Submitted;
    Ok(())
}

