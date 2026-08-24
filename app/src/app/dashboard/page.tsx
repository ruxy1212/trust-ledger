"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useReadOnlyProgram } from "@/lib/anchor-client";
import { fetchContractsAsClient, fetchContractsAsFreelancer } from "@/lib/fetch-contracts";
import { lamportsToSol, milestoneStatusName, shortAddress } from "@/lib/format";

type ContractEntry = { publicKey: PublicKey; account: any };

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const program = useReadOnlyProgram();

  const [asClient, setAsClient] = useState<ContractEntry[]>([]);
  const [asFreelancer, setAsFreelancer] = useState<ContractEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    Promise.all([
      fetchContractsAsClient(program, publicKey),
      fetchContractsAsFreelancer(program, publicKey),
    ])
      .then(([c, f]) => {
        setAsClient(c);
        setAsFreelancer(f);
      })
      .finally(() => setLoading(false));
  }, [program, publicKey]);

  if (!publicKey) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="mb-6 text-alter-secondary">Connect a wallet to see your contracts.</p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-alter-primary">My contracts</h1>

      {loading ? <p className="text-alter-muted text-center mt-50">Loading…</p> : (
        <>
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-alter-secondary">Hiring ({asClient.length})</h2>
            <ContractList items={asClient} />
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-alter-secondary">Working on ({asFreelancer.length})</h2>
            <ContractList items={asFreelancer} />
          </section>
        </>
      )}
    </div>
  );
}

function ContractList({ items }: { items: ContractEntry[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-alter-muted">Nothing here yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map(({ publicKey, account }) => {
        const completed = account.milestones.filter(
          (m: unknown) => milestoneStatusName(m) === "approved"
        ).length;

        return (
          <li key={publicKey.toBase58()}>
            <Link
              href={`/contract/${publicKey.toBase58()}`}
              className="glass-card flex items-center justify-between rounded-lg px-4 py-3"
            >
              <span className="font-mono text-xs text-alter-muted">{shortAddress(publicKey, 6)}</span>
              <span className="text-sm text-alter-secondary">
                {completed}/{account.milestoneCount} milestones · {lamportsToSol(account.amount).toFixed(4)} SOL
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
