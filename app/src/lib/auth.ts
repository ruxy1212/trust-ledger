import crypto from "crypto";
import { PublicKey } from "@solana/web3.js";

export const AUTH_MESSAGE_PREFIX = "Trust Ledger Agent Authentication\nNonce: ";
export const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

// Ed25519 SPKI DER prefix: 302a300506032b6570032100 (12 bytes)
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export interface VerifyWalletAuthParams {
  wallet: string;
  signature: string;
  timestamp: number;
}

export interface AuthVerificationResult {
  valid: boolean;
  error?: string;
  wallet?: string;
}

export function createAuthMessage(timestamp: number): string {
  return `${AUTH_MESSAGE_PREFIX}${timestamp}`;
}

/**
 * Verifies that a signed message originates from the claimed Solana wallet address
 * and is within the allowed clock drift tolerance to prevent replay attacks.
 */
export function verifyWalletAuth(params: VerifyWalletAuthParams): AuthVerificationResult {
  const { wallet, signature, timestamp } = params;

  if (!wallet || typeof wallet !== "string") {
    return { valid: false, error: "Missing wallet address" };
  }

  if (!signature || typeof signature !== "string") {
    return { valid: false, error: "Missing cryptographic signature" };
  }

  if (!timestamp || typeof timestamp !== "number" || isNaN(timestamp)) {
    return { valid: false, error: "Invalid authentication timestamp" };
  }

  // Prevent replay attacks
  const now = Date.now();
  if (Math.abs(now - timestamp) > MAX_TIMESTAMP_DRIFT_MS) {
    return {
      valid: false,
      error: "Authentication expired or timestamp drifted beyond allowed 5-minute window",
    };
  }

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(wallet);
  } catch {
    return { valid: false, error: "Invalid Solana wallet address format" };
  }

  try {
    const message = createAuthMessage(timestamp);
    const messageBuf = Buffer.from(message, "utf8");

    // Construct SPKI DER for Ed25519 public key
    const spkiKey = Buffer.concat([ED25519_SPKI_PREFIX, pubkey.toBuffer()]);
    const cryptoKey = crypto.createPublicKey({
      key: spkiKey,
      format: "der",
      type: "spki",
    });

    const sigBuf =
      signature.length === 128
        ? Buffer.from(signature, "hex")
        : Buffer.from(signature, "base64");

    if (sigBuf.length !== 64) {
      return { valid: false, error: "Invalid signature length (expected 64 bytes)" };
    }

    const isValid = crypto.verify(null, messageBuf, cryptoKey, sigBuf);
    if (!isValid) {
      return { valid: false, error: "Signature verification failed" };
    }

    return { valid: true, wallet: pubkey.toBase58() };
  } catch (err: any) {
    return { valid: false, error: `Verification error: ${err.message || String(err)}` };
  }
}

/**
 * Extracts authentication details from request headers or body payload.
 */
export function extractWalletAuth(req: Request, body?: any): VerifyWalletAuthParams | null {
  const headerWallet = req.headers.get("x-wallet-address");
  const headerSig = req.headers.get("x-wallet-signature");
  const headerTs = req.headers.get("x-wallet-timestamp");

  if (headerWallet && headerSig && headerTs) {
    const timestamp = parseInt(headerTs, 10);
    return {
      wallet: headerWallet,
      signature: headerSig,
      timestamp,
    };
  }

  if (body?.auth?.wallet && body?.auth?.signature && body?.auth?.timestamp) {
    return {
      wallet: body.auth.wallet,
      signature: body.auth.signature,
      timestamp: Number(body.auth.timestamp),
    };
  }

  return null;
}
