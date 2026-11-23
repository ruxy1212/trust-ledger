# Trust Ledger v2 Implementation Plan

## 1) Scope & Objectives

The Trust Ledger v2 milestone elevates the protocol from an escrow counter into a true **decentralized service exchange** and **anti-fraud protocol**, featuring:

1. **Real Service Exchange Primitives:** Extending contract and milestone state to store actual scope specifications (titles, descriptions, or IPFS specs) and verifiable submission deliverables (GitHub commit hashes, PR URLs, deployment links, or file hashes).
2. **AI Arbiter Agent with Certainty Scoring:** An autonomous dispute analysis engine that retrieves the milestone deliverable (fetching GitHub code diffs or live previews), compares it against the agreed scope, and evaluates the client's rejection claim to produce an objective verdict with a certainty score (0.00–1.00).
3. **Devnet USDC (SPL-Token) Escrow Support:** Multi-currency escrow allowing contracts to be denominated in either native SOL or devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`), with 6 vs 9 decimal handling and token vault PDAs.
4. **Anti-Fraud & Max Spending Controls:** Hard caps on maximum escrow size (`MAX_ESCROW_LAMPORTS`, `MAX_ESCROW_USDC`) and velocity rate-limiting to prevent runaway drain, compromised wallet exploitation, and malicious contracts.
5. **End-to-End Frontend & IDL Synchronization:** Interactive deliverable submission modals, currency selector, spending limit warnings, and real-time AI arbitration breakdown.

---

## 2) Step-by-Step Work Plan

### Step 1: Real Service Exchange Primitives (Scope Specs & Deliverable Proofs)

#### Target Behavior
- A contract is not an empty money counter: it records project title/scope and specific milestone requirements.
- When a freelancer submits a milestone, they must provide verifiable proof of work (e.g. GitHub commit/PR link, live URL, or IPFS CID).
- The contract preserves the deliverable alongside the client's rejection reason, creating an objective evidence trail.

#### Implementation Steps
1. **Extend Contract State (`program/src/state.rs`):**
   ```rust
   pub struct Contract {
       pub client: Pubkey,
       pub freelancer: Pubkey,
       pub token_mint: Option<Pubkey>,
       pub amount: u64,
       pub milestone_count: u8,
       pub base_payout: u64,
       pub remainder: u64,
       pub milestones: Vec<MilestoneStatus>,
       #[max_len(10, 100)]
       pub milestone_descriptions: Vec<String>, // Scope/acceptance criteria per milestone
       #[max_len(10, 200)]
       pub submissions: Vec<String>,            // Deliverable proof (GitHub URL, PR, IPFS hash)
       #[max_len(10, 200)]
       pub rejection_reasons: Vec<String>,      // Client rejection claim
       pub dispute_resolutions: Vec<Option<DisputeResolution>>,
   }
   ```
2. **Update `create_contract.rs`:**
   - Accept `milestone_descriptions: Vec<String>` (matching `milestone_count`).
   - Validate that descriptions are non-empty and within bounds (max 100 characters per milestone or URI).
3. **Update `submit_milestone.rs`:**
   - Change instruction signature: `pub fn handler(ctx: Context<SubmitMilestone>, index: u8, deliverable_uri: String)`.
   - Validate `deliverable_uri` is non-empty (e.g. min 5 chars, max 200 chars).
   - Store into `contract.submissions[index as usize] = deliverable_uri`.
4. **Update Frontend Submission & Contract UI:**
   - Update `app/src/components/MilestoneTracker.tsx` to provide a "Submit Deliverable" input modal (requesting PR/commit link or preview URL).
   - Display the submitted deliverable link in the milestone card alongside any rejection reasons.

---

### Step 2: Anti-Fraud Safeguards & Maximum Spending Limits

#### Target Behavior
- Contracts cannot exceed defined upper boundaries for total escrow or milestone payouts.
- Clients are prevented from accidentally or maliciously locking excessive capital.
- Upper limits apply uniformly to native SOL and USDC.

#### Implementation Steps
1. **Define Protocol Ceilings (`program/src/constants.rs`):**
   - `MAX_ESCROW_LAMPORTS: u64 = 100_000_000_000` (100 SOL max contract size for devnet/beta).
   - `MAX_ESCROW_USDC: u64 = 50_000_000_000` (50,000 USDC max with 6 decimals).
2. **Add Custom Errors (`program/src/errors.rs`):**
   - `EscrowTooLarge`: Contract escrow exceeds maximum allowed ceiling.
   - `MilestonePayoutTooLarge`: Single milestone payout exceeds safety boundaries.
   - `DeliverableRequired`: Milestone submission requires a valid deliverable URL/proof.
   - `DescriptionRequired`: Milestone description cannot be empty.
3. **Enforce in Contract Creation (`program/src/instructions/create_contract.rs`):**
   - Check `amount <= MAX_ESCROW_LAMPORTS` (or token ceiling).
   - Verify `base_payout + remainder <= amount`.
4. **Tests & IDL Updates:**
   - Add negative tests in `tests/trust-ledger.ts` verifying rejection when contract amount exceeds maximum limit.

---

### Step 3: Devnet USDC Multi-Currency Escrow (SPL Token Support)

#### Target Behavior
- Contracts can be funded in either native SOL or SPL Tokens (devnet USDC).
- Vault accounting dynamically switches between System Program lamport transfers and SPL Token CPI transfers.
- Protocol fee cuts apply accurately across token decimals.

#### Implementation Steps
1. **Support Token Vault PDAs:**
   - Derive token vault ATA or token PDA: `[VAULT_SEED, contract.key().as_ref(), token_mint.as_ref()]`.
2. **Update Instructions:**
   - **`create_contract`:** Accept optional `token_mint`. If present, CPI SPL Token `transfer_checked` from client ATA to vault ATA instead of `system_program::transfer`.
   - **`approve_milestone`:** If `token_mint` is set, transfer payout and protocol fees via SPL Token program to freelancer ATA and fee recipient ATA.
   - **`resolve_dispute`:** Execute refund, release, or 50/50 split via SPL Token CPI with remaining balance preservation.
3. **Devnet USDC Mint Integration:**
   - Add devnet USDC constant `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (decimals: 6).
