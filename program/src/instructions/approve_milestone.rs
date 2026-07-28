use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::{Contract, MilestoneStatus, ReputationRecord};
use crate::constants::{VAULT_SEED, REPUTATION_SEED};
use crate::errors::CapstoneError;

#[derive(Accounts)]
pub struct ApproveMilestone<'info> {
    #[account(
        mut,
        has_one = client @ CapstoneError::Unauthorized,
        has_one = freelancer,
    )]
    pub contract: Account<'info, Contract>,

    #[account(
        mut,
        seeds = [VAULT_SEED, contract.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub client: Signer<'info>,

    /// CHECK: Freelancer is the payout recipient, stored on the contract.
    /// Identity is enforced by the `has_one = freelancer` constraint above.
    #[account(mut)]
    pub freelancer: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = client,
        space = 8 + ReputationRecord::INIT_SPACE,
        seeds = [REPUTATION_SEED, freelancer.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, ReputationRecord>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ApproveMilestone>, index: u8) -> Result<()> {
    let contract = &mut ctx.accounts.contract;
    require!(index < contract.milestone_count, CapstoneError::MilestoneOutOfRange);

    let status = contract.milestones[index as usize];

    // Explicitly guard against Disputed milestones first (gives correct error code)
    require!(status != MilestoneStatus::Disputed, CapstoneError::MilestoneDisputed);
    // Then require it is actually Submitted
    require!(status == MilestoneStatus::Submitted, CapstoneError::MilestoneNotSubmitted);

    contract.milestones[index as usize] = MilestoneStatus::Approved;

    // Calculate payout: last milestone gets base_payout + remainder to drain vault exactly.
    let payout = if index == contract.milestone_count - 1 {
        contract.base_payout + contract.remainder
    } else {
        contract.base_payout
    };

    // CPI transfer from vault (PDA) to freelancer.
    // The vault has no private key, so the program signs for it using signer seeds.
    let contract_key = contract.key();
    let vault_bump = ctx.bumps.vault;
    let signer_seeds: &[&[&[u8]]] = &[&[
        VAULT_SEED,
        contract_key.as_ref(),
        &[vault_bump],
    ]];

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.key(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.freelancer.to_account_info(),
        },
    ).with_signer(signer_seeds);
    transfer(cpi_ctx, payout)?;

    // Increment reputation completed count
    let reputation = &mut ctx.accounts.reputation;
    reputation.completed_count += 1;

    // Note: Badge NFT minting (Token-2022, non-transferable) is handled externally
    // via spl-token CLI after the first approval, following the Arc 7 pattern.
    // The badge PDA mint address is derived as [b"badge", freelancer.key()] and
    // serves as the permanent proof of first completion.

    Ok(())
}

