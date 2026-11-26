use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::{Contract, MilestoneStatus};
use crate::constants::{
    CONTRACT_SEED, VAULT_SEED, MIN_ESCROW_LAMPORTS, MAX_ESCROW_LAMPORTS,
    MIN_MILESTONE_PAYOUT_LAMPORTS, MAX_MILESTONE_PAYOUT_LAMPORTS,
    MIN_ESCROW_USDC, MAX_ESCROW_USDC, MIN_MILESTONE_PAYOUT_USDC, MAX_MILESTONE_PAYOUT_USDC,
};
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

    /// CHECK: Optional token mint (e.g. devnet USDC). If None, contract uses native SOL.
    pub token_mint: Option<UncheckedAccount<'info>>,

    /// CHECK: Optional client token account. Required if token_mint is Some.
    #[account(mut)]
    pub client_token_account: Option<UncheckedAccount<'info>>,

    /// CHECK: Optional vault token account. Required if token_mint is Some.
    #[account(mut)]
    pub vault_token_account: Option<UncheckedAccount<'info>>,

    /// CHECK: Optional SPL token program.
    pub token_program: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateContract>,
    _contract_id: u64,
    amount: u64,
    milestone_count: u8,
    milestone_descriptions: Vec<String>,
    token_mint: Option<Pubkey>,
) -> Result<()> {
    require!(
        ctx.accounts.client.key() != ctx.accounts.freelancer.key(),
        CapstoneError::SelfContractNotAllowed
    );
    require!(milestone_count > 0, CapstoneError::InvalidMilestoneCount);
    require!(milestone_count <= 10, CapstoneError::MilestoneOutOfRange);

    require!(
        milestone_descriptions.len() == milestone_count as usize,
        CapstoneError::MilestoneDescriptionsMismatch
    );
    for desc in &milestone_descriptions {
        let trimmed = desc.trim();
        require!(!trimmed.is_empty(), CapstoneError::MilestoneDescriptionEmpty);
        require!(trimmed.len() <= 100, CapstoneError::MilestoneDescriptionTooLong);
    }

    let base_payout = amount / (milestone_count as u64);

    if token_mint.is_none() {
        require!(amount >= MIN_ESCROW_LAMPORTS, CapstoneError::EscrowTooSmall);
        require!(amount <= MAX_ESCROW_LAMPORTS, CapstoneError::EscrowTooLarge);
        require!(base_payout >= MIN_MILESTONE_PAYOUT_LAMPORTS, CapstoneError::MilestonePayoutTooSmall);
        require!(base_payout <= MAX_MILESTONE_PAYOUT_LAMPORTS, CapstoneError::MilestonePayoutTooLarge);
    } else {
        require!(amount >= MIN_ESCROW_USDC, CapstoneError::EscrowTooSmall);
        require!(amount <= MAX_ESCROW_USDC, CapstoneError::EscrowTooLarge);
        require!(base_payout >= MIN_MILESTONE_PAYOUT_USDC, CapstoneError::MilestonePayoutTooSmall);
        require!(base_payout <= MAX_MILESTONE_PAYOUT_USDC, CapstoneError::MilestonePayoutTooLarge);
    }

    let contract = &mut ctx.accounts.contract;
    contract.client = ctx.accounts.client.key();
    contract.freelancer = ctx.accounts.freelancer.key();
    contract.token_mint = token_mint;
    contract.amount = amount;
    contract.milestone_count = milestone_count;
    contract.base_payout = base_payout;
    contract.remainder = amount % (milestone_count as u64);

    let mut milestones = Vec::new();
    let mut submissions = Vec::new();
    let mut reasons = Vec::new();
    let mut dispute_resolutions = Vec::new();
    for _ in 0..milestone_count {
        milestones.push(MilestoneStatus::NotSubmitted);
        submissions.push(String::new());
        reasons.push(String::new());
        dispute_resolutions.push(None);
    }
    contract.milestones = milestones;
    contract.milestone_descriptions = milestone_descriptions;
    contract.submissions = submissions;
    contract.rejection_reasons = reasons;
    contract.dispute_resolutions = dispute_resolutions;

    if let Some(mint_key) = token_mint {
        let client_ta = ctx.accounts.client_token_account.as_ref()
            .ok_or(CapstoneError::TokenAccountRequired)?;
        let vault_ta = ctx.accounts.vault_token_account.as_ref()
            .ok_or(CapstoneError::TokenAccountRequired)?;
        let token_program = ctx.accounts.token_program.as_ref()
            .ok_or(CapstoneError::TokenAccountRequired)?;

        // Rent-exempt reserve for vault PDA (system account)
        let rent_exempt_reserve = Rent::get()?.minimum_balance(0);
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.client.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        transfer(cpi_ctx, rent_exempt_reserve)?;

        // Transfer tokens from client ATA to vault ATA using transfer_checked
        let ix = spl_token_2022::instruction::transfer_checked(
            token_program.key,
            client_ta.key,
            &mint_key,
            vault_ta.key,
            ctx.accounts.client.key,
            &[],
            amount,
            6, // Devnet USDC uses 6 decimals
        ).map_err(|_| CapstoneError::BadgeSetupFailed)?;

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                client_ta.to_account_info(),
                ctx.accounts.token_mint.as_ref().unwrap().to_account_info(),
                vault_ta.to_account_info(),
                ctx.accounts.client.to_account_info(),
            ],
        )?;
    } else {
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
    }

    Ok(())
}
