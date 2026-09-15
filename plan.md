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

## 2) Severity-Ordered Work Plan

## Critical

### A. Prevent reputation farming and self-dealing

#### Target behavior
- A client cannot create a contract with themselves as freelancer.
- A contract must meet a minimum total escrow.
- Each milestone payout must meet a minimum meaningful value.
- Reputation should become harder to game than a raw counter.

#### Implementation steps
1. **Add protocol constraints in program**
   - Update `/home/runner/work/trust-ledger/trust-ledger/program/src/errors.rs` with new errors:
     - `SelfContractNotAllowed`
     - `EscrowTooSmall`
     - `MilestonePayoutTooSmall`
   - Update `/home/runner/work/trust-ledger/trust-ledger/program/src/constants.rs` with minimums:
     - `MIN_ESCROW_LAMPORTS`
     - `MIN_MILESTONE_PAYOUT_LAMPORTS`
   - Enforce in `/home/runner/work/trust-ledger/trust-ledger/program/src/instructions/create_contract.rs`:
     - `client.key() != freelancer.key()`
     - `amount >= MIN_ESCROW_LAMPORTS`
     - `base_payout > 0` and computed effective payout floor check.

2. **Harden reputation semantics**
   - Extend `/home/runner/work/trust-ledger/trust-ledger/program/src/state.rs` `ReputationRecord` to include:
     - optional value-weighted or score field (e.g. `earned_volume`, `reputation_score`)
     - optional unique-client tracking strategy (see decision section below)
   - Update `/home/runner/work/trust-ledger/trust-ledger/program/src/instructions/approve_milestone.rs`:
     - update score using payout/value and anti-sybil weighting rules.

3. **Backfill frontend expectations**
   - Update frontend types and display in:
     - `/home/runner/work/trust-ledger/trust-ledger/app/src/types/accounts.ts`
     - `/home/runner/work/trust-ledger/trust-ledger/app/src/components/ReputationStat.tsx`
     - `/home/runner/work/trust-ledger/trust-ledger/app/src/lib/fetch-profiles.ts`
   - Keep backward-compatible rendering if new fields are absent.

4. **Tests**
   - Add/extend tests in:
     - `/home/runner/work/trust-ledger/trust-ledger/tests/trust-ledger.ts`
     - `/home/runner/work/trust-ledger/trust-ledger/app/src/tests/trust-ledger.test.ts`
   - Cases:
     - reject self-contract
     - reject tiny escrow
     - reject tiny milestone payouts
     - reputation scoring behavior across varying payout sizes.

#### Decision: reputation anti-gaming model
**Options**
1. Keep simple `completed_count` + add minimum escrow checks only.
2. Add value-weighted score (`score += f(payout)`), still count-based.
3. Add value-weighted score + unique-client multiplier/cap (best anti-collusion).

**Recommendation**
- **Option 3** for strongest abuse resistance while preserving transparency.

---

### B. Add dispute resolution to avoid permanent fund lock

#### Target behavior
- Disputed milestones can be resolved to one of: release to freelancer, refund to client, or split.
- Contracts can reach terminal state and optionally close.

#### Implementation steps
1. **Add instruction**
   - Create `/home/runner/work/trust-ledger/trust-ledger/program/src/instructions/resolve_dispute.rs`.
   - Wire module in:
     - `/home/runner/work/trust-ledger/trust-ledger/program/src/instructions.rs`
     - `/home/runner/work/trust-ledger/trust-ledger/program/src/lib.rs`
   - Add account validation + signer role constraints.

2. **State updates**
   - Extend `Contract` in `/home/runner/work/trust-ledger/trust-ledger/program/src/state.rs` with fields needed for dispute metadata and resolution status.

3. **Fund movement rules**
   - Reuse vault signer logic pattern from `approve_milestone`.
   - Ensure escrow accounting cannot underflow and preserves rent reserve.

4. **Frontend integration**
   - Add disputed milestone resolution controls for authorized role in:
     - `/home/runner/work/trust-ledger/trust-ledger/app/src/components/MilestoneTracker.tsx`
     - `/home/runner/work/trust-ledger/trust-ledger/app/src/app/contract/[pda]/page.tsx`

5. **Tests**
   - Add success and failure paths for each resolution branch.

#### Decision: who can resolve disputes
**Options**
1. Client-only.
2. Mutual consent (both client and freelancer must approve same outcome).
3. Arbiter authority PDA (admin/multisig) resolves.
4. Time-based fallback: mutual consent first, then arbiter or timeout default.

**Recommendation**
- **Option 4** for balanced UX and trust minimization.

---

## High

### C. Align dispute permissions with product intent

#### Implementation steps
1. Decide whether disputes are freelancer-only or both parties.
2. If both parties:
   - update `/home/runner/work/trust-ledger/trust-ledger/program/src/instructions/raise_dispute.rs` constraints.
   - add explicit checks for authorized signer = client OR freelancer.
3. Update docs:
   - `/home/runner/work/trust-ledger/trust-ledger/README.md`
   - `/home/runner/work/trust-ledger/trust-ledger/app/README.md`

