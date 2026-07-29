"use client";

import { use, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useReadOnlyProgram } from "@/lib/anchor-client";
import { deriveProfilePda, deriveReputationPda } from "@/lib/pda";
import { shortAddress } from "@/lib/format";
import { ReputationStat } from "@/components/ReputationStat";
import { TrustPulse } from "@/components/TrustPulse";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = use(params);
  const program = useReadOnlyProgram();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [disputedCount, setDisputedCount] = useState(0);
  const [notFound, setNotFound] = useState(false);

  let walletPubkey: PublicKey | null = null;
  try {
    walletPubkey = new PublicKey(wallet);
  } catch {
    walletPubkey = null;
  }

  useEffect(() => {
    if (!walletPubkey) {
      setNotFound(true);
      return;
    }
    const w = walletPubkey;

    (async () => {
      const [profile, reputation] = await Promise.all([
        program.account.freelancerProfile.fetchNullable(deriveProfilePda(w)),
        program.account.reputationRecord.fetchNullable(deriveReputationPda(w)),
      ]);

      setDisplayName(profile?.displayName ?? null);
      setCompletedCount(reputation?.completedCount ?? 0);
      setDisputedCount(reputation?.disputedCount ?? 0);
    })();
  }, [program, walletPubkey]);

  if (!walletPubkey || notFound) {
    return <p className="text-error">{"That's not a valid wallet address."}</p>;
  }

  return (
    <div className="mx-auto max-w-lg text-center">
      <TrustPulse mode="progress" bars={16} active={Math.min(completedCount, 16)} className="mx-auto mb-6" />

      <h1 className="font-display text-2xl font-bold text-alter-primary">
        {displayName ?? "Unregistered freelancer"}
      </h1>
      <p className="font-mono text-xs text-alter-muted">{shortAddress(walletPubkey, 6)}</p>

      <div className="mt-4">
        <ReputationStat completedCount={completedCount} disputedCount={disputedCount} className="text-base" />
      </div>

      {!displayName && (
        <p className="mt-4 text-sm text-alter-secondary">
          This wallet is yet to be create a public profile, but the counts above are
          read directly from chain and are accurate regardless.
        </p>
      )}
    </div>
  );
}
