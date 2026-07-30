use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use anchor_lang::solana_program::system_instruction;
use spl_token_2022::{
    extension::ExtensionType,
    instruction::{
        initialize_mint2,
        initialize_non_transferable_mint, // <--- Imported directly from instruction
        mint_to,
        set_authority,
        AuthorityType,
    },
    state::Mint as Token2022Mint,
    ID as TOKEN_2022_PROGRAM_ID,
};

use crate::constants::BADGE_SEED;
use crate::errors::CapstoneError;

/// Creates the freelancer's one-of-one "verified builder" badge — a
/// Token-2022 mint with the `NonTransferable` extension — and mints the
/// single unit into their associated token account.
///
/// This is NOT expressed as an Anchor `init` account constraint because the
/// `NonTransferable` extension has to be written into the mint's account
/// data *before* `InitializeMint` runs, which needs a raw
/// `create_account` + two ordered CPIs that Anchor's declarative `mint::`
/// constraints don't cover for this extension. So `badge_mint` is declared
/// as a plain seeded `UncheckedAccount` in `ApproveMilestone`, and this
/// function does the setup by hand, once.
///
/// Callers must only invoke this when `badge_mint` does not already exist
/// (in practice: gated on `reputation.completed_count == 0`, read *before*
/// it's incremented). It is not safe to call a second time for the same
/// freelancer — `create_account` below will simply fail with "already in
/// use" if it is, which is a safe failure mode but not a graceful one, so
/// the caller-side gate is what actually protects this in normal operation.
pub fn mint_badge<'info>(
    freelancer: &AccountInfo<'info>,
    badge_mint: &AccountInfo<'info>,
    badge_token_account: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    associated_token_program: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    badge_bump: u8,
) -> Result<()> {
    let freelancer_key = freelancer.key();
    let signer_seeds: &[&[&[u8]]] = &[&[BADGE_SEED, freelancer_key.as_ref(), &[badge_bump]]];

    // 1. Allocate the mint account at its full size (base mint + the
    //    NonTransferable extension's TLV entry), owned by Token-2022.
    let space = ExtensionType::try_calculate_account_len::<Token2022Mint>(&[
        ExtensionType::NonTransferable,
    ])
    .map_err(|_| error!(CapstoneError::BadgeSetupFailed))?;
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            badge_mint.key,
            lamports,
            space as u64,
            &TOKEN_2022_PROGRAM_ID,
        ),
        &[payer.clone(), badge_mint.clone(), system_program.clone()],
        signer_seeds,
    )?;

    // 2. Extension data must be written before the base mint is initialized.
    invoke(
        &initialize_non_transferable_mint(&TOKEN_2022_PROGRAM_ID, badge_mint.key)
            .map_err(|_| error!(CapstoneError::BadgeSetupFailed))?,
        &[badge_mint.clone()],
    )?;

    // 3. Initialize the base mint: 0 decimals (whole badges only), mint
    //    authority is the mint PDA itself (so this function can sign the
    //    mint_to below with its own seeds), no freeze authority.
    invoke(
        &initialize_mint2(&TOKEN_2022_PROGRAM_ID, badge_mint.key, badge_mint.key, None, 0)
            .map_err(|_| error!(CapstoneError::BadgeSetupFailed))?,
        &[badge_mint.clone()],
    )?;

    // 4. Create the freelancer's associated token account for this mint.
    invoke(
        &spl_associated_token_account::instruction::create_associated_token_account(
            payer.key,
            freelancer.key,
            badge_mint.key,
            &TOKEN_2022_PROGRAM_ID,
        ),
        &[
            payer.clone(),
            badge_token_account.clone(),
            freelancer.clone(),
            badge_mint.clone(),
            system_program.clone(),
            token_program.clone(),
            associated_token_program.clone(),
        ],
    )?;

    // 5. Mint the single badge token, signed by the mint PDA as its own
    //    mint authority.
    invoke_signed(
        &mint_to(
            &TOKEN_2022_PROGRAM_ID,
            badge_mint.key,
            badge_token_account.key,
            badge_mint.key,
            &[],
            1,
        )
        .map_err(|_| error!(CapstoneError::BadgeSetupFailed))?,
        &[
            badge_mint.clone(),
            badge_token_account.clone(),
            badge_mint.clone(),
        ],
        signer_seeds,
    )?;

    // 6. Permanently retire the mint authority so supply can never exceed 1 —
    //    belt-and-suspenders alongside the caller-side "only call once" gate.
    invoke_signed(
        &set_authority(
            &TOKEN_2022_PROGRAM_ID,
            badge_mint.key,
            None,
            AuthorityType::MintTokens,
            badge_mint.key,
            &[],
        )
        .map_err(|_| error!(CapstoneError::BadgeSetupFailed))?,
        &[badge_mint.clone(), badge_mint.clone()],
        signer_seeds,
    )?;

    Ok(())
}
