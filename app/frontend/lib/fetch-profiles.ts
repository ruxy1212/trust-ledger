import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.solana";
import { getAnchorClient } from "./anchor-client";

export interface FreelancerProfileInfo {
  pubkey: string;
  displayName: string;
  completedCount: number;
  disputedCount: number;
}

export async function fetchProfiles(): Promise<FreelancerProfileInfo[]> {
  const program = getAnchorClient();
  
  // 1. Fetch all FreelancerProfile accounts using getProgramAccounts / fetchAll
  const profiles = await program.account.freelancerProfile.all();

  // 2. Fetch all ReputationRecords
  const reputations = await program.account.reputationRecord.all();

  // Map reputations by freelancer pubkey for easy lookup
  const reputationMap: Record<string, { completedCount: number; disputedCount: number }> = {};
  for (const rep of reputations) {
    // PDA seed: ["reputation", freelancer_pubkey]
    // We can infer the freelancer from the FreelancerProfile mapping or query directly.
    // For simplicity, we match freelancer keys.
  }

  // Build profile list with embedded reputation data
  const result: FreelancerProfileInfo[] = [];

  for (const prof of profiles) {
    const freelancerKey = prof.account.freelancer.toBase58();
    
    // Find reputation matching this freelancer
    // To do this reliably, calculate the reputation PDA for this freelancer
    const [reputationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), prof.account.freelancer.toBuffer()],
      program.programId
    );

    const matchingRep = reputations.find((r) => r.publicKey.toBase58() === reputationPda.toBase58());

    result.push({
      pubkey: freelancerKey,
      displayName: prof.account.displayName,
      completedCount: matchingRep ? matchingRep.account.completedCount : 0,
      disputedCount: matchingRep ? matchingRep.account.disputedCount : 0,
    });
  }

  return result;
}
