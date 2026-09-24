# Trust Ledger Fix Implementation Plan

## 1) Scope

This plan covers implementation for the issues identified in the repository review:

- Reputation farming via zero/low-value or self-dealing contracts
- Missing dispute resolution flow (funds can freeze indefinitely)
- Product/docs mismatch on dispute rights
- LLM endpoint abuse/cost controls
- Repository/tooling consistency issues
- API hardening and UX/polish improvements
- Business-model implementation hooks for sustainable revenue

---

## 2) Step-by-Step Work Plan

### Step 0: Prerequisite Workspace & Build Configuration

#### Target behavior
- Rust workspace manifest correctly points to existing program crate.
- Cargo and build tools work cleanly from repository root.

#### Implementation steps
1. **Fix workspace manifest in `Cargo.toml`**
   - Change `members = ["programs/*"]` to `members = ["program"]`.
2. **Verify build**
   - Confirm `cargo check` and program compilation succeed without workspace path errors.

---

### Step 1: Prevent reputation farming and self-dealing (Critical - Section A)

#### Target behavior
- A client cannot create a contract with themselves as freelancer.
- A contract must meet a minimum total escrow (`MIN_ESCROW_LAMPORTS`).
- Each milestone payout must meet a minimum meaningful floor (`MIN_MILESTONE_PAYOUT_LAMPORTS`).
- Reputation semantics are hardened against gaming through value-weighted volume and score tracking without unbounded on-chain account bloat.

#### Implementation steps
1. **Protocol constraints in program**
   - Update `program/src/errors.rs` with new errors:
     - `SelfContractNotAllowed`
     - `EscrowTooSmall`
     - `MilestonePayoutTooSmall`
   - Update `program/src/constants.rs` with minimums:
     - `MIN_ESCROW_LAMPORTS` (e.g. 10_000_000 lamports / 0.01 SOL)
     - `MIN_MILESTONE_PAYOUT_LAMPORTS` (e.g. 5_000_000 lamports / 0.005 SOL)
   - Enforce in `program/src/instructions/create_contract.rs`:
     - `client.key() != freelancer.key()`
     - `amount >= MIN_ESCROW_LAMPORTS`
     - `contract.base_payout >= MIN_MILESTONE_PAYOUT_LAMPORTS`
2. **Harden reputation semantics in program state**
   - Extend `ReputationRecord` in `program/src/state.rs`:
     - Add `pub earned_volume: u64` (total lamports earned from approved milestones).
     - Add `pub reputation_score: u64` (value-weighted reputation score).
     - (Note: Unbounded `Vec<Pubkey>` is avoided on-chain to prevent exceeding Solana account size/rent limits.)
   - Update `program/src/instructions/approve_milestone.rs`:
     - Accumulate `earned_volume += payout`.
     - Update `reputation_score` based on payout weight and completion count.
3. **IDL, Frontend & Test Synchronization**
   - Synchronize account schemas and IDLs:
     - `app/src/types/accounts.ts` (`ReputationRecordAccount` fields: `earnedVolume`, `reputationScore`).
     - `app/src/types/idl.ts` and `app/src/idl/trust_ledger.json`.
     - `idls/trust_ledger.json`.
   - Update profile fetchers & components:
     - `app/src/components/ReputationStat.tsx` (display volume / weighted score).
     - `app/src/lib/fetch-profiles.ts`.
   - Update integration tests:
     - `tests/trust-ledger.ts` (embedded IDL and test assertions).
     - `app/src/tests/trust-ledger.test.ts`.
     - Add test cases: reject self-contract, reject low escrow, reject low milestone payout, verify score/volume accumulation.

#### Manual Testing Criteria
- Attempt creating contract where `client == freelancer` -> rejected on-chain.
- Attempt creating contract with `< MIN_ESCROW_LAMPORTS` -> rejected on-chain.
- Complete milestone approval -> verify `earned_volume` and `reputation_score` increment appropriately on frontend and in tests.

---

