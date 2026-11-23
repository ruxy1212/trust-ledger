# Trust Ledger

An on-chain milestone escrow and portable reputation for freelance work, built on Solana blockchain network.

Started as a capstone for MLH's **100 Days of Solana**. Now being extended into a real product.

## The problem

Freelance platforms today hold the money, hold the reputation, and take the cut. If a client ghosts after delivery, or a platform freezes a payout, the freelancer has little recourse, and often times, their track record disappears the moment they leave that platform.

## What Trust Ledger does

- **Trustless milestone escrow.** A client funds a contract on-chain. Funds release only when both sides confirm a milestone — no platform custody, no chargebacks, no "payment pending review."
- **Portable reputation.** Every completed contract updates a public `ReputationRecord` tied to the freelancer's wallet — not to any one platform. That record travels with them.
- **Built for more than just freelancers.** The same escrow primitive applies to contributor bounties, DAO payroll, and any relationship where one party pays another for milestone-based work.

Settlement runs on Solana, so fees are sub-cent per transaction — a non-issue next to the 5–20% cuts incumbent marketplaces take.

## Repository structure

```
trust-ledger/
├── program/     Anchor program (Rust) — the on-chain escrow + reputation logic
└── app/         Next.js frontend — client & freelancer flows, reputation-lookup agent
```

## What's implemented

**Program (`/program`)** — deployed and tested on devnet (`E68AQePth8MVtn2aHax23c6BWye8Mnw2fkDzCyTfqNEk`):
- `create_profile` — freelancer registers a public profile
- `create_contract` — client funds a contract with up to 10 milestones, split into a base payout + remainder
  - Anti-farming safeguards: self-contracting (`client == freelancer`) is blocked, minimum escrow floor (0.01 SOL), and minimum milestone payout floor (0.002 SOL)
- `submit_milestone` — freelancer marks a milestone as delivered
- `approve_milestone` — client approves and releases payout for that milestone; updates the freelancer's `ReputationRecord` (accumulates `earned_volume` and value-weighted `reputation_score`)
- `reject_milestone` — client rejects with a reason (max 200 chars); milestone can be resubmitted
- `raise_dispute` — either party (client or freelancer) can freeze a milestone in a `Disputed` state pending resolution
- `resolve_dispute` — bilateral or unilateral resolution: client can unilaterally release funds to freelancer, freelancer can unilaterally refund to client, or both can mutually agree to split funds 50/50
- `initialize_config` & `update_config` — protocol fee configuration PDA allowing admin to set sustainable protocol fees (capped at 10% / 1000 bps) and recipient, with payment hooks in milestone approvals and dispute splits
- Milestones must be settled in order (a milestone can't be submitted until the previous one is settled or approved)
- Full happy-path and error-path test coverage (26 integration tests in `/tests`); a non-transferable verification badge (`badge.rs`) is scaffolded for completed freelancers using Token-2022

**Frontend & Agent (`/app`)** — Next.js app:
- Routes scaffolded for `dashboard`, `hire`, `contract`, and `profile` flows
- Anchor IDL and account schemas synchronized with on-chain dispute and reputation state
- `src/agent/` — reputation-lookup AI assistant guarded by Ed25519 Solana wallet signature authentication and durable rate-limiting (Upstash Redis + in-memory fallback)
- Integration test coverage in `/app/src/tests/`

## Roadmap & Checklist

### Implemented (v1)
- [x] Workspace & build standardization (Anchor + pnpm workspace)
- [x] Anti-farming & self-contracting protocol constraints (`MIN_ESCROW_LAMPORTS`, `MIN_MILESTONE_PAYOUT_LAMPORTS`)
- [x] Value-weighted reputation metrics (`earned_volume`, `reputation_score`)
- [x] Dual-party dispute initiation rights (client and freelancer)
- [x] On-chain dispute resolution flow (unilateral release/refund, mutual 50/50 split)
- [x] Protocol fee configuration & monetization hooks (capped at 10% max fee)
- [x] Agent security hardening: Ed25519 wallet auth, timestamp replay protection, durable rate limiting

### Upcoming (v2 — see [v2-plan.md](v2-plan.md))
- [ ] **Service Exchange Primitives:** On-chain milestone scope descriptions in `create_contract` and verifiable deliverable proofs (Git commit/PR URLs, live previews) in `submit_milestone`
- [ ] **Anti-Fraud & Spending Limits:** Hard caps on maximum escrow size (`MAX_ESCROW_LAMPORTS`, `MAX_ESCROW_USDC`) and velocity rate limits
- [ ] **Multi-Currency Escrow:** Devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) SPL Token vault support alongside native SOL
- [ ] **AI Arbiter Agent:** Autonomous dispute analysis fetching Git diffs/deliverable proof, comparing with scope, and scoring certainty (0.00–1.00)
- [ ] **Arbiter-Assisted Settlement:** One-click on-chain settlement from Arbiter recommendations
- [ ] **Frontend Lifecycle Integration:** Complete end-to-end interactive UI for contract creation, deliverable submission modal, milestone dispute, and resolution
- [ ] **Token-2022 Badge Integration:** Complete automated non-transferable reputation badge minting in frontend flow
- [ ] **Public Reputation API:** Open query endpoint for third-party platforms to query a wallet's `ReputationRecord`
- [ ] **Mainnet Deployment Plan:** Formal audits and mainnet-beta configuration

## Status

Devnet only. Not audited. Actively building toward.
