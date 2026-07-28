use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::{Contract, MilestoneStatus, ReputationRecord};
use crate::constants::{VAULT_SEED, REPUTATION_SEED, BADGE_SEED};
use crate::errors::CapstoneError;

// Also import token interface for token extension minting
use anchor_spl::token_interface::{mint_to, MintTo, TokenInterface, Mint};
use anchor_spl::associated_token::AssociatedToken;

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

    /// CHECK: Recipient of the payout
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

    // Verification fields for conditional minting of Badge NFT
    // We'll mint to the freelancer's ATA.
    #[account(
        mut,
        seeds = [BADGE_SEED, freelancer.key().as_ref()],
        bump
    )]
    pub badge_mint: Option<InterfaceAccount<'info, Mint>>,

    /// CHECK: Checked by AssociatedToken program
    #[account(mut)]
    pub badge_token_account: Option<AccountInfo<'info>>,

    pub token_program: Option<Interface<'info, TokenInterface>>,
    pub associated_token_program: Option<Program<'info, AssociatedToken>>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ApproveMilestone>, index: u8) -> Result<()> {
    let contract = &mut ctx.accounts.contract;
    require!(index < contract.milestone_count, CapstoneError::MilestoneOutOfRange);

    let status = contract.milestones[index as usize];
    require!(status == MilestoneStatus::Submitted, CapstoneError::MilestoneNotSubmitted);

    contract.milestones[index as usize] = MilestoneStatus::Approved;

    // Calculate payout
    let mut payout = contract.base_payout;
    if index == contract.milestone_count - 1 {
        payout += contract.remainder;
    }

    // CPI transfer from vault to freelancer
    let contract_key = contract.key();
    let vault_bump = ctx.bumps.vault;
    let signer_seeds: &[&[&[u8]]] = &[&[
        VAULT_SEED,
        contract_key.as_ref(),
        &[vault_bump],
    ]];

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.freelancer.to_account_info(),
        },
    ).with_signer(signer_seeds);
    transfer(cpi_ctx, payout)?;

    // Increment reputation completed count
    let reputation = &mut ctx.accounts.reputation;
    reputation.completed_count += 1;

    // If this is their first completion, mint the non-transferable badge NFT if optional token parameters are provided
    if reputation.completed_count == 1 {
        if let (Some(mint), Some(ata), Some(token_prog)) = (
            &ctx.accounts.badge_mint,
            &ctx.accounts.badge_token_account,
            &ctx.accounts.token_program,
        ) {
            let freelancer_key = ctx.accounts.freelancer.key();
            let badge_bump = *ctx.bumps.get("badge_mint").unwrap();
            let badge_seeds: &[&[&[u8]]] = &[&[
                BADGE_SEED,
                freelancer_key.as_ref(),
                &[badge_bump],
            ]];

            let mint_cpi = CpiContext::new(
                token_prog.to_account_info(),
                MintTo {
                    mint: mint.to_account_info(),
                    to: ata.to_account_info(),
                    authority: mint.to_account_info(), // mint authority is the PDA itself
                },
            ).with_signer(badge_seeds);
            mint_to(mint_cpi, 1)?;
        }
    }

    Ok(())
}