### Step 2: Dispute Rights Alignment & Dispute Resolution (Critical/High - Sections C & B)

#### Target behavior
- Both client and freelancer can raise a dispute on a milestone that has been submitted or rejected.
- Disputed milestones can be settled without permanent escrow lock:
  - Release to freelancer (milestone approved by dispute settlement).
  - Refund to client (milestone cancelled/refunded).
  - Split payout between client and freelancer.
- Escrow accounting ensures no underflow and preserves the vault rent-exempt reserve.

#### Implementation steps
1. **Align dispute initiation rights (`program/src/instructions/raise_dispute.rs`)**
   - Allow signer to be either `client` OR `freelancer` on the contract.
   - Validate status: milestone can be disputed if submitted or rejected.
   - Update reputation disputed count appropriately.
2. **Create dispute resolution instruction (`program/src/instructions/resolve_dispute.rs`)**
   - Define resolution outcomes: `ReleaseToFreelancer`, `RefundToClient`, `Split`.
   - Verify signer authority (mutual agreement or contract participants per resolution rules).
   - Perform vault CPI transfer using vault PDA bump & seeds to freelancer, client, or split.
   - Update milestone status to resolved/approved/refunded.
   - Wire module into `program/src/instructions.rs` and `program/src/lib.rs`.
3. **IDL, Types, Frontend & Test Synchronization**
   - Update IDLs: `idls/trust_ledger.json`, `app/src/idl/trust_ledger.json`, `app/src/types/idl.ts`.
   - Update `app/src/types/accounts.ts` and `Contract` status types.
   - Add dispute resolution controls in `app/src/components/MilestoneTracker.tsx` and `app/src/app/contract/[pda]/page.tsx`.
   - Update docs (`README.md`, `app/README.md`) to reflect dual dispute permissions and resolution flow.
   - Add comprehensive tests in `tests/trust-ledger.ts` and `app/src/tests/trust-ledger.test.ts` covering raise dispute (client + freelancer) and resolution outcomes (release, refund, split).

#### Manual Testing Criteria
- Raise dispute as client -> succeeds.
- Raise dispute as freelancer -> succeeds.
- Resolve dispute with release, refund, or split -> funds transfer accurately from vault to intended wallet(s), vault preserves rent-exempt reserve, milestone marks resolved.

---

### Step 3: Harden `/api/agent` with Auth, Validation & Durable Rate Limiting (High - Section D)

#### Target behavior
- `/api/agent` is protected against unauthorized abuse and runaway token spend.
- Requests require authenticated wallet signature (or nonce verification) so anonymous attackers cannot burn LLM quota.
- Durable rate limiting via Redis with in-memory fallback for local development.
- Input validation (schema guards) and error handling on tool calls.
- Frontend `ReputationAgentWidget.tsx` seamlessly integrates wallet signing so user interaction works smoothly.

#### Implementation steps
1. **Wallet signature verification utility**
   - Add lightweight signature verification helper for Solana wallet signatures in `app/src/lib/auth.ts`.
2. **Durable rate limiting with local fallback**
   - Update `app/src/lib/rate-limit.ts` to support Redis (Upstash) when configured, falling back to in-memory store if Redis credentials are not provided.
   - Enforce distinct limits for `/api/reputation` (public read-only) vs `/api/agent` (authenticated AI).
3. **Hardened `/api/agent/route.ts`**
   - Validate request payload schema (using Zod or strict validator).
   - Verify wallet signature/header before calling LLM.
   - Safe parsing of tool calling outputs.
   - Budget guardrails (max request size, per-wallet daily limits, safe error responses 401/429).
4. **Update `ReputationAgentWidget.tsx`**
   - Integrate `useWallet` hook.
   - If wallet is not connected, provide a clear prompt to connect wallet.
   - Sign message / pass auth headers when sending messages to `/api/agent`.

#### Manual Testing Criteria
- Unauthenticated POST to `/api/agent` returns 401 Unauthorized.
- Malformed JSON / invalid tool inputs return 400 Bad Request without crashing server.
- Connected wallet in widget sends query and receives AI agent response.
- Rate-limit thresholds trigger HTTP 429 when exceeded.

