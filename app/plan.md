# Proof of Ship: Freelance Escrow & Reputation Passport [Trust Ledger]

**Capstone project plan — 100 Days of Solana**

A devnet program that lets a client and a freelancer run a milestone-based contract on chain: funds are locked in a vault, milestones move through a review cycle (submit → approve or reject → optional dispute), and a freelancer's track record accumulates in a public, portable reputation record with a non-transferable badge to match.

---

## 1. What this project deliberately does and does not do

- **Does:** hold funds in escrow, enforce who can submit/approve/reject a milestone, record a tamper-proof history of completions and disputes, expose that history to anyone (frontend, agent, or raw Explorer lookup).
- **Does not:** adjudicate a dispute. No wallet, program, or agent decides who was "right." A dispute freezes the milestone; resolving it is a human conversation (or a future v2 feature where an arbiter wallet gets added to the contract). This boundary is stated on purpose, not a gap we missed.

---

## 2. User flow, plain language

0. **(Optional) Freelancer creates a profile.** Before any contract exists, a freelancer can sign a one-time `create_profile(display_name)` transaction, creating a `FreelancerProfile` PDA seeded by their own wallet. This is not required — a freelancer without a profile can still be hired by pasting their address directly — but it's what makes the dropdown in the next step possible.
1. **Client creates a contract.** They connect their wallet and fill in a form. For the freelancer field, they either pick a name from a dropdown — populated from existing `FreelancerProfile` accounts, each annotated with that freelancer's live reputation, e.g. "Alice — ✓ 3 completed, 0 disputed" — or paste in a wallet address directly for someone who hasn't made a profile yet. They set the total amount and number of milestones, then sign one transaction. Their SOL moves into a vault the program controls. Their wallet is now permanently recorded as `contract.client`, and the address they selected or entered is recorded as `contract.freelancer`. Picking from the dropdown also removes the risk of a typo locking funds to the wrong address.
2. **Freelancer opens the contract link.** They connect their own wallet. The app compares the connected wallet to `contract.freelancer` stored on chain — if it matches, they see the freelancer view (a "submit milestone" button); if not, they see nothing actionable. This comparison, not a role picker, is what decides which UI renders.
3. **Freelancer submits a milestone.** Status moves `NotSubmitted → Submitted`.
4. **Client reviews it — two paths:**
   - **Approve:** funds for that milestone leave the vault to the freelancer's wallet in the same transaction that also bumps the freelancer's `completed_count` by 1. If this is their very first completed milestone ever, the same transaction mints them a non-transferable badge NFT.
   - **Reject (with a reason):** status moves to `Rejected`, funds stay untouched in the vault, nothing happens to reputation.
5. **After a rejection, two paths:**
   - Freelancer fixes the work and resubmits → back to step 4.
   - Freelancer disagrees and raises a dispute → status moves to `Disputed`, `disputed_count` increments, and the milestone is now frozen — neither approve nor reject can touch it until the two parties resolve it off chain.
6. **The badge and the count live separately.** The NFT is minted once and never changes again — it just proves "this wallet has completed at least one contract." The number next to it ("3 completed, 1 disputed") comes from reading the separate `ReputationRecord` account, which keeps changing. Anyone — the frontend profile page, or the read-only agent — can look up both by wallet address, because Solana accounts are public by default.

---

## 3. On-chain accounts (PDAs)

| Account | Seeds | Holds |
|---|---|---|
| `FreelancerProfile` | `[b"profile", freelancer.key()]` | freelancer pubkey, display name — optional, created once by the freelancer so they're discoverable in the hire-flow dropdown |
| `Contract` | `[b"contract", client.key(), freelancer.key(), contract_id]` | client pubkey, freelancer pubkey, total `amount`, `milestone_count`, computed `base_payout` (lamports per milestone), per-milestone status array |
| Vault (SOL holder) | `[b"vault", contract.key()]` | escrowed SOL for this contract; program-owned, no private key |
| `ReputationRecord` | `[b"reputation", freelancer.key()]` | `completed_count: u32`, `disputed_count: u32`, one record per freelancer wallet, shared across all their contracts |
| Badge mint (Token-2022) | `[b"badge", freelancer.key()]` | 1-of-1 non-transferable token, minted once, image + name only — no mutable stats |

## 4. Milestone state machine

```rust
pub enum MilestoneStatus {
    NotSubmitted,
    Submitted,
    Approved,
    Rejected,
    Disputed,
}
```

Valid transitions only: `NotSubmitted → Submitted → (Approved | Rejected)`, `Rejected → (Submitted | Disputed)`. Any other transition is rejected by a constraint, not just "not supposed to happen in the UI."

