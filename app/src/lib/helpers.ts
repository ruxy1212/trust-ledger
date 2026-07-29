import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: BN | number): number {
  const n = BN.isBN(lamports) ? Number(lamports.toString()) : lamports;
  return n / LAMPORTS_PER_SOL;
}

export function solToLamportsBN(sol: number): BN {
  // round to the nearest lamport before going through BN, since floats
  // like 1.5 * LAMPORTS_PER_SOL can land a hair off an integer.
  return new BN(Math.round(sol * LAMPORTS_PER_SOL));
}

export function shortAddress(address: string | PublicKey, chars = 4): string {
  const s = typeof address === "string" ? address : address.toBase58();
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

export type MilestoneStatusName =
  | "notSubmitted"
  | "submitted"
  | "approved"
  | "rejected"
  | "disputed";

/**
 * Anchor decodes a Rust enum variant as `{ variantName: {} }`.
 * This pulls out just the variant name.
 */
export function milestoneStatusName(status: unknown): MilestoneStatusName {
  return Object.keys(status as object)[0] as MilestoneStatusName;
}

export const STATUS_LABEL: Record<MilestoneStatusName, string> = {
  notSubmitted: "Not submitted",
  submitted: "Submitted — awaiting review",
  approved: "Approved — paid out",
  rejected: "Rejected",
  disputed: "Disputed — frozen",
};