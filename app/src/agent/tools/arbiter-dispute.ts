import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@anchor-lang/core";
import { IDL } from "@/types/idl";
import { contracts, reputationRecords } from "@/types/accounts";
import { deriveReputationPda } from "@/lib/pda";

export interface DisputeEvidence {
  contractAddress: string;
  milestoneIndex: number;
  client: string;
  freelancer: string;
  agreedScope: string;
  submittedDeliverable: string;
  rejectionReason: string;
  currency: "SOL" | "USDC";
  amount: string;
  freelancerReputation: {
    completedCount: number;
    disputedCount: number;
    reputationScore: string;
  };
  clientReputation: {
    completedCount: number;
    disputedCount: number;
    reputationScore: string;
  };
  deliverableDetails?: {
    type: "github_commit" | "github_pr" | "url" | "text";
    diffSummary?: string;
    verifiedAccessible: boolean;
  };
}

export interface ArbiterVerdict {
  verdict: "release_to_freelancer" | "refund_to_client" | "split";
  certainty_score: number; // 0.00 to 1.00
  summary: string;
  findings: {
    scopeAnalysis: string;
    deliverableVerification: string;
    rejectionMerit: string;
  };
  recommendation: string;
}

const connection = new Connection(
  process.env.RPC_URL ?? "https://api.devnet.solana.com",
  "confirmed"
);
const program = new Program(IDL, { connection });

/**
 * Parses GitHub URLs and attempts to fetch commit diff or PR summary via GitHub public API
 */
export async function fetchGitHubEvidence(
  deliverableUri: string
): Promise<{ type: "github_commit" | "github_pr" | "url" | "text"; diffSummary?: string; verifiedAccessible: boolean }> {
  const trimmed = deliverableUri.trim();

  // Match GitHub commit: github.com/:owner/:repo/commit/:hash
  const commitMatch = trimmed.match(
    /github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]+)/i
  );
  if (commitMatch) {
    const [, owner, repo, hash] = commitMatch;
    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${hash}`;
      const res = await fetch(apiUrl, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "TrustLedger-Arbiter-Agent",
        },
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const message = data.commit?.message ?? "";
        const files = (data.files || []).map((f: any) => `${f.filename} (+${f.additions}/-${f.deletions})`).slice(0, 15).join(", ");
        const patchSample = (data.files || [])
          .filter((f: any) => f.patch)
          .map((f: any) => `File ${f.filename}:\n${f.patch.slice(0, 400)}`)
          .slice(0, 3)
          .join("\n---\n");

        return {
          type: "github_commit",
          verifiedAccessible: true,
          diffSummary: `Commit message: "${message}". Files changed: ${files}. Sample patch: ${patchSample}`,
        };
      }
    } catch {
      // Fall through to basic URL handling if GitHub API is unreachable or rate limited
    }
    return {
      type: "github_commit",
      verifiedAccessible: false,
      diffSummary: `GitHub commit URL provided: ${trimmed}. Note: Could not query GitHub API (may be private repo or rate limited).`,
    };
  }

  // Match GitHub pull request: github.com/:owner/:repo/pull/:number
  const prMatch = trimmed.match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i
  );
  if (prMatch) {
    const [, owner, repo, prNum] = prMatch;
    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNum}`;
      const res = await fetch(apiUrl, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "TrustLedger-Arbiter-Agent",
        },
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const title = data.title ?? "";
        const body = (data.body ?? "").slice(0, 300);
        const state = data.state;
        const changedFiles = data.changed_files ?? 0;

        return {
          type: "github_pr",
          verifiedAccessible: true,
          diffSummary: `PR #${prNum} (${state}): "${title}". Description: "${body}". Changed files count: ${changedFiles}.`,
        };
      }
    } catch {
      // Fall through
    }
    return {
      type: "github_pr",
      verifiedAccessible: false,
      diffSummary: `GitHub Pull Request URL provided: ${trimmed}. Could not query GitHub API directly.`,
    };
  }

  // Generic URL
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      type: "url",
      verifiedAccessible: true,
      diffSummary: `Live preview or deliverable link: ${trimmed}`,
    };
  }

  return {
    type: "text",
    verifiedAccessible: true,
    diffSummary: `Textual proof or reference provided: ${trimmed}`,
  };
}

/**
 * Fetches contract state, client/freelancer reputation, and deliverable evidence for a given milestone
 */