**Payout split.** At `create_contract` time, the program computes `base_payout = amount / milestone_count` using integer lamport division, and `remainder = amount % milestone_count`. Both are stored on the `Contract` account. Every `approve_milestone` call releases `base_payout` lamports — except the last milestone (`index == milestone_count - 1`), which releases `base_payout + remainder`. This guarantees the vault ends at exactly zero once every milestone is approved, with nothing stranded. If `milestone_count == 0`, `create_contract` must reject with `InvalidMilestoneCount` rather than divide by zero.

## 5. Instructions

| Instruction | Required signer | Effect |
|---|---|---|
| `create_profile(display_name)` | freelancer | Creates `FreelancerProfile` PDA seeded by the freelancer's own wallet; optional, only needed to appear in the hire-flow dropdown |
| `create_contract(freelancer, amount, milestone_count)` | client | Creates `Contract` + vault PDAs, moves client's SOL into the vault; computes and stores `base_payout` and `remainder` (see payout split note above) |
| `submit_milestone(index)` | must equal `contract.freelancer` | `NotSubmitted`/`Rejected` → `Submitted` |
| `approve_milestone(index)` | must equal `contract.client` | `Submitted` → `Approved`; CPI-transfers `base_payout` lamports from vault to freelancer (`base_payout + remainder` if this is the final milestone); increments `ReputationRecord.completed_count`; mints badge if count was 0 |
| `reject_milestone(index, reason)` | must equal `contract.client` | `Submitted` → `Rejected`; stores `reason` string; vault untouched |
| `raise_dispute(index)` | must equal `contract.freelancer` | `Rejected` → `Disputed`; increments `ReputationRecord.disputed_count`; freezes further approve/reject on this index |

## 6. Custom errors

| Error | Thrown when |
|---|---|
| `Unauthorized` | Wrong wallet signs an instruction that requires client or freelancer |
| `MilestoneOutOfRange` | `index` doesn't exist on this contract |
| `MilestoneNotSubmitted` | `approve_milestone`/`reject_milestone` called on a milestone that isn't `Submitted` |
| `NotYetRejected` | `raise_dispute` called on a milestone that isn't `Rejected` |
| `MilestoneDisputed` | `approve_milestone`/`reject_milestone` called on a milestone that's `Disputed` |
| `InvalidMilestoneCount` | `create_contract` called with `milestone_count == 0` |

---

## 7. Tests

| # | Test name | What it proves |
|---|---|---|
| 1 | creates a contract and locks funds | Vault balance increases by `amount` after `create_contract` |
| 2 | freelancer submits, client approves, funds release | Happy path — vault empties, freelancer balance increases, `completed_count == 1`, badge NFT now exists |
| 3 | wrong wallet cannot approve | A third random wallet calling `approve_milestone` fails with `Unauthorized` |
| 4 | client rejects a submission with a reason | Status becomes `Rejected`, reason stored, vault untouched, `completed_count` still 0 |
| 5 | freelancer resubmits after rejection and gets approved | `Rejected → Submitted → Approved` works, funds finally release |
| 6 | cannot approve a milestone twice | Re-approving an already-`Approved` index fails with `MilestoneNotSubmitted` |
| 7 | freelancer raises a dispute after rejection | Status becomes `Disputed`, `disputed_count` increments |
| 8 | disputed milestone cannot be approved or rejected | Both instructions fail on a `Disputed` index with `MilestoneDisputed` |
| 9 | badge mints only once across multiple contracts | Complete two separate contracts for the same freelancer; only one badge token exists, `completed_count == 2` |
| 10 | freelancer creates a profile | `FreelancerProfile` PDA exists with the correct display name after `create_profile` |
| 11 | contract works with or without a profile | `create_contract` succeeds identically whether `contract.freelancer` corresponds to an existing `FreelancerProfile` or a bare wallet address — proves the feature is genuinely optional, not secretly required |
| 12 | vault empties exactly after all milestones approve | With an `amount` that doesn't divide evenly by `milestone_count`, confirms the final milestone's payout includes the remainder and the vault balance is exactly 0 after the last approval |

---

## 8. File structure

### On-chain program — `programs/freelance-escrow/src/`

