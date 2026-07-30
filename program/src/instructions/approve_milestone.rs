use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::badge::mint_badge;
use crate::state::{Contract, MilestoneStatus, ReputationRecord};
use crate::constants::{VAULT_SEED, REPUTATION_SEED, BADGE_SEED};
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

    /// CHECK: PDA badge mint, seeded on the freelancer's own wallet. On a
    /// freelancer's first-ever approved milestone this account does not
    /// exist yet and is created + initialized by hand inside the handler
    /// (see `crate::badge::mint_badge`) — Anchor's `init` constraint can't
    /// express a Token-2022 mint with the NonTransferable extension. On
    /// every later approval (for this freelancer, across any contract) the
    /// account already exists and this instruction leaves it untouched.
    #[account(
        mut,
        seeds = [BADGE_SEED, freelancer.key().as_ref()],
        bump
    )]
    pub badge_mint: UncheckedAccount<'info>,

    /// CHECK: the freelancer's associated token account for `badge_mint`.
    /// Verified against the real ATA derivation below rather than trusted
    /// blindly, since it's the client's wallet supplying this account.
    #[account(
        mut,
        constraint = badge_token_account.key() == spl_associated_token_account::get_associated_token_address_with_program_id(
            &freelancer.key(),
            &badge_mint.key(),
            &spl_token_2022::ID,
        ) @ CapstoneError::InvalidBadgeTokenAccount
    )]
    pub badge_token_account: UncheckedAccount<'info>,

    /// CHECK: must be the Token-2022 program; enforced by the address constraint.
    #[account(address = spl_token_2022::ID)]
    pub token_program: UncheckedAccount<'info>,

    /// CHECK: must be the SPL Associated Token Account program; enforced by the address constraint.
    #[account(address = spl_associated_token_account::ID)]
    pub associated_token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ApproveMilestone>, index: u8) -> Result<()> {
    let contract = &mut ctx.accounts.contract;
    require!(index < contract.milestone_count, CapstoneError::MilestoneOutOfRange);

    let status = contract.milestones[index as usize];

    require!(status != MilestoneStatus::Disputed, CapstoneError::MilestoneDisputed);
    require!(status == MilestoneStatus::Submitted, CapstoneError::MilestoneNotSubmitted);

    contract.milestones[index as usize] = MilestoneStatus::Approved;

    let payout = if index == contract.milestone_count - 1 {
        contract.base_payout + contract.remainder
    } else {
        contract.base_payout
    };

    let contract_key = contract.key();
    let vault_bump = ctx.bumps.vault;
    let vault_signer_seeds: &[&[&[u8]]] = &[&[
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
    ).with_signer(vault_signer_seeds);
    transfer(cpi_ctx, payout)?;

    // Check BEFORE incrementing: this is that freelancer's first-ever
    // completed milestone iff their reputation count is still 0.
    let is_first_completion = ctx.accounts.reputation.completed_count == 0;

    let reputation = &mut ctx.accounts.reputation;
    reputation.completed_count += 1;

    // Mint the non-transferable badge exactly once, on the freelancer's
    // first-ever completion across any contract.
    if is_first_completion {
        let badge_bump = ctx.bumps.badge_mint;
        mint_badge(
            &ctx.accounts.freelancer.to_account_info(),
            &ctx.accounts.badge_mint.to_account_info(),
            &ctx.accounts.badge_token_account.to_account_info(),
            &ctx.accounts.client.to_account_info(),
            &ctx.accounts.token_program.to_account_info(),
            &ctx.accounts.associated_token_program.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            badge_bump,
        )?;
    }

    Ok(())
}
