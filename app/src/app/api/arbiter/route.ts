import { NextResponse } from "next/server";
import OpenAI from "openai";
import { PublicKey } from "@solana/web3.js";
import {
  collectDisputeEvidence,
  ARBITER_SYSTEM_PROMPT,
  type ArbiterVerdict,
  type DisputeEvidence,
} from "@/agent/tools/arbiter-dispute";
import { checkRateLimit, callerKey } from "@/lib/rate-limit";
import { extractWalletAuth, verifyWalletAuth } from "@/lib/auth";

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY || "missing-key",
  baseURL: process.env.OPEN_AI_BASE_URL,
});

const LIMIT_PER_IP = 15;
const LIMIT_PER_WALLET = 20;
const WINDOW_MS = 60_000;

/**
 * Fallback deterministic heuristic evaluation when OpenAI API key is unavailable or during offline testing.
 */
function evaluateDisputeHeuristically(evidence: DisputeEvidence): ArbiterVerdict {
  const scopeLower = evidence.agreedScope.toLowerCase();
  const rejectionLower = evidence.rejectionReason.toLowerCase();
  const deliverableLower = evidence.submittedDeliverable.toLowerCase();

  // If rejection mentions features not in scope (e.g. mobile, extra, additional, redesign, dark mode)
  const scopeCreepKeywords = ["extra", "unagreed", "bonus", "redesign", "mobile", "ios", "android", "dark mode", "another"];
  const isScopeCreep = scopeCreepKeywords.some((kw) => rejectionLower.includes(kw) && !scopeLower.includes(kw));

  // If deliverable is obviously invalid or empty
  const isMissingOrInvalid =
    deliverableLower.includes("placeholder") ||
    deliverableLower.includes("todo") ||
    deliverableLower.length < 10 ||
    evidence.submittedDeliverable === "No submission recorded";

  if (isMissingOrInvalid) {
    return {
      verdict: "refund_to_client",
      certainty_score: 0.95,
      summary: "Deliverable proof is missing, incomplete, or does not satisfy fundamental requirements.",
      findings: {
        scopeAnalysis: `Required milestone scope: "${evidence.agreedScope}".`,
        deliverableVerification: "The submitted deliverable contains no verifiable production artifacts or code implementation.",
        rejectionMerit: `Client's rejection is justified based on non-delivery: "${evidence.rejectionReason}".`,
      },
      recommendation: "Refund the milestone escrow back to the client.",
    };
  }

  if (isScopeCreep) {
    return {
      verdict: "release_to_freelancer",
      certainty_score: 0.90,
      summary: "Submitted deliverable satisfies the agreed milestone scope; client rejection appears to demand unagreed additions.",
      findings: {
        scopeAnalysis: `Agreed scope covers: "${evidence.agreedScope}".`,
        deliverableVerification: `Deliverable provided (${evidence.submittedDeliverable}) maps directly to initial requirements.`,
        rejectionMerit: `Client's rejection claims seem to reflect out-of-scope demands: "${evidence.rejectionReason}".`,
      },
      recommendation: "Release milestone payout to freelancer as agreed terms were fulfilled.",
    };
  }

  // Moderate certainty / partial ambiguity -> Recommend Split
  return {
    verdict: "split",
    certainty_score: 0.75,
    summary: "Deliverable was partially submitted with subjective differences in acceptance criteria.",
    findings: {
      scopeAnalysis: `Scope description: "${evidence.agreedScope}".`,
      deliverableVerification: `Submission was provided at: "${evidence.submittedDeliverable}".`,
      rejectionMerit: `Client raised valid concerns regarding specification alignment: "${evidence.rejectionReason}".`,
    },
    recommendation: "Execute a 50/50 split resolution to achieve fair compromise.",
  };
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const { contractAddress, milestoneIndex } = body;

  if (!contractAddress || typeof contractAddress !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid contractAddress property." },
      { status: 400 }
    );
  }

  if (typeof milestoneIndex !== "number" || milestoneIndex < 0) {
    return NextResponse.json(
      { error: "Missing or invalid milestoneIndex property (must be non-negative integer)." },
      { status: 400 }
    );
  }

  try {
    new PublicKey(contractAddress);
  } catch {
    return NextResponse.json(
      { error: "Invalid Solana contract address format." },
      { status: 400 }
    );
  }

  // 1. Authenticate caller wallet signature via Ed25519
  const authParams = extractWalletAuth(req, body);
  if (!authParams) {
    return NextResponse.json(
      { error: "Authentication required. Connect your Solana wallet to run dispute arbitration." },
      { status: 401 }
    );
  }

  const authResult = verifyWalletAuth(authParams);
  if (!authResult.valid || !authResult.wallet) {
    return NextResponse.json(
      { error: authResult.error ?? "Invalid wallet authentication signature." },
      { status: 401 }
    );
  }

  const callerWallet = authResult.wallet;

  // 2. Rate limiting (per IP and per wallet)
  const ip = callerKey(req);
  const [ipLimit, walletLimit] = await Promise.all([
    checkRateLimit(`arbiter:ip:${ip}`, LIMIT_PER_IP, WINDOW_MS),
    checkRateLimit(`arbiter:wallet:${callerWallet}`, LIMIT_PER_WALLET, WINDOW_MS),
  ]);

  if (!ipLimit.allowed || !walletLimit.allowed) {
    return NextResponse.json(
      { error: "Too many arbitration requests. Please wait a minute before requesting another analysis." },
      { status: 429 }
    );
  }

  // 3. Collect on-chain and off-chain evidence
  let evidence: DisputeEvidence;
  try {
    evidence = await collectDisputeEvidence(contractAddress, milestoneIndex);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to collect dispute evidence: ${err.message || String(err)}` },
      { status: 400 }
    );
  }

  // Verify that the caller is either client, freelancer, or authorized party
  const isParticipant =
    callerWallet === evidence.client || callerWallet === evidence.freelancer;

  if (!isParticipant) {
    return NextResponse.json(
      { error: "Only contract participants (client or freelancer) may request AI dispute arbitration." },
      { status: 403 }
    );
  }

  // 4. Generate AI Evaluation Verdict
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey || apiKey === "missing-key") {
    // Graceful fallback to deterministic heuristic analysis
    const heuristicVerdict = evaluateDisputeHeuristically(evidence);
    return NextResponse.json({
      evidence,
      verdict: heuristicVerdict,
      engine: "heuristic-fallback",
    });
  }

  try {
    const userPrompt = `Dispute Evidence for Contract ${evidence.contractAddress} (Milestone #${evidence.milestoneIndex}):
- Currency: ${evidence.currency}
- Milestone Payout Amount: ${evidence.amount}
- Client: ${evidence.client} (Completed: ${evidence.clientReputation.completedCount}, Disputed: ${evidence.clientReputation.disputedCount})
- Freelancer: ${evidence.freelancer} (Completed: ${evidence.freelancerReputation.completedCount}, Disputed: ${evidence.freelancerReputation.disputedCount})
- Agreed Milestone Scope: "${evidence.agreedScope}"
- Submitted Deliverable: "${evidence.submittedDeliverable}"
- Deliverable Details: ${JSON.stringify(evidence.deliverableDetails)}
- Client Rejection Reason: "${evidence.rejectionReason}"

Evaluate the case and provide your impartial verdict, certainty score (0.00 - 1.00), and findings JSON.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: ARBITER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    const verdictParsed: ArbiterVerdict = JSON.parse(rawContent);

    // Ensure certainty score is clamped between 0 and 1
    if (typeof verdictParsed.certainty_score === "number") {
      verdictParsed.certainty_score = Math.max(0, Math.min(1, verdictParsed.certainty_score));
    } else {
      verdictParsed.certainty_score = 0.70;
    }

    return NextResponse.json({
      evidence,
      verdict: verdictParsed,
      engine: "openai-gpt-4o",
    });
  } catch (err: any) {
    // If OpenAI call fails or times out, fallback to heuristic verdict rather than crashing
    const heuristicVerdict = evaluateDisputeHeuristically(evidence);
    return NextResponse.json({
      evidence,
      verdict: heuristicVerdict,
      engine: "heuristic-fallback",
      warning: `LLM evaluation unavailable (${err.message || String(err)}); used deterministic evaluation engine.`,
    });
  }
}