---

### Step 4: Repository Cleanup, Package Standardization & UX Polish (Medium/Low - Sections E, F, G)

#### Target behavior
- Repository metadata reflects `trust-ledger` instead of legacy `counter`.
- Stale counter files are removed.
- Package manager tooling is standardized across root and app.
- UI copy and route behaviors are polished and consistent.

#### Implementation steps
1. **Repository & package cleanup (Section E)**
   - Update root `package.json` name from `counter` to `trust-ledger`.
   - Remove stale counter files:
     - `tests/counter.ts`
     - `idls/counter.json`
2. **Standardize package management (Section F)**
   - Standardize on `pnpm` workspace across root and app.
   - Update `Anchor.toml` scripts from `yarn` to `pnpm`.
   - Clean redundant lockfiles.
3. **UX & copy polish (Section G)**
   - Polish profile page copy and wallet address validations.
   - Sweep UI text across contract pages, empty states, and error alerts.

#### Manual Testing Criteria
- Clean install via package manager succeeds.
- Stale counter artifacts are gone, and test scripts run properly without references to counter.
- UI flows (profile, contract details, widget) display clear, consistent copy.

---

### Step 5: Monetization & Fee Architecture Hooks (Strategic - Section H)

#### Target behavior
- Optional protocol fee configuration PDA to capture sustainable revenue without breaking trust.
- Fee hook on milestone payout and/or arbitration, configurable by protocol admin.

#### Implementation steps
1. **Protocol fee config account**
   - Add `ProtocolConfig` state in `program/src/state.rs` (`fee_recipient: Pubkey`, `fee_basis_points: u16`, `admin: Pubkey`).
   - Add instruction to initialize / update config (`program/src/instructions/update_config.rs`).
2. **Monetization hook in milestone payout**
   - In `approve_milestone.rs` and `resolve_dispute.rs`, if fee is enabled (> 0), transfer fee portion from vault to `fee_recipient`.
3. **IDL & tests**
   - Update IDLs and add tests for fee collection and admin configuration updates.

#### Manual Testing Criteria
- Admin can initialize/update fee basis points.
- Milestone approval correctly splits fee to fee recipient when configured.

---

## 3) Delivery Phases Overview

| Phase | Steps | Focus |
| :--- | :--- | :--- |
| **Phase 0** | Step 0 | Workspace manifest fix & build verification |
| **Phase 1** | Step 1, Step 2, Step 3 | Safety first: Anti-farming, dispute permissions & resolution, agent API hardening |
| **Phase 2** | Step 4 | Stability & consistency: Repo cleanup, package standard, UX/copy polish |
| **Phase 3** | Step 5 | Commercialization: Protocol fee config and monetization hooks |

---

## 4) Validation Checklist per Step

- [ ] Program compilation passes (`cargo check`).
- [ ] TypeScript compilation and tests pass (`app` and root).
- [ ] Manual verification performed by user for the step.
- [ ] Clean, descriptive git commit created before proceeding to next step.

---

## 5) Risks and Mitigations

- **Risk:** State schema changes can break existing devnet accounts.  
  **Mitigation:** Keep new state fields clean, update TypeScript mirrors and IDLs atomically in each step.
- **Risk:** Unbounded arrays on Solana accounts cause out-of-space runtime errors.  
  **Mitigation:** Store scalar scoring metrics (`earned_volume`, `reputation_score`) in `ReputationRecord` instead of unbounded pubkey vectors.
- **Risk:** Adding authentication breaks the agent chat widget for users.  
  **Mitigation:** Update `ReputationAgentWidget.tsx` in the same step with wallet sign-in state, and keep `/api/reputation/[wallet]` public.
- **Risk:** Missing Redis credentials break local development.  
  **Mitigation:** Support graceful in-memory fallback in `rate-limit.ts` when Redis environment variables are absent.