| File | Purpose | Contains |
|---|---|---|
| `lib.rs` | Program entrypoint | Declares the module; lists all five instructions |
| `state.rs` | Account layouts | `Contract`, `ReputationRecord`, `MilestoneStatus` enum |
| `constants.rs` | Seed bytes | `CONTRACT_SEED`, `VAULT_SEED`, `REPUTATION_SEED`, `BADGE_SEED` |
| `errors.rs` | Rejection reasons | `Unauthorized`, `MilestoneOutOfRange`, `MilestoneNotSubmitted`, `NotYetRejected`, `MilestoneDisputed` |
| `instructions/create_profile.rs` | Freelancer opts into discoverability | `create_profile(display_name)` |
| `instructions/create_contract.rs` | Client starts a job | `create_contract(freelancer, amount, milestone_count)` |
| `instructions/submit_milestone.rs` | Freelancer marks work done | `submit_milestone(index)` |
| `instructions/approve_milestone.rs` | Client pays + reputation logic | `approve_milestone(index)` — CPI transfer, counter increment, conditional badge mint |
| `instructions/reject_milestone.rs` | Client sends work back | `reject_milestone(index, reason)` |
| `instructions/raise_dispute.rs` | Freelancer flags an unresolved rejection | `raise_dispute(index)` |

### Tests — `tests/`

| File | Purpose | Contains |
|---|---|---|
| `freelance-escrow.ts` | Proves the program works, both directions | All 9 tests from Section 7 |

### Frontend — Next.js app

| File | Purpose | Contains |
|---|---|---|
| `lib/anchor-client.ts` | Shared program connection | One exported function returning a typed Anchor client |
| `lib/wallet-provider.tsx` | Wallet connect context | Phantom/Solflare adapter setup |
| `lib/fetch-profiles.ts` | Populates the hire dropdown | Runs a `getProgramAccounts` filter for `FreelancerProfile` accounts, joins each with its `ReputationRecord` for the reputation annotation shown in the dropdown |
| `app/profile/create/page.tsx` | Freelancer opts into discoverability | Form calling `create_profile(display_name)` |
| `app/hire/page.tsx` | Client creates a job | Form calling `create_contract`; freelancer field is a dropdown (populated via `lib/fetch-profiles.ts`) with a "paste an address instead" fallback |
| `app/contract/[id]/page.tsx` | The shared job page | Fetches `Contract`; compares connected wallet to `client`/`freelancer` to decide which buttons render (submit / approve / reject / dispute) |
| `app/profile/[wallet]/page.tsx` | Public trust page | Reads badge ownership + `ReputationRecord`, renders "✓ Verified builder — 3 completed, 1 disputed" |
| `app/api/reputation/[wallet]/route.ts` | Server-side proxy | Holds the RPC provider key server-side; rate-limits/caches reads before hitting the paid RPC |
| `app/api/agent/route.ts` | Server-side proxy | Holds the LLM API key server-side; calls the agent tool below, returns plain-language summary |

### Agent — `agent/tools/`

| File | Purpose | Contains |
|---|---|---|
| `check-reputation.ts` | Read-only lookup, called via the server route above | `checkReputation(walletAddress)` — fetches `ReputationRecord` + badge ownership, returns a plain-language summary. Public, stateless, no login: takes a wallet address as its only input, same answer regardless of who's asking, because the underlying accounts are public on Solana anyway |

---

## 9. Deployment (devnet)

```bash
anchor test
solana balance --url devnet
anchor program deploy \
  --provider.cluster "[your-devnet-endpoint]" \
  -- --with-compute-unit-price 50000 --use-rpc
anchor keys list
solana program show [YOUR_PROGRAM_ID] --url devnet
```

Deploy through a dedicated RPC endpoint (Helius/QuickNode), not the public devnet URL — the public RPC drops the multiple transactions a program deploy requires. Once live, paste the program ID from `anchor keys list` into Solana Explorer (devnet) as your capstone's public front door.

---

## 10. Architecture decisions worth remembering

**Why Next.js over plain Vite.** Not because it's inherently "more secure" for the on-chain logic — Anchor's constraints and Solana's signature verification protect the funds identically no matter what renders the button. It's chosen because this app needs a server for two unrelated reasons: (1) the LLM API key for the agent, and (2) the paid RPC provider key for account reads — both would be exposed in client-side JS on a pure SPA. A server also lets you rate-limit the public, login-free reputation-check endpoint so it can't be hammered into running up your RPC/LLM bill. Next.js just bundles that server into the same deploy as the frontend; a Vite app plus a small separate Express/Worker service would be equally secure, just two deploys instead of one.

**Why the agent is public with no login.** Every account it reads (`ReputationRecord`, badge ownership) is already public on Solana — anyone could manually look it up on Explorer. The agent doesn't grant access to anything private; it just turns a manual account lookup into a plain-English answer. The only gate that matters is rate-limiting against abuse, handled server-side, not an auth wall.