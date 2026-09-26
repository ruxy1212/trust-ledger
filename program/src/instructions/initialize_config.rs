use anchor_lang::prelude::*;
use crate::state::ProtocolConfig;
use crate::constants::{CONFIG_SEED, MAX_FEE_BASIS_POINTS};
use crate::errors::CapstoneError;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: The wallet designated to receive protocol fees
    pub fee_recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeConfig>, fee_basis_points: u16) -> Result<()> {
    require!(fee_basis_points <= MAX_FEE_BASIS_POINTS, CapstoneError::FeeTooHigh);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.fee_recipient = ctx.accounts.fee_recipient.key();
    config.fee_basis_points = fee_basis_points;
    config.bump = ctx.bumps.config;

    Ok(())
}
