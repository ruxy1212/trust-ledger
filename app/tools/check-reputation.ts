import OpenAI from "openai";
import { web3 } from "@anchor-lang/core";

const { Connection, PublicKey } = web3;

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// The tools configuration for the AI Agent
export const tools = [
  {
    type: "function",
    function: {
      name: "check_reputation",
      description: "Get the profile and reputation (milestones completed, milestones disputed, badge details) of a given freelancer wallet address on Solana.",
      parameters: {
        type: "object",
        properties: {
          walletAddress: { type: "string", description: "Base58 freelancer wallet address" },
        },
        required: ["walletAddress"],
        additionalProperties: false,
      },
    },
  },
];

export async function runAgentTool(name: string, input: any, programId: string): Promise<string> {
  if (name === "check_reputation") {
    try {
      const walletPubkey = new PublicKey(input.walletAddress);

      // Find the Reputation PDA
      const [reputationPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation"), walletPubkey.toBuffer()],
        new PublicKey(programId)
      );

      // Find the Profile PDA
      const [profilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("profile"), walletPubkey.toBuffer()],
        new PublicKey(programId)
      );

      // Find Badge Mint PDA
      const [badgeMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("badge"), walletPubkey.toBuffer()],
        new PublicKey(programId)
      );

      // Retrieve account info
      const profileInfo = await connection.getAccountInfo(profilePda);
      const reputationInfo = await connection.getAccountInfo(reputationPda);
      const badgeMintInfo = await connection.getAccountInfo(badgeMintPda);

      let displayName = "Unregistered Freelancer";
      let completedCount = 0;
      let disputedCount = 0;
      let hasBadge = badgeMintInfo !== null;

      // Simplistic deserialization (mock/manual offsets or anchor decoder can be used)
      // Since this is run inside the agent environment, we summarize the status.
      // E.g., if reputation account exists:
      if (reputationInfo) {
        // First 8 bytes are Anchor discriminator, followed by completed_count (u32, 4 bytes) and disputed_count (u32, 4 bytes)
        const data = reputationInfo.data;
        completedCount = data.readUInt32LE(8);
        disputedCount = data.readUInt32LE(12);
      }

      if (profileInfo) {
        // Profile contains: freelancer (32 bytes), display_name (String: 4 bytes length prefix + chars)
        const data = profileInfo.data;
        const nameLen = data.readUInt32LE(8 + 32);
        displayName = data.slice(8 + 32 + 4, 8 + 32 + 4 + nameLen).toString("utf8");
      }

      return JSON.stringify({
        wallet: input.walletAddress,
        displayName,
        completedCount,
        disputedCount,
        hasBadge,
        reputationSummary: `${displayName} (${input.walletAddress}) has completed ${completedCount} milestones and has ${disputedCount} disputed milestone(s). Badge status: ${hasBadge ? "Awarded" : "Not yet awarded"}.`
      });

    } catch (err: any) {
      return JSON.stringify({ error: `Failed to retrieve reputation: ${err.message}` });
    }
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` });
}
