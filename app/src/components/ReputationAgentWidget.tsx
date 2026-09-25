"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createAuthMessage } from "@/lib/auth";

type ChatMessage = {
  role: "user" | "assistant" | "error";
  text: string;
};

/**
 * Floating chat widget for the reputation-lookup agent.
 * Connects to /api/agent with authenticated wallet signature verification
 * and durable rate limiting to protect LLM quota.
 */
export function ReputationAgentWidget() {
  const { publicKey, signMessage, connected } = useWallet();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [cachedAuth, setCachedAuth] = useState<{
    wallet: string;
    signature: string;
    timestamp: number;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  // Invalidate cached auth when wallet disconnects or switches accounts
  useEffect(() => {
    if (!connected || !publicKey) {
      setCachedAuth(null);
    } else if (cachedAuth && cachedAuth.wallet !== publicKey.toBase58()) {
      setCachedAuth(null);
    }
  }, [connected, publicKey, cachedAuth]);

  async function send() {
    const message = input.trim();
    if (!message || loading) return;

    if (!connected || !publicKey) {
      setMessages((m) => [
        ...m,
        {
          role: "error",
          text: "Please connect your Solana wallet to chat with the AI assistant.",
        },
      ]);
      return;
    }

    let auth = cachedAuth;
    const now = Date.now();

    // Re-authenticate if no cached auth or cache is older than 4 minutes
    if (!auth || auth.wallet !== publicKey.toBase58() || now - auth.timestamp > 4 * 60 * 1000) {
      if (!signMessage) {
        setMessages((m) => [
          ...m,
          { role: "error", text: "Your connected wallet does not support message signing." },
        ]);
        return;
      }

      setLoading(true);
      try {
        const timestamp = now;
        const msgToSign = createAuthMessage(timestamp);
        const encoded = new TextEncoder().encode(msgToSign);
        const sigBytes = await signMessage(encoded);
        const signature = Buffer.from(sigBytes).toString("base64");
        auth = { wallet: publicKey.toBase58(), signature, timestamp };
        setCachedAuth(auth);
      } catch {
        setLoading(false);
        setMessages((m) => [
          ...m,
          {
            role: "error",
            text: "Wallet signature rejected. Authentication is required to chat with the AI.",
          },
        ]);
        return;
      }
    }

    setInput("");
    setMessages((m) => [...m, { role: "user", text: message }]);
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": auth.wallet,
          "x-wallet-signature": auth.signature,
          "x-wallet-timestamp": String(auth.timestamp),
        },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setCachedAuth(null);
        }
        setMessages((m) => [...m, { role: "error", text: data.error ?? "Something went wrong." }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: data.reply ?? "No response." }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "error", text: "Network error — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 left-6 z-30">
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className="glass-card backdrop-blur-md mb-3 flex h-96 w-80 flex-col rounded-lg border border-border p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-alter-primary">Reputation lookup</span>
              <button
                onClick={() => setOpen(false)}
                className="text-error hover:text-alter-primary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
              {!connected ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
                  <p className="text-alter-secondary text-xs">
                    Connect your wallet to authenticate and chat with the AI assistant.
                  </p>
                  <WalletMultiButton />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-alter-secondary mt-16 text-center text-sm">
                  Paste a wallet address, or ask something like &ldquo;how many milestones has
                  this freelancer completed?&rdquo;
                </p>
              ) : null}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-6 rounded-md bg-primary/20 px-3 py-2 text-alter-primary"
                      : m.role === "error"
                      ? "mr-6 rounded-md border border-error/40 px-3 py-2 text-error"
                      : "mr-6 rounded-md bg-elevated px-3 py-2 text-alter-secondary"
                  }
                >
                  <div className="overflow-hidden">{m.text}</div>
                </div>
              ))}
              {loading && (
                <div className="mr-6 rounded-md bg-elevated px-3 py-2 text-alter-muted">
                  <span className="animate-pulse-dot mr-1 inline-block">●</span>
                  thinking…
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="mt-2 flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  connected ? "Wallet address or a question…" : "Connect wallet to chat…"
                }
                disabled={!connected}
                maxLength={500}
                className="w-full rounded-sm border border-primary bg-elevated px-2 py-1.5 text-sm text-alter-primary outline-none focus-visible:border-primary disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!connected || loading || input.trim().length === 0}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ask
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen((o) => !o)}
            className="neon-glow flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg"
            aria-label="Open reputation lookup"
          >
            <span className="saturate-0 brightness-150">{open ? "✕" : "✨"}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
