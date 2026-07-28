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

    contract.milestones[index as usize] = MilestoneStatus::Submitted;
    Ok(())
}

