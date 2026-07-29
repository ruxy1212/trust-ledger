import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@anchor-lang/core";
import { IDL } from "@/types/idl";
import { freelancerProfiles, reputationRecords } from "@/types/accounts";
import { deriveProfilePda, deriveReputationPda } from "@/lib/pda";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

const connection = new Connection(
  process.env.RPC_URL ?? "https://api.devnet.solana.com",
  "confirmed"
);
const program = new Program(IDL, { connection });

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_reputation",
      description:
        "Get the profile and reputation (milestones completed, milestones disputed) of a freelancer wallet address on the Trust Ledger program. Takes a single Solana wallet address.",
      parameters: {
        type: "object",
        properties: {
          walletAddress: {
            type: "string",
            description: "Base58 freelancer wallet address",
          },
        },
        required: ["walletAddress"],
        additionalProperties: false,
      },
    },
  },
];

/**
 * A freelancer's display_name is arbitrary user input that round-trips
 * through the LLM as a tool result. Strip anything that isn't printable
 * text before it's allowed anywhere near a prompt — this is the one field
 * in this whole tool that isn't program-controlled data.
 */
function sanitizeDisplayName(name: string): string {
  const stripped = name.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return stripped.slice(0, 50) || "Unnamed freelancer";
}

export async function runAgentTool(name: string, input: { walletAddress: string }): Promise<string> {
  if (name !== "check_reputation") {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  try {
    const walletPubkey = new PublicKey(input.walletAddress);

    const [profile, reputation] = await Promise.all([
      freelancerProfiles(program).fetchNullable(deriveProfilePda(walletPubkey)),
      reputationRecords(program).fetchNullable(deriveReputationPda(walletPubkey)),
    ]);

    const displayName = profile ? sanitizeDisplayName(profile.displayName) : "Unregistered freelancer";
    const completedCount = reputation?.completedCount ?? 0;
    const disputedCount = reputation?.disputedCount ?? 0;

    return JSON.stringify({
      wallet: walletPubkey.toBase58(),
      displayName,
      completedCount,
      disputedCount,
      reputationSummary: `${displayName} (${walletPubkey.toBase58()}) has completed ${completedCount} milestone(s) and has ${disputedCount} disputed milestone(s).`,
    });
  } catch (err) {
    return JSON.stringify({
      error: `Failed to retrieve reputation: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
