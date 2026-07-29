"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useProgram, useReadOnlyProgram } from "@/lib/anchor-client";
import {
  deriveContractPda,
  deriveVaultPda,
  generateContractId,
} from "@/lib/pda";
import { solToLamportsBN, shortAddress } from "@/lib/format";
import { fetchFreelancerOptions, FreelancerOption } from "@/lib/fetch-profiles";
import { ReputationStat } from "@/components/ReputationStat";

export default function HirePage() {
  const { publicKey } = useWallet();
  const program = useProgram();
  const readOnlyProgram = useReadOnlyProgram();
  const router = useRouter();

  const [options, setOptions] = useState<FreelancerOption[]>([]);
  const [mode, setMode] = useState<"dropdown" | "paste">("dropdown");
  const [selectedWallet, setSelectedWallet] = useState("");
  const [pastedAddress, setPastedAddress] = useState("");
  const [amountSol, setAmountSol] = useState("1");
  const [milestoneCount, setMilestoneCount] = useState(3);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFreelancerOptions(readOnlyProgram)
      .then(setOptions)
      .catch(() => setOptions([]));
  }, [readOnlyProgram]);

  const freelancerAddress = mode === "dropdown" ? selectedWallet : pastedAddress.trim();

  let freelancerPubkey: PublicKey | null = null;
  try {
    if (freelancerAddress) freelancerPubkey = new PublicKey(freelancerAddress);
  } catch {
    freelancerPubkey = null;
  }

  const amount = Number(amountSol);
  const canSubmit =
    !!program &&
    !!publicKey &&
    !!freelancerPubkey &&
    amount > 0 &&
    milestoneCount >= 1 &&
    milestoneCount <= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!program || !publicKey || !freelancerPubkey) return;

    setStatus("submitting");
    setError(null);
    try {
      const contractId = generateContractId();
      const contractPda = deriveContractPda(publicKey, freelancerPubkey, contractId);
      const vaultPda = deriveVaultPda(contractPda);

      await program.methods
        .createContract(contractId, solToLamportsBN(amount), milestoneCount)
        .accounts({
          contract: contractPda,
          vault: vaultPda,
          client: publicKey,
          freelancer: freelancerPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      router.push(`/contract/${contractPda.toBase58()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (!publicKey) {
    return (
      <div className="mx-auto max-w-md text-center p-4 md:p-6">
        <p className="mb-6 text-alter-secondary">
          Connect a wallet to start a contract.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-2xl font-bold text-alter-primary">
        Start a contract
      </h1>
      <p className="mt-2 text-sm text-alter-secondary">
        Your SOL moves into an escrow vault the moment you sign. Nothing pays
        out until you approve a milestone.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <div>
          <div className="mb-2 flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => setMode("dropdown")}
              className={mode === "dropdown" ? "text-primary" : "text-alter-muted"}
            >
              Pick a freelancer
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={mode === "paste" ? "text-primary" : "text-alter-muted"}
            >
              Paste an address instead
            </button>
          </div>

          {mode === "dropdown" ? (
            options.length === 0 ? (
              <p className="rounded-md border border-border bg-elevated px-3 py-3 text-sm text-alter-muted">
                No one has created a profile yet — paste an address instead.
              </p>
            ) : (
              <select
                value={selectedWallet}
                onChange={(e) => setSelectedWallet(e.target.value)}
                className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-alter-primary outline-none focus-visible:border-primary"
              >
                <option value="">Select a freelancer…</option>
                {options.map((o) => (
                  <option key={o.wallet.toBase58()} value={o.wallet.toBase58()}>
                    {o.displayName} — {shortAddress(o.wallet)} — {o.completedCount} completed, {o.disputedCount} disputed
                  </option>
                ))}
              </select>
            )
          ) : (
            <input
              value={pastedAddress}
              onChange={(e) => setPastedAddress(e.target.value)}
              placeholder="Freelancer's wallet address"
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 font-mono text-sm text-alter-primary outline-none focus-visible:border-primary"
            />
          )}

          {mode === "dropdown" &&
            selectedWallet &&
            (() => {
              const chosen = options.find((o) => o.wallet.toBase58() === selectedWallet);
              return chosen ? (
                <div className="mt-2">
                  <ReputationStat
                    completedCount={chosen.completedCount}
                    disputedCount={chosen.disputedCount}
                  />
                </div>
              ) : null;
            })()}

          {freelancerAddress && !freelancerPubkey && (
            <p className="mt-2 text-sm text-error">Not a valid Solana address.</p>
          )}
        </div>

        <label className="flex flex-col gap-2 text-sm text-alter-secondary">
          Total amount (SOL)
          <input
            type="number"
            step="0.01"
            min="0"
            value={amountSol}
            onChange={(e) => setAmountSol(e.target.value)}
            className="rounded-md border border-border bg-elevated px-3 py-2 font-mono text-alter-primary outline-none focus-visible:border-primary"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-alter-secondary">
          Number of milestones (1–10)
          <input
            type="number"
            min={1}
            max={10}
            value={milestoneCount}
            onChange={(e) => setMilestoneCount(Number(e.target.value))}
            className="rounded-md border border-border bg-elevated px-3 py-2 font-mono text-alter-primary outline-none focus-visible:border-primary"
          />
        </label>

        {amount > 0 && milestoneCount > 0 && (
          <p className="font-mono text-xs text-alter-muted">
            ≈ {(amount / milestoneCount).toFixed(4)} SOL per milestone
          </p>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit || status === "submitting"}
          className="neon-glow rounded-md bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "submitting" ? "Locking funds…" : "Sign & lock funds in escrow"}
        </button>
      </form>
    </div>
  );
}
