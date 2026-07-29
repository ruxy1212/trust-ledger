import { PublicKey } from "@solana/web3.js";
import { IDL } from "../types/idl";
import BN from "bn.js";

export const PROGRAM_ID = new PublicKey(IDL.address);

const enc = (s: string) => Buffer.from(s, "utf8");

/** [b"profile", freelancer.key()] */
export function deriveProfilePda(freelancer: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [enc("profile"), freelancer.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

/** [b"contract", client.key(), freelancer.key(), contract_id.to_le_bytes()] */
export function deriveContractPda(
  client: PublicKey,
  freelancer: PublicKey,
  contractId: BN
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      enc("contract"),
      client.toBuffer(),
      freelancer.toBuffer(),
      contractId.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
  return pda;
}

/** [b"vault", contract.key()] */
export function deriveVaultPda(contractPda: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [enc("vault"), contractPda.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

/** [b"reputation", freelancer.key()] */
export function deriveReputationPda(freelancer: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [enc("reputation"), freelancer.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

/**
 * contract_id is arbitrary — it only exists to let one client/freelancer
 * pair have more than one contract. A random 6-byte value keeps it well
 * inside u64 and away from JS float-precision edges, and collisions are
 * a PDA-already-in-use error at worst (vanishingly unlikely, and just
 * means "click again").
 */
export function generateContractId(): BN {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return new BN(bytes, "le");
}
