import type BN from "bn.js";
import { lamportsToSol } from "@/lib/format";

export function ReputationStat({
  completedCount,
  disputedCount,
  earnedVolume,
  reputationScore,
  className = "",
}: {
  completedCount: number;
  disputedCount: number;
  earnedVolume?: BN | number;
  reputationScore?: BN | number;
  className?: string;
}) {
  const volumeSol = earnedVolume
    ? typeof earnedVolume === "number"
      ? earnedVolume
      : lamportsToSol(earnedVolume)
    : 0;

  const score = reputationScore
    ? typeof reputationScore === "number"
      ? reputationScore
      : reputationScore.toNumber()
    : 0;

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 font-mono text-sm text-alter-secondary ${className}`}>
      <span className="text-success">{completedCount} completed</span>
      {disputedCount > 0 && (
        <>
          <span>·</span>
          <span className="text-warning">{disputedCount} disputed</span>
        </>
      )}
      {volumeSol > 0 && (
        <>
          <span>·</span>
          <span className="text-accent" title="Total volume earned across completed milestones">
            {volumeSol.toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL
          </span>
        </>
      )}
      {score > 0 && (
        <>
          <span>·</span>
          <span className="text-info" title="Value-weighted reputation score">
            Score: {score}
          </span>
        </>
      )}
    </span>
  );
}
