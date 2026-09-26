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
- `submit_milestone` — freelancer marks a milestone as delivered
- `approve_milestone` — client approves and releases payout for that milestone; updates the freelancer's `ReputationRecord`
- `reject_milestone` — client rejects with a reason (max 200 chars); milestone can be resubmitted
- `raise_dispute` — either party can freeze a milestone in a `Disputed` state pending resolution
- `resolve_dispute` — bilateral or unilateral resolution: client can release funds to freelancer, freelancer can refund to client, or both can mutually agree to split funds 50/50
- `initialize_config` & `update_config` — protocol fee configuration PDA allowing admin to set sustainable protocol fees (capped at 10% / 1000 bps) and recipient, with payment hooks in approvals and dispute splits
- Milestones must be settled in order (a milestone can't be submitted until the previous one is settled or approved)
- Full happy-path and error-path test coverage; a non-transferable verification badge (`badge.rs`) is scaffolded for completed freelancers using Token-2022

**Frontend (`/app`)** — Next.js app, in progress:
- Routes scaffolded for `dashboard`, `hire`, `contract`, and `profile` flows
- Anchor IDL wired in for on-chain calls
- Early frontend test coverage
- `src/agent/` — a reputation-lookup agent (early stage, see To-dos)

## To-do / roadmap

- [ ] Finish client and freelancer dashboard UI (motion/react + Tailwind)
- [ ] Wire up the full contract lifecycle in the frontend: create → submit → approve/reject → dispute → resolve
- [ ] Decide and implement the reputation-lookup agent's access model (open chatbot vs. restricted to registered clients/freelancers)
- [ ] Wire the non-transferable badge mint into the approval flow end-to-end
- [x] Basic dispute-resolution path (unilateral release/refund, or mutual split agreement)
- [x] Protocol fee configuration & monetization hooks (capped at 10% max fee)
- [ ] Mainnet deployment plan
- [ ] Public reputation lookup — let any platform or client query a wallet's `ReputationRecord`

## Status

Devnet only. Not audited. Actively building toward the MLH x Solana grant milestone.
