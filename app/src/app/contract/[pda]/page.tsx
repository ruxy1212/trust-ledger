"use client";

import { use, useCallback, useEffect, useState } from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useProgram, useReadOnlyProgram } from "@/lib/anchor-client";
import { deriveVaultPda, deriveReputationPda } from "@/lib/pda";
import { lamportsToSol, shortAddress } from "@/lib/format";
import { MilestoneTracker, Role, ContractView } from "@/components/MilestoneTracker";
import { contracts } from "@/types/accounts";
import BN from "bn.js";
import Link from "next/link";
import { MilestoneProgress } from "@/components/MilestoneProgress";

export default function ContractPage({
  params,
}: {
  params: Promise<{ pda: string }>;
}) {
  const { pda } = use(params);
  const { publicKey } = useWallet();
  const program = useProgram();
  const readOnlyProgram = useReadOnlyProgram();

  const [contract, setContract] = useState<
    (ContractView & { client: PublicKey; freelancer: PublicKey; amount: BN }) | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  let contractPda: PublicKey | null = null;
  try {
    contractPda = new PublicKey(pda);
  } catch {
    contractPda = null;
  }

  const reload = useCallback(async () => {
    if (!contractPda) return;
    try {
      const data = await contracts(readOnlyProgram).fetch(contractPda);
      // Cast is TS-only: the IDL type is inferred from a JSON import rather
      // than anchor-codegen'd, so field types don't always line up exactly
      // with the hand-written ContractView shape below. Runtime decoding
      // (what actually matters) comes straight from the on-chain IDL either way.
      setContract(data as unknown as ContractView & { client: PublicKey; freelancer: PublicKey; amount: BN });
      setLoadError(null);
    } catch {
      setLoadError("No contract found at that address.");
    }
  }, [readOnlyProgram, contractPda]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!contractPda) {
    return <p className="text-error text-center mt-50">{"That's not a valid contract address."}</p>;
  }
  if (loadError) {
    return <p className="text-error text-center mt-50">{loadError}</p>;
  }
  if (!contract || true) {
    return <p className="text-alter-muted text-center mt-50">Loading contract…</p>;
  }

  const role: Role = !publicKey
    ? "viewer"
    : publicKey.equals(contract.client)
    ? "client"
    : publicKey.equals(contract.freelancer)
    ? "freelancer"
    : "viewer";

  const completed = contract.milestones.filter(
    (m) => Object.keys(m as object)[0] === "approved"
  ).length;

  async function runAction(index: number, action: () => Promise<void>) {
    setPendingIndex(index);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Transaction failed.");
    } finally {
      setPendingIndex(null);
    }
  }

  async function handleSubmit(index: number) {
    if (!program || !publicKey || !contractPda) return;
    await runAction(index, () =>
      program.methods
        .submitMilestone(index)
        .accounts({ contract: contractPda, freelancer: publicKey })
        .rpc()
        .then(() => {})
    );
  }

  async function handleApprove(index: number) {
    if (!program || !publicKey || !contractPda || !contract) return;
    const vaultPda = deriveVaultPda(contractPda);
    const reputationPda = deriveReputationPda(contract.freelancer);
    await runAction(index, () =>
      program.methods
        .approveMilestone(index)
        .accounts({
          contract: contractPda,
          vault: vaultPda,
          client: publicKey,
          freelancer: contract.freelancer,
          reputation: reputationPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
        .then(() => {})
    );
  }

  async function handleReject(index: number, reason: string) {
    if (!program || !publicKey || !contractPda) return;
    await runAction(index, () =>
      program.methods
        .rejectMilestone(index, reason)
        .accounts({ contract: contractPda, client: publicKey })
        .rpc()
        .then(() => {})
    );
  }

  async function handleDispute(index: number) {
    if (!program || !publicKey || !contractPda || !contract) return;
    const reputationPda = deriveReputationPda(contract.freelancer);
    await runAction(index, () =>
      program.methods
        .raiseDispute(index)
        .accounts({
          contract: contractPda,
          freelancer: publicKey,
          reputation: reputationPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
        .then(() => {})
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-alter-primary">
            Contract
          </h1>
          <p className="font-mono text-xs text-alter-muted">
            {shortAddress(contractPda, 6)}
          </p>
          <p className="mt-1 text-sm text-alter-secondary">
            Client: {shortAddress(contract.client)}{publicKey && publicKey.equals(contract.client) && " (You)"} → Freelancer:{" "}
            {shortAddress(contract.freelancer)}{publicKey && publicKey.equals(contract.freelancer) && " (You)"} · {lamportsToSol(contract.amount).toFixed(4)} SOL total
          </p>
        </div>
        {!publicKey && <WalletMultiButton />}
      </div>

      <MilestoneProgress totalMilestones={contract.milestoneCount} completed={completed} className="mb-8" />

      {role === "viewer" && publicKey && (
        <p className="mb-6 rounded-md border border-border bg-elevated px-4 py-3 text-sm text-alter-secondary">
          {"You're viewing this contract, but the connected wallet is neither the client nor the freelancer — nothing here is actionable for you."}
        </p>
      )}

      {actionError && <p className="mb-4 text-sm text-error">{actionError}</p>}

      <MilestoneTracker
        contract={contract}
        role={role}
        pendingIndex={pendingIndex}
        onSubmit={handleSubmit}
        onApprove={handleApprove}
        onReject={handleReject}
        onDispute={handleDispute}
      />
      <div className="flex flex-wrap items-center justify-center py-8 gap-4">
        <Link
          href="/dashboard"
          className="neon-glow rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition hover:bg-primary-hover"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