#### Decision: dispute initiation rights
**Options**
1. Freelancer-only.
2. Both client and freelancer.

**Recommendation**
- **Option 2** to match stated product behavior and reduce policy confusion.

---

### D. Harden `/api/agent` against abuse and runaway spend

#### Implementation steps
1. **Authentication**
   - Require signed wallet nonce/session for LLM route usage.
   - Reject anonymous access to model-backed route.

2. **Durable rate limiting**
   - Replace in-memory limiter in `/home/runner/work/trust-ledger/trust-ledger/app/src/lib/rate-limit.ts` with Redis-backed limiter.
   - Keep endpoint-specific quotas (`/api/reputation` higher, `/api/agent` lower).

3. **Budget guardrails**
   - Add per-identity/day request caps and token budget checks.
   - Add graceful 429/402 style responses once limits exceeded.

4. **Input/output hardening**
   - Guard `JSON.parse` calls in `/home/runner/work/trust-ledger/trust-ledger/app/src/app/api/agent/route.ts`.
   - Validate tool arguments with schema before execution.

5. **Monitoring**
   - Add usage logs and alert thresholds for token burn spikes.

#### Decision: access model for agent route
**Options**
1. Public endpoint with strict rate limit.
2. Wallet-authenticated users only.
3. Registered contract participants only.

**Recommendation**
- **Option 2 now**, with architecture compatible with Option 3 later.

---

## Medium

### E. Clean repository identity and stale scaffolding

#### Implementation steps
1. Rename root package metadata from legacy `counter` to trust-ledger naming.
2. Remove or archive stale counter artifacts:
   - `/home/runner/work/trust-ledger/trust-ledger/tests/counter.ts`
   - `/home/runner/work/trust-ledger/trust-ledger/idls/counter.json`
3. Verify scripts and docs no longer reference old module names.

#### Decision: handling stale counter assets
**Options**
1. Delete.
2. Move to `/examples/counter-legacy`.
3. Keep but clearly mark deprecated.

**Recommendation**
- **Option 2** if educational value matters, otherwise Option 1.

---

### F. Standardize package management and build reproducibility

#### Implementation steps
1. Choose package manager standard for root and app.
2. Remove non-standard lockfiles.
3. Update contributor docs and CI checks to enforce one manager.

#### Decision: package manager standard
**Options**
1. Yarn workspace standard.
2. pnpm workspace standard.

**Recommendation**
- **Option 2 (pnpm)** for workspace efficiency and deterministic installs.

---

## Low

### G. UX and copy cleanup

#### Implementation steps
1. Fix profile-page copy issues and minor wording inconsistencies.
2. Ensure route behavior is intentional for invalid wallets vs unregistered wallets.
3. Sweep key UI text for clarity and trust language consistency.

---

## Profit-Making (Strategic, post-safety)

### H. Add monetization hooks with minimal trust tradeoff

#### Implementation steps
1. Add protocol fee config PDA with governance/admin update controls.
2. Apply tiny fee on `approve_milestone` payouts.
3. Add optional paid dispute arbitration path.
4. Expose paid reputation API tier (rate and SLA differentiated).

#### Decision: revenue model rollout
**Options**
1. Fee on payout only.
2. Arbitration fees only.
3. Hybrid (payout fee + arbitration + API tier).

**Recommendation**
- **Option 3** with low initial fee and explicit fee transparency.

---

## 3) Delivery Phases

### Phase 1 (Safety First)
- A: anti-farming constraints
- B: dispute resolution instruction
- C: dispute rights alignment
- D (minimum subset): auth + durable rate-limit + parser hardening

### Phase 2 (Stability and Consistency)
- E: repo cleanup
- F: package/lockfile normalization
- Complete D monitoring/budget controls

### Phase 3 (Commercialization)
- H: protocol fee + arbitration + API monetization

---

## 4) Validation Checklist per Phase

- Program unit/integration tests pass (`tests/trust-ledger.ts`).
- Frontend tests pass (`app/src/tests/trust-ledger.test.ts`).
- Manual contract lifecycle smoke test:
  - create → submit → approve/reject → dispute → resolve.
- API abuse test:
  - invalid payloads, spoofed caller headers, burst traffic.
- Backward compatibility checks for existing account data where feasible.

---

## 5) Risks and Mitigations

- **Risk:** State schema changes can break existing devnet accounts.  
  **Mitigation:** use versioned migration strategy or introduce new account fields conservatively with rollout notes.

- **Risk:** Overly strict anti-farming limits reduce legitimate micro-jobs.  
  **Mitigation:** configurable minimums in constants/governance PDA.

- **Risk:** Added auth friction hurts adoption of reputation lookup tool.  
  **Mitigation:** keep `/api/reputation/[wallet]` public/read-only and reserve auth for LLM path.

---

## 6) Definition of Done

- Critical and High items implemented and tested.
- Docs accurately reflect actual on-chain permissions and lifecycle.
- Abuse and deadlock vectors closed.
- Plan for monetization enabled in code architecture, even if fee switches remain off by default.
