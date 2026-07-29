"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { SystemProgram } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor-client";
import { deriveProfilePda } from "@/lib/pda";

export default function CreateProfilePage() {
  const { publicKey } = useWallet();
  const program = useProgram();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !!program && !!publicKey && displayName.trim().length > 0 && displayName.length <= 50;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!program || !publicKey) return;

    setStatus("submitting");
    setError(null);
    try {
      const profilePda = deriveProfilePda(publicKey);
      await program.methods
        .createProfile(displayName.trim())
        .accounts({
          profile: profilePda,
          freelancer: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      router.push(`/profile/${publicKey.toBase58()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-2xl font-bold text-alter-primary">
        Create your profile
      </h1>
      <p className="mt-2 text-sm text-alter-secondary">
        {"Optional, but it's what puts you in a client's dropdown instead of requiring them to paste your address. One transaction, one time."}
      </p>

      {!publicKey ? (
        <div className="mt-8">
          <WalletMultiButton />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm text-alter-secondary">
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              placeholder="e.g. Alice Freelancer"
              className="rounded-md border border-border bg-elevated px-3 py-2 text-alter-primary outline-none focus-visible:border-primary"
            />
            <span className="font-mono text-xs text-alter-muted">
              {displayName.length}/50
            </span>
          </label>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || status === "submitting"}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "submitting" ? "Creating…" : "Create profile"}
          </button>
        </form>
      )}
    </div>
  );
}