4. **Synchronization & Tests:**
   - Synchronize `idls/trust_ledger.json` and TypeScript types.
   - Write comprehensive tests in `tests/trust-ledger.ts` with local mint creation and SPL Token transfers.

---

### Step 4: AI Arbiter Agent Engine with Evidence Verification & Certainty Scoring

#### Target Behavior
- When a milestone enters `Disputed` state, either party or the platform can invoke the AI Arbiter.
- The Arbiter analyzes concrete evidence:
  1. **Agreed Scope:** `contract.milestone_descriptions[index]`.
  2. **Submitted Deliverable Proof:** `contract.submissions[index]`.
     - If a GitHub commit or PR URL is supplied, the agent fetches the Git diff via GitHub API to inspect modified files.
     - If a preview URL or document hash is supplied, the agent inspects the payload or response headers.
  3. **Rejection Claim:** `contract.rejection_reasons[index]`.
  4. **On-Chain Track Record:** Reviews completion/dispute history for both wallets.
- Returns a structured evaluation containing:
  - `verdict`: `"release_to_freelancer"` | `"refund_to_client"` | `"split_50_50"`
  - `certainty_score`: Float between `0.00` and `1.00` (e.g., `0.92` = 92% certainty).
  - `summary`: Concise synthesis of the dispute.
  - `findings`: Evidence verification breakdown (code diff matches scope vs unagreed client scope-creep).
  - `recommendation`: Concrete actionable advice for client and freelancer.

#### Implementation Steps
1. **Create Arbiter Engine & Tools (`app/src/agent/tools/arbiter-dispute.ts`):**
   - Build GitHub diff retrieval helper (supports public repos and commit hashes).
   - Define strict TypeScript interfaces and Zod schemas for `DisputeEvidence` and `ArbiterVerdict`.
   - Build a specialized system prompt with rigorous legal/technical evaluation rubrics.
2. **Create API Endpoint (`app/src/app/api/arbiter/route.ts`):**
   - Protected by Ed25519 wallet authentication (from `auth.ts`) to prevent quota abuse.
   - Rate limited per wallet/IP via Upstash/memory rate limiter.
   - Ingests on-chain contract PDA and milestone index, reads on-chain state, fetches deliverable proof, and generates the verdict.
