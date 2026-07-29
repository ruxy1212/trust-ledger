import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@anchor-lang/core";
import { IDL } from "@/types/idl";
import { deriveProfilePda, deriveReputationPda } from "@/lib/pda";
import { checkRateLimit, callerKey } from "@/lib/rate-limit";
import { freelancerProfiles, reputationRecords } from "@/types/accounts";

const connection = new Connection(process.env.RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
const program = new Program(IDL, { connection });

// Generous relative to the agent route below, since this is the direct,
// LLM-free path most of the app's own pages should be using.
const LIMIT = 60;
const WINDOW_MS = 60_000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const key = callerKey(req);
  const rate = checkRateLimit(key, LIMIT, WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limited. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
    );
  }

  const { wallet } = await params;

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "Not a valid Solana address." }, { status: 400 });
  }

  const [profile, reputation] = await Promise.all([
    freelancerProfiles(program).fetchNullable(deriveProfilePda(pubkey)),
    reputationRecords(program).fetchNullable(deriveReputationPda(pubkey)),
  ]);

  return NextResponse.json({
    wallet: pubkey.toBase58(),
    displayName: profile?.displayName ?? null,
    completedCount: reputation?.completedCount ?? 0,
    disputedCount: reputation?.disputedCount ?? 0,
  });
}
