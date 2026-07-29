"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import BN from "bn.js";
import { lamportsToSol, milestoneStatusName, STATUS_LABEL } from "@/lib/format";

export type Role = "client" | "freelancer" | "viewer";


export type ContractView = {
  milestoneCount: number;
  milestones: unknown[]; // decoded MilestoneStatus enum objects
  rejectionReasons: string[];
  basePayout: BN;
  remainder: BN;
};

export function MilestoneTracker({
  contract,
  role,
  pendingIndex,
  onSubmit,
  onApprove,
  onReject,
  onDispute,
}: {
  contract: ContractView;
  role: Role;
  pendingIndex: number | null;
  onSubmit: (index: number) => void;
  onApprove: (index: number) => void;
  onReject: (index: number, reason: string) => void;
  onDispute: (index: number) => void;
}) {
  return (
    <ol className="flex flex-col gap-3">
      {contract.milestones.map((status, index) => {
        const payout =
          index === contract.milestoneCount - 1
            ? contract.basePayout.add(contract.remainder)
            : contract.basePayout;

        return (
          <MilestoneRow
            key={index}
            index={index}
            status={milestoneStatusName(status)}
            reason={contract.rejectionReasons[index]}
            payoutSol={lamportsToSol(payout)}
            role={role}
            isPending={pendingIndex === index}
            onSubmit={() => onSubmit(index)}
            onApprove={() => onApprove(index)}
            onReject={(reason) => onReject(index, reason)}
            onDispute={() => onDispute(index)}
          />
        );
      })}
    </ol>
  );
}

function MilestoneRow({
  index,
  status,
  reason,
  payoutSol,
  role,
  isPending,
  onSubmit,
  onApprove,
  onReject,
  onDispute,
}: {
  index: number;
  status: string;
  reason: string;
  payoutSol: number;
  role: Role;
  isPending: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onDispute: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reasonDraft, setReasonDraft] = useState("");

  const isDisputed = status === "disputed";
  const isApproved = status === "approved";

  return (
    <motion.li
      layout
      className="glass-card relative rounded-lg p-5"
      style={{
        filter: isDisputed ? "saturate(0.35)" : undefined,
      }}
      animate={isPending ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
      transition={isPending ? { repeat: Infinity, duration: 1.1 } : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-alter-muted">
              {String(index + 1).padStart(2, "0")}
            </span>
            <StatusPill status={status} />
            {isDisputed && (
              <span className="text-xs text-warning" title="Frozen — resolve off-chain">
                🔒 frozen
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-alter-secondary">
            {STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}
          </p>
        </div>

        <div className="text-right font-mono text-sm text-alter-primary">
          {payoutSol.toFixed(4)} SOL
          {isApproved && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="text-success"
            >
              ✓ paid out
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {reason && (status === "rejected" || status === "disputed") && (
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-sm border border-border bg-elevated px-3 py-2 text-sm text-alter-secondary"
          >
            <span className="text-alter-muted">Reason: </span>
            {reason}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Freelancer actions */}
      {role === "freelancer" && (status === "notSubmitted" || status === "rejected") && (
        <div className="mt-4 flex gap-2">
          <ActionButton onClick={onSubmit} disabled={isPending} primary>
            {status === "rejected" ? "Resubmit" : "Submit milestone"}
          </ActionButton>
          {status === "rejected" && (
            <ActionButton onClick={onDispute} disabled={isPending}>
              Raise dispute instead
            </ActionButton>
          )}
        </div>
      )}

      {/* Client actions */}
      {role === "client" && status === "submitted" && (
        <div className="mt-4">
          {!rejecting ? (
            <div className="flex gap-2">
              <ActionButton onClick={onApprove} disabled={isPending} primary>
                Approve &amp; release {payoutSol.toFixed(4)} SOL
              </ActionButton>
              <ActionButton onClick={() => setRejecting(true)} disabled={isPending}>
                Reject
              </ActionButton>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex flex-col gap-2"
            >
              <textarea
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
                maxLength={200}
                placeholder="What needs to change? (visible to the freelancer, max 200 chars)"
                className="w-full rounded-sm border border-border bg-elevated p-2 text-sm text-alter-primary outline-none focus-visible:border-primary"
                rows={2}
              />
              <div className="flex gap-2">
                <ActionButton
                  onClick={() => {
                    onReject(reasonDraft);
                    setRejecting(false);
                    setReasonDraft("");
                  }}
                  disabled={isPending || reasonDraft.trim().length === 0}
                  primary
                >
                  Send rejection
                </ActionButton>
                <ActionButton onClick={() => setRejecting(false)} disabled={isPending}>
                  Cancel
                </ActionButton>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </motion.li>
  );
}

function StatusPill({ status }: { status: string }) {
  const color: Record<string, string> = {
    notSubmitted: "var(--alter-muted)",
    submitted: "var(--accent)",
    approved: "var(--success)",
    rejected: "var(--warning)",
    disputed: "var(--error)",
  };
  return (
    <motion.span
      layout
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color: color[status],
        background: `color-mix(in srgb, ${color[status]}, transparent 85%)`,
        border: `1px solid ${color[status]}`,
      }}
    >
      {status === "submitted" && (
        <span className="animate-pulse-dot mr-1 inline-block">●</span>
      )}
      {status}
    </motion.span>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={disabled ? undefined : { y: -1 }}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={
        primary
          ? { background: "var(--primary)", color: "white" }
          : {
              background: "transparent",
              color: "var(--alter-primary)",
              border: "1px solid var(--border-bright)",
            }
      }
    >
      {children}
    </motion.button>
  );
}
