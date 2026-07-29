import { contracts } from "@/types/accounts";
import { Program } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";

const CLIENT_OFFSET = 8;           // after the 8-byte Anchor discriminator
const FREELANCER_OFFSET = 8 + 32;  // after discriminator + client pubkey

export function fetchContractsAsClient(program: Program<any>, client: PublicKey) {
  return contracts(program).all([
    { memcmp: { offset: CLIENT_OFFSET, bytes: client.toBase58() } },
  ]);
}

export function fetchContractsAsFreelancer(program: Program<any>, freelancer: PublicKey) {
  return contracts(program).all([
    { memcmp: { offset: FREELANCER_OFFSET, bytes: freelancer.toBase58() } },
  ]);
}
