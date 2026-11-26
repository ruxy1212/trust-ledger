import { PublicKey, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const DEVNET_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

export const USDC_DECIMALS = 6;
export const SOL_DECIMALS = 9;

export function usdcToUnits(usdc: number | string): number {
  return Math.round(Number(usdc) * 10 ** USDC_DECIMALS);
}

export function unitsToUsdc(units: number | string): number {
  return Number(units) / 10 ** USDC_DECIMALS;
}

/**
 * Derives Associated Token Account address for any mint and owner.
 * Allows off-curve PDAs (such as vault PDAs) when allowOwnerOffCurve = true.
 */
export function getAta(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = true
): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

/**
 * Creates idempotent ATA creation instruction if account does not exist.
 */
export function createIdempotentAtaInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey
) {
  return createAssociatedTokenAccountIdempotentInstruction(
    payer,
    ata,
    owner,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}
