use anchor_lang::prelude::*;
use crate::state::ProtocolConfig;
use crate::constants::{CONFIG_SEED, MAX_FEE_BASIS_POINTS};
use crate::errors::CapstoneError;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ CapstoneError::Unauthorized,
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub admin: Signer<'info>,

    /// CHECK: Optional new fee recipient account
    pub new_fee_recipient: Option<UncheckedAccount<'info>>,
}

pub fn handler(
    ctx: Context<UpdateConfig>,
    new_fee_basis_points: Option<u16>,
    new_admin: Option<Pubkey>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(new_bps) = new_fee_basis_points {
        require!(new_bps <= MAX_FEE_BASIS_POINTS, CapstoneError::FeeTooHigh);
        config.fee_basis_points = new_bps;
    }

    if let Some(new_recipient) = &ctx.accounts.new_fee_recipient {
        config.fee_recipient = new_recipient.key();
    }

    if let Some(admin_key) = new_admin {
        config.admin = admin_key;
    }

    Ok(())
}
