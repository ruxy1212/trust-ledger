use anchor_lang::prelude::*;
use crate::state::FreelancerProfile;
use crate::constants::PROFILE_SEED;
use crate::errors::CapstoneError;

#[derive(Accounts)]
#[instruction(display_name: String)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = freelancer,
        space = 8 + FreelancerProfile::INIT_SPACE,
        seeds = [PROFILE_SEED, freelancer.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, FreelancerProfile>,
    #[account(mut)]
    pub freelancer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateProfile>, display_name: String) -> Result<()> {
    require!(display_name.len() <= 50, CapstoneError::NameTooLong);
    let profile = &mut ctx.accounts.profile;
    profile.freelancer = ctx.accounts.freelancer.key();
    profile.display_name = display_name;
    Ok(())
}
