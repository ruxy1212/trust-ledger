use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::badge::mint_badge;
use crate::state::{Contract, MilestoneStatus, DisputeResolution, ReputationRecord, ProtocolConfig};
use crate::constants::{VAULT_SEED, REPUTATION_SEED, BADGE_SEED};
use crate::errors::CapstoneError;

#[derive(Accounts)]
#[instruction(index: u8, resolution: DisputeResolution)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        has_one = client @ CapstoneError::Unauthorized,
        has_one = freelancer @ CapstoneError::Unauthorized,
    )]
    pub contract: Account<'info, Contract>,

    #[account(
        mut,
        seeds = [VAULT_SEED, contract.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(mut)]
    pub client: SystemAccount<'info>,

    #[account(mut)]
    pub freelancer: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = caller,
        space = 8 + ReputationRecord::INIT_SPACE,
        seeds = [REPUTATION_SEED, freelancer.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, ReputationRecord>,

    /// CHECK: PDA badge mint, seeded on the freelancer's wallet.
    #[account(
        mut,
        seeds = [BADGE_SEED, freelancer.key().as_ref()],
        bump
    )]
    pub badge_mint: UncheckedAccount<'info>,

    /// CHECK: the freelancer's associated token account for badge_mint.
    #[account(
        mut,
        constraint = badge_token_account.key() == spl_associated_token_account::get_associated_token_address_with_program_id(
            &freelancer.key(),
            &badge_mint.key(),
            &spl_token_2022::ID,
        ) @ CapstoneError::InvalidBadgeTokenAccount
    )]
    pub badge_token_account: UncheckedAccount<'info>,

    /// CHECK: must be the Token-2022 program.
    #[account(address = spl_token_2022::ID)]
    pub token_program: UncheckedAccount<'info>,

    /// CHECK: must be the SPL Associated Token Account program.
    #[account(address = spl_associated_token_account::ID)]
    pub associated_token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// Optional protocol fee configuration account
    pub config: Option<Account<'info, ProtocolConfig>>,

    /// CHECK: Optional protocol fee recipient account
    #[account(mut)]
    pub fee_recipient: Option<UncheckedAccount<'info>>,
}

