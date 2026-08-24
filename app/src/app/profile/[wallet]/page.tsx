"use client";

import { use, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { useReadOnlyProgram } from "@/lib/anchor-client";
import { deriveProfilePda, deriveReputationPda, deriveBadgeMintPda } from "@/lib/pda";
import { shortAddress } from "@/lib/format";
import { ReputationStat } from "@/components/ReputationStat";
import { freelancerProfiles, reputationRecords } from "@/types/accounts";
import Link from "next/link";
import { useRouter } from '@bprogress/next/app'

export default function ProfilePage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = use(params);
  const router = useRouter();
  const program = useReadOnlyProgram();
  const { connection } = useConnection();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [disputedCount, setDisputedCount] = useState(0);
  const [hasBadge, setHasBadge] = useState(false);
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
      router.replace('/profile/create')
      return;
    }
    const w = walletPubkey;

    (async () => {
      const [profile, reputation, badgeMintInfo] = await Promise.all([
        freelancerProfiles(program).fetchNullable(deriveProfilePda(w)),
        reputationRecords(program).fetchNullable(deriveReputationPda(w)),
        connection.getAccountInfo(deriveBadgeMintPda(w)),
      ]);

      setDisplayName(profile?.displayName ?? null);
      setCompletedCount(reputation?.completedCount ?? 0);
      setDisputedCount(reputation?.disputedCount ?? 0);
      // The badge mint is created once, on the freelancer's first-ever
      // approved milestone — its mere existence on chain IS "has a badge."
      setHasBadge(badgeMintInfo !== null);
    })();
  }, [router, program, connection, walletPubkey]);

  if (!walletPubkey || notFound) {
    return <p className="text-error text-center mt-50">{"That's not a valid wallet address."}</p>;
  }

  return (
    <div className="mx-auto max-w-lg text-center">

      <h1 className="font-display text-2xl font-bold text-alter-primary">
        {displayName ?? "Unregistered freelancer"}
        {hasBadge && (
          <span className="ml-2 align-middle text-sm text-success" title="Completed at least one milestone — badge is non-transferable">
            ✓ Verified builder
          </span>
        )}
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
