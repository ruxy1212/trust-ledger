import { assert } from "chai";
import crypto from "crypto";
import { Keypair } from "@solana/web3.js";
import {
  verifyWalletAuth,
  createAuthMessage,
  extractWalletAuth,
  MAX_TIMESTAMP_DRIFT_MS,
} from "../lib/auth";
import { checkRateLimit, callerKey } from "../lib/rate-limit";

describe("auth and rate-limit utilities", () => {
  describe("wallet signature verification", () => {
    it("successfully verifies a valid Ed25519 wallet signature", () => {
      const keypair = Keypair.generate();
      const timestamp = Date.now();
      const message = createAuthMessage(timestamp);

      // Sign with Solana Keypair private key using Node.js crypto
      const privateKeyDER = Buffer.concat([
        Buffer.from("302e020100300506032b657004220420", "hex"),
        Buffer.from(keypair.secretKey.subarray(0, 32)),
      ]);
      const privateKeyObj = crypto.createPrivateKey({
        key: privateKeyDER,
        format: "der",
        type: "pkcs8",
      });

      const signature = crypto.sign(null, Buffer.from(message, "utf8"), privateKeyObj);
      const signatureBase64 = signature.toString("base64");

      const result = verifyWalletAuth({
        wallet: keypair.publicKey.toBase58(),
        signature: signatureBase64,
        timestamp,
      });

      assert.isTrue(result.valid);
      assert.equal(result.wallet, keypair.publicKey.toBase58());
    });

    it("rejects an invalid or tampered signature", () => {
      const keypair = Keypair.generate();
      const timestamp = Date.now();

      // Corrupted signature bytes (64 zero bytes)
      const corruptedSignature = Buffer.alloc(64, 0).toString("base64");

      const result = verifyWalletAuth({
        wallet: keypair.publicKey.toBase58(),
        signature: corruptedSignature,
        timestamp,
      });

      assert.isFalse(result.valid);
      assert.include(result.error ?? "", "failed");
    });

    it("rejects authentication with expired timestamp exceeding drift window", () => {
      const keypair = Keypair.generate();
      const expiredTimestamp = Date.now() - (MAX_TIMESTAMP_DRIFT_MS + 10_000);
      const fakeSig = Buffer.alloc(64, 1).toString("base64");

      const result = verifyWalletAuth({
        wallet: keypair.publicKey.toBase58(),
        signature: fakeSig,
        timestamp: expiredTimestamp,
      });

      assert.isFalse(result.valid);
      assert.include(result.error ?? "", "expired");
    });

    it("rejects malformed wallet address format", () => {
      const result = verifyWalletAuth({
        wallet: "not-a-valid-solana-address!!!",
        signature: Buffer.alloc(64, 1).toString("base64"),
        timestamp: Date.now(),
      });

      assert.isFalse(result.valid);
      assert.include(result.error ?? "", "Invalid Solana wallet");
    });

    it("extracts wallet auth parameters from headers and body", () => {
      const reqWithHeaders = new Request("http://localhost/api/agent", {
        headers: {
          "x-wallet-address": "7NXba6ZqLw87Buhc16",
          "x-wallet-signature": "sig123",
          "x-wallet-timestamp": "1700000000",
        },
      });

      const extracted = extractWalletAuth(reqWithHeaders);
      assert.deepEqual(extracted, {
        wallet: "7NXba6ZqLw87Buhc16",
        signature: "sig123",
        timestamp: 1700000000,
      });

      const reqWithoutHeaders = new Request("http://localhost/api/agent");
      const extractedFromBody = extractWalletAuth(reqWithoutHeaders, {
        auth: {
          wallet: "7NXba6ZqLw87Buhc16",
          signature: "sig456",
          timestamp: 1700000050,
        },
      });
      assert.deepEqual(extractedFromBody, {
        wallet: "7NXba6ZqLw87Buhc16",
        signature: "sig456",
        timestamp: 1700000050,
      });
    });
  });

  describe("rate limiting", () => {
    it("enforces in-memory request limits and blocks when exceeded", async () => {
      const key = `test-client-${Date.now()}`;
      const limit = 3;
      const windowMs = 500;

      const res1 = await checkRateLimit(key, limit, windowMs);
      assert.isTrue(res1.allowed);
      assert.equal(res1.remaining, 2);

      const res2 = await checkRateLimit(key, limit, windowMs);
      assert.isTrue(res2.allowed);
      assert.equal(res2.remaining, 1);

      const res3 = await checkRateLimit(key, limit, windowMs);
      assert.isTrue(res3.allowed);
      assert.equal(res3.remaining, 0);

      // 4th request must be blocked
      const res4 = await checkRateLimit(key, limit, windowMs);
      assert.isFalse(res4.allowed);
      assert.equal(res4.remaining, 0);
    });

    it("resets rate limit allowance after window expires", async () => {
      const key = `test-reset-${Date.now()}`;
      const limit = 1;
      const windowMs = 50;

      const res1 = await checkRateLimit(key, limit, windowMs);
      assert.isTrue(res1.allowed);

      const res2 = await checkRateLimit(key, limit, windowMs);
      assert.isFalse(res2.allowed);

      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 60));

      const res3 = await checkRateLimit(key, limit, windowMs);
      assert.isTrue(res3.allowed);
    });

    it("extracts best-effort caller IP from standard headers", () => {
      const reqCf = new Request("http://localhost", {
        headers: { "cf-connecting-ip": "1.2.3.4" },
      });
      assert.equal(callerKey(reqCf), "1.2.3.4");

      const reqReal = new Request("http://localhost", {
        headers: { "x-real-ip": "5.6.7.8" },
      });
      assert.equal(callerKey(reqReal), "5.6.7.8");

      const reqFwd = new Request("http://localhost", {
        headers: { "x-forwarded-for": "9.10.11.12, 192.168.1.1" },
      });
      assert.equal(callerKey(reqFwd), "9.10.11.12");

      const reqEmpty = new Request("http://localhost");
      assert.equal(callerKey(reqEmpty), "unknown");
    });
  });
});
