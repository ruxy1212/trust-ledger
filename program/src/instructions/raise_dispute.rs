use anchor_lang::prelude::*;
use crate::state::{Contract, MilestoneStatus, ReputationRecord};
use crate::constants::REPUTATION_SEED;
use crate::errors::CapstoneError;

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(
        mut,
        has_one = freelancer @ CapstoneError::Unauthorized,
    )]
    pub contract: Account<'info, Contract>,
    pub freelancer: Signer<'info>,

    #[account(
        init_if_needed,
        payer = freelancer,
        space = 8 + ReputationRecord::INIT_SPACE,
        seeds = [REPUTATION_SEED, freelancer.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, ReputationRecord>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RaiseDispute>, index: u8) -> Result<()> {
    let contract = &mut ctx.accounts.contract;
    require!(index < contract.milestone_count, CapstoneError::MilestoneOutOfRange);

    let status = contract.milestones[index as usize];
    require!(status == MilestoneStatus::Rejected, CapstoneError::NotYetRejected);

    contract.milestones[index as usize] = MilestoneStatus::Disputed;

    // Increment reputation disputed count
    let reputation = &mut ctx.accounts.reputation;
    reputation.disputed_count += 1;

    Ok(())
}
