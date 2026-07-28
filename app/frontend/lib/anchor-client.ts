import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FreelanceEscrow } from "../target/types/freelance_escrow";

let programInstance: Program<FreelanceEscrow> | null = null;

export function getAnchorClient(): Program<FreelanceEscrow> {
  if (programInstance) {
    return programInstance;
  }

  // Setup connection from environment variables or default to local/devnet
  const connection = new anchor.web3.Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  // In Next.js client side, provider uses the window.solana wallet.
  // We can construct a mock/dummy provider for read-only SSR compatibility, 
  // and overwrite it when the wallet is connected.
  const mockWallet = {
    publicKey: anchor.web3.Keypair.generate().publicKey,
    signTransaction: async (tx: anchor.web3.Transaction) => tx,
    signAllTransactions: async (txs: anchor.web3.Transaction[]) => txs,
  };

  const provider = new anchor.AnchorProvider(
    connection,
    mockWallet as any,
    anchor.AnchorProvider.defaultOptions()
  );

  // Parse local IDL file or load it
  // In production, we import the build-time IDL JSON
  const idl = require("../idl/freelance_escrow.json");
  programInstance = new Program<FreelanceEscrow>(idl, provider);

  return programInstance;
}
