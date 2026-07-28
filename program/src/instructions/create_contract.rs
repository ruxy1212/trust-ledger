use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::{Contract, MilestoneStatus};
use crate::constants::{CONTRACT_SEED, VAULT_SEED};
use crate::errors::CapstoneError;

#[derive(Accounts)]
#[instruction(contract_id: u64)]
pub struct CreateContract<'info> {
    #[account(
        init,
        payer = client,
        space = 8 + Contract::INIT_SPACE,
        seeds = [CONTRACT_SEED, client.key().as_ref(), freelancer.key().as_ref(), &contract_id.to_le_bytes()],
        bump
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
    /// CHECK: Freelancer account, does not sign here. Can be a bare wallet or have a profile.
    pub freelancer: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateContract>, _contract_id: u64, amount: u64, milestone_count: u8) -> Result<()> {
    require!(milestone_count > 0, CapstoneError::InvalidMilestoneCount);
    require!(milestone_count <= 10, CapstoneError::MilestoneOutOfRange);

    let contract = &mut ctx.accounts.contract;
    contract.client = ctx.accounts.client.key();
    contract.freelancer = ctx.accounts.freelancer.key();
    contract.amount = amount;
    contract.milestone_count = milestone_count;
    contract.base_payout = amount / (milestone_count as u64);
    contract.remainder = amount % (milestone_count as u64);

    let mut milestones = Vec::new();
    let mut reasons = Vec::new();
    for _ in 0..milestone_count {
        milestones.push(MilestoneStatus::NotSubmitted);
        reasons.push(String::new());
    }
    contract.milestones = milestones;
    contract.rejection_reasons = reasons;

    // The vault is a bare System-owned PDA (no account data of its own), so it needs
    // its own rent-exempt reserve independent of the escrowed `amount`. Without this,
    // a small `amount` (e.g. a few lamports) would leave the vault above zero but
    // below the rent-exempt floor after the transfer, which the runtime rejects
    // outright with "insufficient funds for rent".
    //
    // We fund the vault with `amount` (fully paid out across milestone approvals)
    // plus a fixed rent-exempt reserve that is never paid out and keeps the vault
    // account alive at exactly that reserve once every milestone has been approved.
    let rent_exempt_reserve = Rent::get()?.minimum_balance(0);

    // Move client's SOL into the vault: escrowed amount + permanent rent reserve.
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.key(),
        Transfer {
            from: ctx.accounts.client.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        },
    );
    transfer(cpi_ctx, amount + rent_exempt_reserve)?;

    Ok(())
}