use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod state;
pub mod instructions;
pub mod badge;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("E68AQePth8MVtn2aHax23c6BWye8Mnw2fkDzCyTfqNEk");

#[program]
pub mod trust_ledger {
    use super::*;

    pub fn create_profile(ctx: Context<CreateProfile>, display_name: String) -> Result<()> {
        create_profile::handler(ctx, display_name)
    }

    pub fn create_contract(
        ctx: Context<CreateContract>,
        contract_id: u64,
        amount: u64,
        milestone_count: u8,
    ) -> Result<()> {
        create_contract::handler(ctx, contract_id, amount, milestone_count)
    }

    pub fn submit_milestone(ctx: Context<SubmitMilestone>, index: u8) -> Result<()> {
        submit_milestone::handler(ctx, index)
    }

    pub fn approve_milestone(ctx: Context<ApproveMilestone>, index: u8) -> Result<()> {
        approve_milestone::handler(ctx, index)
    }

    pub fn reject_milestone(
        ctx: Context<RejectMilestone>,
        index: u8,
        reason: String,
    ) -> Result<()> {
        reject_milestone::handler(ctx, index, reason)
    }

    pub fn raise_dispute(ctx: Context<RaiseDispute>, index: u8) -> Result<()> {
        raise_dispute::handler(ctx, index)
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        index: u8,
        resolution: DisputeResolution,
    ) -> Result<()> {
        resolve_dispute::handler(ctx, index, resolution)
    }

    pub fn initialize_config(ctx: Context<InitializeConfig>, fee_basis_points: u16) -> Result<()> {
        initialize_config::handler(ctx, fee_basis_points)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_fee_basis_points: Option<u16>,
        new_admin: Option<Pubkey>,
    ) -> Result<()> {
        update_config::handler(ctx, new_fee_basis_points, new_admin)
    }
}

