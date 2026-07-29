import { Program } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import { freelancerProfiles, reputationRecords } from "../types/accounts";
import { deriveReputationPda } from "./pda";

export type FreelancerOption = {
  wallet: PublicKey;
  displayName: string;
  completedCount: number;
  disputedCount: number;
};

/**
 * Every freelancer who's opted in via create_profile, annotated with their
 * live reputation. A freelancer who has a profile but has never had a
 * milestone approved won't have a ReputationRecord account yet — that's
 * normal (it's created on first approval, init_if_needed), and just means
 * 0/0 here, not an error.
 */
export async function fetchFreelancerOptions(
  program: Program<any>
): Promise<FreelancerOption[]> {
  const profiles = await freelancerProfiles(program).all();
  if (profiles.length === 0) return [];

  const reputationPdas = profiles.map((p) =>
    deriveReputationPda(p.account.freelancer)
  );

  // fetchMultiple returns null in a slot for any account that doesn't exist
  // yet, instead of throwing — exactly what we want for "not reputable yet".
  const reputations = await reputationRecords(program).fetchMultiple(reputationPdas);

  return profiles.map((p, i) => {
    const rep = reputations[i];
    return {
      wallet: p.account.freelancer,
      displayName: p.account.displayName,
      completedCount: rep ? rep.completedCount : 0,
      disputedCount: rep ? rep.disputedCount : 0,
    };
  });
}
