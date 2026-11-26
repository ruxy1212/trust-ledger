# Trust Ledger

An on-chain milestone escrow, AI-arbitrated dispute resolution protocol, and portable reputation layer for freelance work, built on the Solana blockchain.

Started as a capstone for MLH's **100 Days of Solana**. Now extended into a full service-exchange protocol with anti-fraud ceilings, multi-currency escrow, and autonomous AI dispute arbitration.

## The Problem

Freelance platforms today hold the money, hold the reputation, and take steep 5–20% cuts. If a client ghosts after delivery or a dispute arises, freelancers have little recourse, and subjective disagreements often lead to frozen funds. Furthermore, a freelancer's track record disappears the moment they leave that platform.

## What Trust Ledger Does

- **Trustless Multi-Currency Escrow:** Clients fund contracts in either **Native SOL** or **Devnet USDC** (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). Escrow funds are managed on-chain via PDA vaults and released only upon milestone approval or settlement.
- **Service Exchange Primitives:** Contracts are not empty financial counters: they store verified milestone specifications (up to 10 milestones) and require verifiable deliverables (GitHub commit hashes, PR URLs, or preview links) upon submission.
- **AI Arbiter Agent with Certainty Scoring:** Autonomous dispute analysis engine that fetches GitHub commit diffs and modified files, cross-references them against agreed milestone scopes, evaluates client rejection claims, and outputs an objective verdict (`release_to_freelancer`, `refund_to_client`, or `split`) with a **Certainty Score (`0.00`–`1.00`)**.
- **Anti-Fraud Ceilings & Safeguards:** Hard-coded limits prevent runaway drains and malicious exploits (`MAX_ESCROW_LAMPORTS` = 100 SOL, `MAX_ESCROW_USDC` = 50,000 USDC) alongside anti-farming minimums (`MIN_ESCROW_LAMPORTS` = 0.01 SOL, `MIN_ESCROW_USDC` = 1 USDC) and self-contract prevention.
- **Portable On-Chain Reputation:** Every completed contract updates a public `ReputationRecord` (tracking completed counts, disputed counts, volume earned, and value-weighted scores) and mints a non-transferable Token-2022 soulbound badge to the freelancer's wallet.

Settlement runs on Solana with sub-cent transaction fees and instant finality.

## Repository Structure

```
trust-ledger/
├── program/     Anchor program (Rust) — escrow, multi-token CPIs, reputation, and badges
├── idls/        Compiled Anchor IDL for trust_ledger
└── app/         Next.js 16 frontend — hire flow, milestone tracker, AI Arbiter card, and API
    ├── src/agent/tools/   Dispute evidence aggregator & GitHub diff analyzer
    ├── src/app/api/       Wallet-authenticated AI Arbiter & reputation endpoints
    └── src/components/    Interactive milestone tracker & Arbiter recommendation card
```

## What's Implemented

### Program (`/program`) — Deployed & Tested on Devnet (`E68AQePth8MVtn2aHax23c6BWye8Mnw2fkDzCyTfqNEk`)
- **`create_profile`**: Freelancer registers an on-chain display name profile PDA.
- **`create_contract`**: Client funds a contract with milestone descriptions and optional `token_mint`:
  - Enforces minimum floors (0.01 SOL / 1 USDC) and maximum anti-fraud ceilings (100 SOL / 50,000 USDC).
  - Routes transfers through System Program (for SOL) or SPL Token `transfer_checked` (for Devnet USDC).
- **`submit_milestone`**: Freelancer submits milestone deliverable proof URI (GitHub commit/PR URL, max 200 chars).
- **`approve_milestone`**: Client approves deliverable; releases payout (and optional protocol fee) to freelancer ATA/wallet, increments reputation volume, and mints a non-transferable Token-2022 soulbound badge on first completion.
- **`reject_milestone`**: Client rejects deliverable with recorded rationale (max 200 chars).
- **`raise_dispute`**: Client or freelancer freezes a disputed milestone in `Disputed` state.
- **`resolve_dispute`**: Settles disputed escrow via unilateral concession (client release / freelancer refund) or mutual 50/50 split, with multi-currency SPL Token vault CPI transfers.
- **`initialize_config` & `update_config`**: Protocol fee management (capped at 10% / 1000 bps) with configurable recipient PDA.
- Comprehensive test suite covering 30 integration tests in `tests/trust-ledger.ts` and `app/src/tests/trust-ledger.test.ts`.

### Frontend & AI Arbiter (`/app`)
- **Multi-Currency Hire Flow (`/hire`)**: Currency toggle (SOL vs USDC), dynamic milestone specification builder, and real-time spending warnings.
- **Interactive Milestone Tracker (`/contract/[pda]`)**: Visual progress bar, deliverable submission modal, proof links, and dispute controls.
- **AI Arbiter Dispute Card (`ArbiterCard.tsx`)**:
  - Ed25519 cryptographic wallet signature authentication preventing unauthorized API calls and replay attacks.
  - Interactive Certainty Gauge (color-coded Emerald `≥85%`, Amber `≥65%`, Rose `<65%`).
  - Structured evidence breakdown comparing agreed scope, submitted GitHub diffs, and client rejection claims.
  - One-click on-chain settlement trigger directly executing `resolveDispute`.
- **Backend API Routes (`/api/arbiter` & `/api/agent`)**:
  - GitHub REST API diff retrieval for public repos, commit hashes, and pull requests.
  - Durable rate limiting (Upstash Redis with in-memory fallback).
  - Impartial judicial evaluation prompt powered by OpenAI (`gpt-4o-mini`) with deterministic heuristic fallback.

## Verification & Test Suite

Run integration tests against localnet or devnet:

```bash
# Verify Anchor Rust program compilation
cargo check --manifest-path program/Cargo.toml

# Run TypeScript Mocha integration tests (30 tests)
npm test
```

## Roadmap & Checklist

### Completed (v1 & v2)
- [x] Workspace & build standardization (Anchor + pnpm workspace)
- [x] Anti-farming & self-contracting protocol constraints (`MIN_ESCROW_LAMPORTS`, `MIN_MILESTONE_PAYOUT_LAMPORTS`)
- [x] Value-weighted reputation metrics (`earned_volume`, `reputation_score`)
- [x] Dual-party dispute initiation rights (client and freelancer)
- [x] On-chain dispute resolution flow (unilateral release/refund, mutual 50/50 split)
- [x] Protocol fee configuration & monetization hooks (capped at 10% max fee)
- [x] Non-transferable soulbound badge minting using Token-2022
- [x] Service exchange primitives (on-chain milestone descriptions and deliverable proof URIs)
- [x] Anti-fraud safety ceilings (`MAX_ESCROW_LAMPORTS`, `MAX_ESCROW_USDC`)
- [x] Multi-currency escrow (Devnet USDC SPL Token vault PDAs with 6 vs 9 decimal handling)
- [x] AI Arbiter Agent engine with GitHub code diff inspection and Certainty Scoring (`0.00`–`1.00`)
- [x] Arbiter UI card with one-click on-chain dispute settlement
- [x] Frontend multi-currency selector and real-time spending warnings

### Upcoming (v3)
- [ ] Automated Oracle settlement for ultra-high certainty disputes (>0.95)
- [ ] Public Reputation Query API for third-party marketplace integrations
- [ ] Mainnet deployment, formal security audit, and production token list support

## Status

Devnet only. Not audited. Actively building toward mainnet readiness.
