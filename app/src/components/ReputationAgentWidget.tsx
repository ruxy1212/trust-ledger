"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type ChatMessage = {
  role: "user" | "assistant" | "error";
  text: string;
};

/**
 * Floating chat widget for the reputation-lookup agent. Talks to the
 * existing /api/agent route (system prompt, rate limiting, and the
 * check_reputation tool loop already live there) — this component is the
 * missing "the rest of it" the plan called for.
 *
 * Mounted once, globally, in app/layout.tsx, since the agent is
 * intentionally public and login-free (see plan.md section 10).
 */
export function ReputationAgentWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
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

  async function send() {
    const message = input.trim();
    if (!message || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: message }]);
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
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
    <div className="fixed bottom-6 right-6 z-30">
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
              {messages.length === 0 && (
                <p className="text-alter-secondary mt-16 text-center text-sm">
                  Paste a wallet address, or ask something like &ldquo;how many milestones has
                  this freelancer completed?&rdquo;
                </p>
              )}
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
                placeholder="Wallet address or a question…"
                maxLength={500}
                className="w-full rounded-sm border border-primary bg-elevated px-2 py-1.5 text-sm text-alter-primary outline-none focus-visible:border-primary"
              />
              <button
                type="submit"
                disabled={loading || input.trim().length === 0}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ask
              </button>
            </form>
          </motion.div>
        ):(
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