pub fn handler(ctx: Context<ResolveDispute>, index: u8, resolution: DisputeResolution) -> Result<()> {
    let caller_key = ctx.accounts.caller.key();
    require!(
        caller_key == ctx.accounts.client.key() || caller_key == ctx.accounts.freelancer.key(),
        CapstoneError::Unauthorized
    );

    let contract = &mut ctx.accounts.contract;
    require!(index < contract.milestone_count, CapstoneError::MilestoneOutOfRange);

    let status = contract.milestones[index as usize];
    require!(status == MilestoneStatus::Disputed, CapstoneError::MilestoneNotDisputed);

    // Unilateral concession rules:
    // - Client can unilaterally release to freelancer.
    // - Freelancer can unilaterally refund to client.
    // - Split (or non-conceding proposals) requires matching agreement from both parties.
    let is_client_release = caller_key == ctx.accounts.client.key() && resolution == DisputeResolution::ReleaseToFreelancer;
    let is_freelancer_refund = caller_key == ctx.accounts.freelancer.key() && resolution == DisputeResolution::RefundToClient;

    let should_execute = if is_client_release || is_freelancer_refund {
        true
    } else if contract.dispute_resolutions[index as usize] == Some(resolution) {
        // Both parties agreed on this resolution
        true
    } else {
        // Record proposal and wait for other party
        contract.dispute_resolutions[index as usize] = Some(resolution);
        false
    };

    if !should_execute {
        return Ok(());
    }

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

    match resolution {
        DisputeResolution::ReleaseToFreelancer => {
            let (freelancer_payout, fee_payout) = if let Some(config) = &ctx.accounts.config {
                if config.fee_basis_points > 0 {
                    let fee = payout.saturating_mul(config.fee_basis_points as u64) / 10_000;
                    let recipient = ctx.accounts.fee_recipient.as_ref()
                        .ok_or(CapstoneError::FeeRecipientRequired)?;
                    require_keys_eq!(recipient.key(), config.fee_recipient, CapstoneError::InvalidFeeRecipient);
                    (payout.saturating_sub(fee), fee)
                } else {
                    (payout, 0)
                }
            } else {
                (payout, 0)
            };

            let cpi_ctx = CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.freelancer.to_account_info(),
                },
            ).with_signer(vault_signer_seeds);
            transfer(cpi_ctx, freelancer_payout)?;

            if fee_payout > 0 {
                let recipient = ctx.accounts.fee_recipient.as_ref().unwrap();
                let fee_cpi = CpiContext::new(
                    ctx.accounts.system_program.key(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: recipient.to_account_info(),
                    },
                ).with_signer(vault_signer_seeds);
                transfer(fee_cpi, fee_payout)?;
            }

            contract.milestones[index as usize] = MilestoneStatus::ResolvedRelease;
            contract.dispute_resolutions[index as usize] = None;

            let is_first_completion = ctx.accounts.reputation.completed_count == 0;
            let reputation = &mut ctx.accounts.reputation;
            reputation.completed_count += 1;
            reputation.earned_volume = reputation.earned_volume.saturating_add(payout);
            let volume_bonus = payout / 100_000;
            reputation.reputation_score = reputation.reputation_score.saturating_add(100 + volume_bonus);

            if is_first_completion {
                let badge_bump = ctx.bumps.badge_mint;
                mint_badge(
                    &ctx.accounts.freelancer.to_account_info(),
                    &ctx.accounts.badge_mint.to_account_info(),
                    &ctx.accounts.badge_token_account.to_account_info(),
                    &ctx.accounts.caller.to_account_info(),
                    &ctx.accounts.token_program.to_account_info(),
                    &ctx.accounts.associated_token_program.to_account_info(),
                    &ctx.accounts.system_program.to_account_info(),
                    badge_bump,
                )?;
            }
        }
        DisputeResolution::RefundToClient => {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.client.to_account_info(),
                },
            ).with_signer(vault_signer_seeds);
            transfer(cpi_ctx, payout)?;

            contract.milestones[index as usize] = MilestoneStatus::ResolvedRefund;
            contract.dispute_resolutions[index as usize] = None;
        }
        DisputeResolution::Split => {
            let half = payout / 2;
            let remainder = payout % 2;
            let raw_freelancer_share = half;
            let client_share = half + remainder;

            let (freelancer_share, fee_payout) = if let Some(config) = &ctx.accounts.config {
                if config.fee_basis_points > 0 {
                    let fee = raw_freelancer_share.saturating_mul(config.fee_basis_points as u64) / 10_000;
                    let recipient = ctx.accounts.fee_recipient.as_ref()
                        .ok_or(CapstoneError::FeeRecipientRequired)?;
                    require_keys_eq!(recipient.key(), config.fee_recipient, CapstoneError::InvalidFeeRecipient);
                    (raw_freelancer_share.saturating_sub(fee), fee)
                } else {
                    (raw_freelancer_share, 0)
                }
            } else {
                (raw_freelancer_share, 0)
            };

            if freelancer_share > 0 {
                let cpi_freelancer = CpiContext::new(
                    ctx.accounts.system_program.key(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.freelancer.to_account_info(),
                    },
                ).with_signer(vault_signer_seeds);
                transfer(cpi_freelancer, freelancer_share)?;
            }

            if fee_payout > 0 {
                let recipient = ctx.accounts.fee_recipient.as_ref().unwrap();
                let fee_cpi = CpiContext::new(
                    ctx.accounts.system_program.key(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: recipient.to_account_info(),
                    },
                ).with_signer(vault_signer_seeds);
                transfer(fee_cpi, fee_payout)?;
            }

            if client_share > 0 {
                let cpi_client = CpiContext::new(
                    ctx.accounts.system_program.key(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.client.to_account_info(),
                    },
                ).with_signer(vault_signer_seeds);
                transfer(cpi_client, client_share)?;
            }

            contract.milestones[index as usize] = MilestoneStatus::ResolvedSplit;
            contract.dispute_resolutions[index as usize] = None;

            let is_first_completion = ctx.accounts.reputation.completed_count == 0;
            let reputation = &mut ctx.accounts.reputation;
            reputation.completed_count += 1;
            reputation.earned_volume = reputation.earned_volume.saturating_add(raw_freelancer_share);
            let volume_bonus = raw_freelancer_share / 100_000;
            reputation.reputation_score = reputation.reputation_score.saturating_add(50 + volume_bonus);

            if is_first_completion {
                let badge_bump = ctx.bumps.badge_mint;
                mint_badge(
                    &ctx.accounts.freelancer.to_account_info(),
                    &ctx.accounts.badge_mint.to_account_info(),
                    &ctx.accounts.badge_token_account.to_account_info(),
                    &ctx.accounts.caller.to_account_info(),
                    &ctx.accounts.token_program.to_account_info(),
                    &ctx.accounts.associated_token_program.to_account_info(),
                    &ctx.accounts.system_program.to_account_info(),
                    badge_bump,
                )?;
            }
        }
    }

    Ok(())
}