3. **Certainty Score Heuristics:**
   - **High certainty (> 0.85):** Objective proof exists (e.g., commit diff directly implements the described milestone features; rejection reason claims non-delivery or demands unagreed features).
   - **Moderate certainty (0.60–0.85):** Partial delivery, code contains minor bugs, or subjective quality disputes -> recommends **50/50 Split**.
   - **Low certainty (< 0.60):** Vague descriptions, missing commit history, or unverifiable claims -> flags for manual human review or mutual concession.

---

### Step 5: Arbiter-Assisted On-Chain Dispute Settlement Flow

#### Target Behavior
- Both client and freelancer can view the Arbiter's verdict, certainty score, and evidence findings in the UI.
- The Arbiter's recommendation can be accepted by either party with one click, executing the on-chain resolution (`ReleaseToFreelancer`, `RefundToClient`, or `Split`).
- Optional Protocol Arbiter Authority: allow designated protocol arbiter oracle to sign the settlement if both parties elected automated AI arbitration.

#### Implementation Steps
1. **Frontend Settlement Integration (`app/src/components/MilestoneTracker.tsx`):**
   - Display "AI Arbiter Recommendation" card when milestone status is `disputed`.
   - Show interactive gauge for `certainty_score` with color coding (Green: High, Yellow: Medium, Orange: Split suggested).
   - Provide "Accept AI Recommendation" button triggering Anchor `resolveDispute` RPC call.
2. **Protocol Arbiter Role (`program/src/instructions/resolve_dispute.rs`):**
   - Allow an authorized `arbiter` authority (configured in `ProtocolConfig` or specified in `Contract`) to settle disputes if certainty score exceeds threshold.

---

### Step 6: Frontend Multi-Asset & Fraud Controls Integration

#### Target Behavior
- Client can toggle between `SOL` and `USDC` when creating a contract.
- Client inputs milestone descriptions/specs during contract creation.
- Freelancer submits deliverable URL/proof upon completion.
- Spending warnings when contract escrow approaches maximum safety limits.

#### Implementation Steps
1. **Contract Creation Form (`app/src/app/hire/page.tsx`):**
   - Currency selector (SOL vs USDC).
   - Dynamic inputs for milestone titles and acceptance criteria.
   - Spending ceiling validation warnings before signing transaction.
2. **Token Account Handlers (`app/src/lib/tokens.ts`):**
   - Helper to fetch or create Associated Token Accounts for client and freelancer.
   - Faucet link for devnet USDC.

---

## 3) Delivery Phases Overview

| Phase | Steps | Focus |
| :--- | :--- | :--- |
| **Phase 2.1** | Step 1 | Service exchange primitives: Milestone scope descriptions & deliverable proofs |
| **Phase 2.2** | Step 2 | Anti-fraud safeguards: Maximum escrow limits & safety boundaries |
| **Phase 2.3** | Step 3 | Multi-currency escrow: Devnet USDC SPL-Token vault architecture |
| **Phase 2.4** | Step 4 & Step 5 | AI Arbiter Agent with GitHub evidence verification & settlement UI |
| **Phase 2.5** | Step 6 | Next.js frontend UI: Currency toggle, deliverable modal, test suite |

---

## 4) Verification & Acceptance Criteria

1. **Service Exchange Integrity:**
   - Contract cannot be created without milestone descriptions.
   - Milestone cannot be submitted without a deliverable URL/proof.
2. **Anti-Fraud Bounds:** Attempting to create a contract with escrow > `MAX_ESCROW` fails on-chain with `EscrowTooLarge`.
3. **Devnet USDC Flow:**
   - Contract funded and settled with devnet USDC mint; token ATAs update accurately.
4. **AI Arbiter Verdict:**
   - Arbiter fetches deliverable Git diff, compares to milestone description, evaluates rejection reason, and returns JSON with `verdict`, `certainty_score` (0.00–1.00), and structured findings.
5. **Settlement Flow:**
   - Clicking "Accept Recommendation" in UI submits `resolve_dispute` transaction to devnet and unlocks funds accordingly.
