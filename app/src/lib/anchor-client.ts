"use client";

import { useMemo } from "react";
import { AnchorProvider, Idl, Program, setProvider } from "@anchor-lang/core";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { IDL } from "../types/idl";

/**
 * Wallet-bound program instance — use this for anything that sends a
 * transaction (create_contract, submit_milestone, approve_milestone,
 * reject_milestone, raise_dispute, create_profile). Returns null until a
 * wallet is connected; every write screen should guard on that.
 */
export function useProgram(): Program<Idl> | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    setProvider(provider);
    return new Program(IDL, provider);
  }, [connection, wallet]);
}

/**
 * Read-only program instance — no wallet required. Use this for anything
 * that only fetches accounts: the hire-page freelancer dropdown, the
 * public profile page, and the contract page before a wallet connects.
 */
export function useReadOnlyProgram(): Program<Idl> {
  const { connection } = useConnection();
  return useMemo(() => new Program(IDL, { connection }), [connection]);
}
