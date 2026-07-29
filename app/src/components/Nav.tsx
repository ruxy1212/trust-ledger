"use client";

import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-(--bg-base)/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-(--container-max) items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-lg tracking-tight text-alter-primary"
        >
          Trust<span className="text-gradient">Ledger</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-alter-secondary sm:flex">
          <Link href="/hire" className="hover:text-alter-primary">
            Hire
          </Link>
          <Link
            href="/profile/create"
            className="hover:text-alter-primary"
          >
            I&apos;m a freelancer
          </Link>
        </nav>

        <WalletMultiButton />
      </div>
    </header>
  );
}
