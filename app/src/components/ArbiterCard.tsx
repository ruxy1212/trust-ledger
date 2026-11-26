"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { createAuthMessage } from "@/lib/auth";

export interface ArbiterEvaluation {
  verdict: "release_to_freelancer" | "refund_to_client" | "split";
  certainty_score: number;
  summary: string;
  findings: {
    scopeAnalysis: string;
    deliverableVerification: string;
    rejectionMerit: string;
  };
  recommendation: string;
}

interface ArbiterCardProps {
  contractAddress: string;
  milestoneIndex: number;
  role: "client" | "freelancer" | "viewer";
  isPending: boolean;
  onAcceptRecommendation: (resolution: "releaseToFreelancer" | "refundToClient" | "split") => void;
}

export function ArbiterCard({
  contractAddress,
  milestoneIndex,
  role,
  isPending,
  onAcceptRecommendation,
}: ArbiterCardProps) {
  const { publicKey, signMessage } = useWallet();
  const [evaluation, setEvaluation] = useState<ArbiterEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestArbitration() {
    if (!publicKey || !signMessage) {
      setError("Please connect a wallet that supports message signing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const messageText = createAuthMessage(timestamp);
      const encodedMessage = new TextEncoder().encode(messageText);
      const signatureBytes = await signMessage(encodedMessage);

      // Convert Uint8Array signature to base64
      let binary = "";
      for (let i = 0; i < signatureBytes.length; i++) {
        binary += String.fromCharCode(signatureBytes[i]);
      }
      const signature = btoa(binary);

      const res = await fetch("/api/arbiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress,
          milestoneIndex,
          wallet: publicKey.toBase58(),
          signature,
          timestamp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze dispute.");
      }

      setEvaluation(data.verdict);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  // Certainty score color logic
  const certaintyPercent = evaluation ? Math.round(evaluation.certainty_score * 100) : 0;
  const scoreColor =
    certaintyPercent >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : certaintyPercent >= 65
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  const verdictLabel =
    evaluation?.verdict === "release_to_freelancer"
      ? "Release Funds to Freelancer"
      : evaluation?.verdict === "refund_to_client"
      ? "Refund Escrow to Client"
      : "50/50 Compromise Split";

  const targetResolution: "releaseToFreelancer" | "refundToClient" | "split" =
    evaluation?.verdict === "release_to_freelancer"
      ? "releaseToFreelancer"
      : evaluation?.verdict === "refund_to_client"
      ? "refundToClient"
      : "split";

  return (
    <div className="mt-4 rounded-md border border-purple-500/30 bg-gradient-to-br from-purple-950/20 via-background to-background p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-300">
            AI Arbiter Engine
          </h4>
        </div>
        {!evaluation && !loading && (
          <button
            onClick={requestArbitration}
            disabled={isPending || role === "viewer"}
            className="rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-purple-500 disabled:opacity-50 cursor-pointer"
          >
            Run AI Analysis
          </button>
        )}
      </div>

      {loading && (
        <div className="py-6 text-center">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
          <p className="mt-2 text-xs text-alter-secondary">
            Inspecting GitHub deliverable diff, scope specs, and dispute claims…
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      <AnimatePresence>
        {evaluation && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 space-y-3"
          >
            {/* Header / Certainty Gauge */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-alter-muted">Recommended Verdict</p>
                <p className="text-sm font-semibold text-alter-primary">{verdictLabel}</p>
              </div>
              <div className={`rounded border px-2.5 py-1 text-xs font-mono font-medium ${scoreColor}`}>
                Certainty: {certaintyPercent}%
              </div>
            </div>

            {/* Summary */}
            <p className="text-xs text-alter-secondary leading-relaxed bg-elevated/50 p-2.5 rounded border border-border/50">
              {evaluation.summary}
            </p>

            {/* Detailed Findings */}
            <div className="space-y-1.5 text-xs">
              <p className="text-alter-muted font-medium">Evaluation Findings:</p>
              <ul className="list-disc pl-4 space-y-1 text-alter-secondary">
                <li><span className="text-alter-primary font-medium">Scope:</span> {evaluation.findings.scopeAnalysis}</li>
                <li><span className="text-alter-primary font-medium">Deliverable:</span> {evaluation.findings.deliverableVerification}</li>
                <li><span className="text-alter-primary font-medium">Rejection Merit:</span> {evaluation.findings.rejectionMerit}</li>
              </ul>
            </div>

            {/* Recommendation & Instant Settlement Action */}
            <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-purple-300 italic flex-1">
                Recommendation: {evaluation.recommendation}
              </p>
              {role !== "viewer" && (
                <button
                  onClick={() => onAcceptRecommendation(targetResolution)}
                  disabled={isPending}
                  className="rounded bg-primary px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-primary-hover disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  Accept & Settle On-Chain
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
