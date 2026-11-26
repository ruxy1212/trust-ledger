"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useProgram, useReadOnlyProgram } from "@/lib/anchor-client";
import {
  deriveContractPda,
  deriveVaultPda,
  generateContractId,
} from "@/lib/pda";
import { solToLamportsBN, shortAddress } from "@/lib/format";
import { fetchFreelancerOptions, FreelancerOption } from "@/lib/fetch-profiles";
import { ReputationStat } from "@/components/ReputationStat";
import {
  DEVNET_USDC_MINT,
  getAta,
  createIdempotentAtaInstruction,
  usdcToUnits,
} from "@/lib/tokens";
import BN from "bn.js";

export default function HirePage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const program = useProgram();
  const readOnlyProgram = useReadOnlyProgram();
  const router = useRouter();

  const [options, setOptions] = useState<FreelancerOption[]>([]);
  const [mode, setMode] = useState<"dropdown" | "paste">("dropdown");
  const [selectedWallet, setSelectedWallet] = useState("");
  const [pastedAddress, setPastedAddress] = useState("");
  const [currency, setCurrency] = useState<"SOL" | "USDC">("SOL");
  const [amountInput, setAmountInput] = useState("1");
  const [milestoneCount, setMilestoneCount] = useState(3);
  const [milestoneDescriptions, setMilestoneDescriptions] = useState<string[]>([
    "Milestone 1: Project kickoff & architecture",
    "Milestone 2: Core feature implementation",
    "Milestone 3: Final delivery & QA",
  ]);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleMilestoneCountChange = (count: number) => {
    const validCount = Math.max(1, Math.min(10, count || 1));
    setMilestoneCount(validCount);
    setMilestoneDescriptions((prev) => {
      const next = [...prev];
      while (next.length < validCount) {
        next.push(`Milestone ${next.length + 1}: Deliverable spec`);
      }
      return next.slice(0, validCount);
    });
  };

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

  const amount = Number(amountInput);
  const isSelf = !!publicKey && !!freelancerPubkey && publicKey.equals(freelancerPubkey);

  // Limits based on currency
  const minEscrow = currency === "SOL" ? 0.01 : 1; // 0.01 SOL vs 1 USDC
  const maxEscrow = currency === "SOL" ? 100 : 50_000; // 100 SOL vs 50,000 USDC
  const minMilestonePayout = currency === "SOL" ? 0.002 : 0.2; // 0.002 SOL vs 0.2 USDC

  const isAmountTooLow = amount < minEscrow;
  const isAmountTooHigh = amount > maxEscrow;
  const isMilestonePayoutTooLow = milestoneCount > 0 && amount / milestoneCount < minMilestonePayout;
  const hasValidDescriptions =
    milestoneDescriptions.length === milestoneCount &&
    milestoneDescriptions.every((d) => d.trim().length > 0 && d.trim().length <= 100);

  const canSubmit =
    status !== "submitting" &&
    !!program &&
    !!publicKey &&
    !!freelancerPubkey &&
    !isSelf &&
    !isAmountTooLow &&
    !isAmountTooHigh &&
    !isMilestonePayoutTooLow &&
    hasValidDescriptions &&
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

      if (currency === "SOL") {
        await program.methods
          .createContract(
            contractId,
            solToLamportsBN(amount),
            milestoneCount,
            milestoneDescriptions,
            null
          )
          .accounts({
            contract: contractPda,
            vault: vaultPda,
            client: publicKey,
            freelancer: freelancerPubkey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } else {
        // USDC Multi-currency flow
        const mint = DEVNET_USDC_MINT;
        const clientAta = getAta(mint, publicKey, false);
        const vaultAta = getAta(mint, vaultPda, true);

        // Pre-create vault ATA if it doesn't exist
        const tx = new Transaction().add(
          createIdempotentAtaInstruction(publicKey, vaultAta, vaultPda, mint)
        );

        const createContractIx = await program.methods
          .createContract(
            contractId,
            new BN(usdcToUnits(amount)),
            milestoneCount,
            milestoneDescriptions,
            mint
          )
          .accounts({
            contract: contractPda,
            vault: vaultPda,
            client: publicKey,
            freelancer: freelancerPubkey,
            tokenMint: mint,
            clientTokenAccount: clientAta,
            vaultTokenAccount: vaultAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        tx.add(createContractIx);
        await sendTransaction(tx, connection);
      }

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
        Your funds move into an escrow vault the moment you sign. Nothing pays
        out until you approve a milestone.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        {/* Currency Selector */}
        <div>
          <label className="text-sm text-alter-secondary mb-2 block font-medium">
            Escrow Currency
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setCurrency("SOL");
                setAmountInput("1");
              }}
              className={`flex items-center justify-center gap-2 rounded-md border p-3 text-sm font-medium transition cursor-pointer ${
                currency === "SOL"
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border bg-elevated text-alter-secondary hover:text-alter-primary"
              }`}
            >
              <span>Native SOL</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrency("USDC");
                setAmountInput("50");
              }}
              className={`flex items-center justify-center gap-2 rounded-md border p-3 text-sm font-medium transition cursor-pointer ${
                currency === "USDC"
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border bg-elevated text-alter-secondary hover:text-alter-primary"
              }`}
            >
              <span>Devnet USDC</span>
            </button>
          </div>
          {currency === "USDC" && (
            <p className="mt-2 text-xs text-alter-muted">
              Mint: <span className="font-mono text-alter-secondary">4zMMC9...ncDU</span> (6 decimals). Ensure you have Devnet USDC in your wallet.
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => setMode("dropdown")}
              className={mode === "dropdown" ? "text-primary font-medium" : "text-alter-muted"}
            >
              Pick a freelancer
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={mode === "paste" ? "text-primary font-medium" : "text-alter-muted"}
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

          {isSelf && (
            <p className="mt-2 text-sm text-error">
              You cannot hire yourself. Please select or paste a different freelancer wallet.
            </p>
          )}
        </div>

        <label className="flex flex-col gap-2 text-sm text-alter-secondary">
          Total amount ({currency})
          <input
            type="number"
            step={currency === "SOL" ? "0.01" : "1"}
            min={minEscrow}
            max={maxEscrow}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="rounded-md border border-border bg-elevated px-3 py-2 font-mono text-alter-primary outline-none focus-visible:border-primary"
          />
        </label>
        {isAmountTooLow && amount > 0 && (
          <p className="text-xs text-error">
            Minimum contract escrow is {minEscrow} {currency} (anti-farming floor).
          </p>
        )}
        {isAmountTooHigh && (
          <p className="text-xs text-error">
            Maximum contract escrow is {maxEscrow.toLocaleString()} {currency} (anti-fraud safety ceiling).
          </p>
        )}

        <label className="flex flex-col gap-2 text-sm text-alter-secondary">
          Number of milestones (1–10)
          <input
            type="number"
            min={1}
            max={10}
            value={milestoneCount}
            onChange={(e) => handleMilestoneCountChange(Number(e.target.value))}
            className="rounded-md border border-border bg-elevated px-3 py-2 font-mono text-alter-primary outline-none focus-visible:border-primary"
          />
        </label>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-alter-secondary">
            Milestone scope specifications
          </label>
          <div className="flex flex-col gap-2">
            {milestoneDescriptions.map((desc, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-mono text-xs text-alter-muted w-6">#{idx + 1}</span>
                <input
                  type="text"
                  maxLength={100}
                  value={desc}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMilestoneDescriptions((prev) => {
                      const updated = [...prev];
                      updated[idx] = val;
                      return updated;
                    });
                  }}
                  placeholder={`Requirements for milestone #${idx + 1} (max 100 chars)`}
                  className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-alter-primary outline-none focus-visible:border-primary"
                />
              </div>
            ))}
          </div>
        </div>
        {isMilestonePayoutTooLow && !isAmountTooLow && (
          <p className="text-xs text-error">
            Each milestone payout must be at least {minMilestonePayout} {currency}.
          </p>
        )}

        {amount > 0 && milestoneCount > 0 && (
          <p className="font-mono text-xs text-alter-muted">
            ≈ {(amount / milestoneCount).toFixed(currency === "SOL" ? 4 : 2)} {currency} per milestone
          </p>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit || status === "submitting"}
          className="neon-glow rounded-md bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "submitting" ? "Locking funds…" : `Sign & lock ${currency} in escrow`}
        </button>
      </form>
    </div>
  );
}