export async function collectDisputeEvidence(
  contractAddress: string,
  milestoneIndex: number
): Promise<DisputeEvidence> {
  const contractPubkey = new PublicKey(contractAddress);
  const contractAcc = await contracts(program).fetch(contractPubkey);

  if (milestoneIndex < 0 || milestoneIndex >= contractAcc.milestoneCount) {
    throw new Error(`Milestone index ${milestoneIndex} out of bounds (count: ${contractAcc.milestoneCount})`);
  }

  const clientPubkey = contractAcc.client;
  const freelancerPubkey = contractAcc.freelancer;

  const [freelancerRep, clientRep] = await Promise.all([
    reputationRecords(program).fetchNullable(deriveReputationPda(freelancerPubkey)),
    reputationRecords(program).fetchNullable(deriveReputationPda(clientPubkey)),
  ]);

  const agreedScope = contractAcc.milestoneDescriptions?.[milestoneIndex] || "No description provided";
  const submittedDeliverable = contractAcc.submissions?.[milestoneIndex] || "No submission recorded";
  const rejectionReason = contractAcc.rejectionReasons?.[milestoneIndex] || "No rejection reason recorded";

  const isUsdc = !!contractAcc.tokenMint;
  const currency = isUsdc ? "USDC" : "SOL";
  const amountStr = isUsdc
    ? `${(contractAcc.basePayout.toNumber() / 1_000_000).toFixed(2)} USDC`
    : `${(contractAcc.basePayout.toNumber() / 1_000_000_000).toFixed(4)} SOL`;

  const deliverableDetails = await fetchGitHubEvidence(submittedDeliverable);

  return {
    contractAddress,
    milestoneIndex,
    client: clientPubkey.toBase58(),
    freelancer: freelancerPubkey.toBase58(),
    agreedScope,
    submittedDeliverable,
    rejectionReason,
    currency,
    amount: amountStr,
    freelancerReputation: {
      completedCount: freelancerRep?.completedCount ?? 0,
      disputedCount: freelancerRep?.disputedCount ?? 0,
      reputationScore: freelancerRep?.reputationScore ? freelancerRep.reputationScore.toString() : "0",
    },
    clientReputation: {
      completedCount: clientRep?.completedCount ?? 0,
      disputedCount: clientRep?.disputedCount ?? 0,
      reputationScore: clientRep?.reputationScore ? clientRep.reputationScore.toString() : "0",
    },
    deliverableDetails,
  };
}

export const ARBITER_SYSTEM_PROMPT = `You are the Trust Ledger Autonomous AI Arbiter Agent.
You impartially evaluate disputed freelance service escrow milestones on the Solana blockchain.

Your goal is to analyze the evidence and render a legally, technically, and contractually sound verdict with a Certainty Score between 0.00 and 1.00.

Evidence available to you:
1. Agreed Scope / Requirement Spec: What was agreed upon when the contract was created.
2. Submitted Deliverable Proof: The code commit, PR, or URL submitted by the freelancer.
3. Code Diff Summary: Details of modified files and patches if deliverable is a GitHub commit/PR.
4. Client's Rejection Reason: Why the client rejected the work and requested a dispute.
5. On-Chain Reputation History: Track records of completed vs disputed milestones for both parties.

Evaluation Rubrics:
- Release to Freelancer ("release_to_freelancer"):
  * If the submitted deliverable and code diff reasonably fulfill the agreed milestone scope.
  * If the client's rejection reason demands extra unagreed features (scope creep), subjective aesthetic changes not in the original spec, or gives no technical merit.
  * High certainty score (0.85 - 1.00) when code changes directly map to the agreed specification.

- Refund to Client ("refund_to_client"):
  * If the freelancer failed to deliver the required scope, provided an empty/unrelated deliverable (e.g. empty commit, hello world, broken build), or failed essential acceptance criteria.
  * High certainty score (0.85 - 1.00) when the deliverable clearly fails or doesn't implement the spec.

- Split 50/50 ("split"):
  * If there is genuine ambiguity in the specification that both parties reasonably interpreted differently.
  * If the deliverable is partially complete, functional but with minor defects, or if both parties contributed to the breakdown.
  * Certainty score typically ranges between 0.60 and 0.84 when compromise is the fairest path.

Output Format:
You MUST respond with valid JSON matching this exact structure:
{
  "verdict": "release_to_freelancer" | "refund_to_client" | "split",
  "certainty_score": <number between 0.00 and 1.00>,
  "summary": "<1-2 sentence executive summary of the evaluation>",
  "findings": {
    "scopeAnalysis": "<analysis of the original milestone requirements>",
    "deliverableVerification": "<analysis of the submitted proof/diff>",
    "rejectionMerit": "<evaluation of client's claim vs actual deliverable>"
  },
  "recommendation": "<concrete next action recommended for client, freelancer, or contract resolution>"
}`;
