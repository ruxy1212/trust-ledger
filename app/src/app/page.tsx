import Link from "next/link";
import { TrustPulse } from "@/components/TrustPulse";

export default function HomePage() {
  return (
    <div className="scanlines relative flex flex-col items-center gap-10 py-20 text-center">
      <TrustPulse mode="ambient" bars={24} className="h-16 opacity-70" />

      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-bold tracking-tight text-alter-primary sm:text-5xl">
          Escrow that releases funds <span className="text-gradient">by milestones</span>.
          <br />
          Reputation that stays with your <span className="text-gradient">wallet</span>.
        </h1>
        <p className="mt-5 text-alter-secondary">
          Funds are locked on-chain when a contract begins, and each completed milestone builds a public reputation you own. No platform lock-in. No reputation lost.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/hire"
          className="neon-glow rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition hover:bg-primary-hover"
        >
          I&apos;m hiring
        </Link>
        <Link
          href="/profile/create"
          className="glass-card rounded-md px-6 py-3 text-sm font-medium text-alter-primary"
        >
          I&apos;m a freelancer
        </Link>
      </div>

      <p className="font-mono text-xs text-alter-muted">
        Devnet — funds are test SOL, contracts are real transactions.
      </p>
    </div>
  );
}
