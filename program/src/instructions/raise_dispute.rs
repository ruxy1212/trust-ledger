use anchor_lang::prelude::*;
use crate::state::{Contract, MilestoneStatus, ReputationRecord};
use crate::constants::REPUTATION_SEED;
use crate::errors::CapstoneError;

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(
        mut,
        has_one = client @ CapstoneError::Unauthorized,
        has_one = freelancer @ CapstoneError::Unauthorized,
    )]
    pub contract: Account<'info, Contract>,

    #[account(mut)]
    pub caller: Signer<'info>,

    /// CHECK: Client stored on the contract. Identity validated by has_one = client.
    pub client: SystemAccount<'info>,

    /// CHECK: Freelancer stored on the contract. Identity validated by has_one = freelancer.
    pub freelancer: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = caller,
        space = 8 + ReputationRecord::INIT_SPACE,
        seeds = [REPUTATION_SEED, freelancer.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, ReputationRecord>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RaiseDispute>, index: u8) -> Result<()> {
    let caller_key = ctx.accounts.caller.key();
    require!(
        caller_key == ctx.accounts.client.key() || caller_key == ctx.accounts.freelancer.key(),
        CapstoneError::Unauthorized
    );

    let contract = &mut ctx.accounts.contract;
    require!(index < contract.milestone_count, CapstoneError::MilestoneOutOfRange);

    let status = contract.milestones[index as usize];
    require!(
        status == MilestoneStatus::Submitted || status == MilestoneStatus::Rejected,
        CapstoneError::MilestoneNotDisputable
    );

    contract.milestones[index as usize] = MilestoneStatus::Disputed;
    contract.dispute_resolutions[index as usize] = None;

    // Increment reputation disputed count
    let reputation = &mut ctx.accounts.reputation;
    reputation.disputed_count += 1;

    Ok(())
}
