# How to Setup Freelance Escrow & Reputation Passport [Trust Ledger] (Day 99)

This guide details how to integrate and run the milestone-based Freelance Escrow & Reputation Passport system in your Solana local and devnet workspaces.

---

## 1. On-Chain Anchor Program Setup

Copy the Rust program files into your existing Anchor project directory (e.g., `programs/freelance-escrow/src/`):

1. **Constants:** Copy [constants.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/constants.rs) into `programs/freelance-escrow/src/constants.rs`
2. **Errors:** Copy [errors.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/errors.rs) into `programs/freelance-escrow/src/errors.rs`
3. **State:** Copy [state.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/state.rs) into `programs/freelance-escrow/src/state.rs`
4. **Instructions:** Copy the entire instructions folder:
   - [instructions/mod.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/instructions/mod.rs) to `programs/freelance-escrow/src/instructions/mod.rs`
   - [instructions/create_profile.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/instructions/create_profile.rs) to `programs/freelance-escrow/src/instructions/create_profile.rs`
   - [instructions/create_contract.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/instructions/create_contract.rs) to `programs/freelance-escrow/src/instructions/create_contract.rs`
   - [instructions/submit_milestone.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/instructions/submit_milestone.rs) to `programs/freelance-escrow/src/instructions/submit_milestone.rs`
   - [instructions/approve_milestone.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/instructions/approve_milestone.rs) to `programs/freelance-escrow/src/instructions/approve_milestone.rs`
   - [instructions/reject_milestone.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/instructions/reject_milestone.rs) to `programs/freelance-escrow/src/instructions/reject_milestone.rs`
   - [instructions/raise_dispute.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/instructions/raise_dispute.rs) to `programs/freelance-escrow/src/instructions/raise_dispute.rs`
5. **Entrypoint:** Copy [lib.rs](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/lib.rs) to `programs/freelance-escrow/src/lib.rs`

### Tests Setup
Copy [tests/freelance-escrow.ts](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/tests/freelance-escrow.ts) into the `tests/` directory of your Anchor workspace.

### Building & Running Local Tests
Sync your keys and compile the program:
```bash
anchor keys sync
anchor build
```

Verify your tests pass locally using the test command:
```bash
anchor test
```

---

## 2. Devnet Deployment

When ready to deploy your capstone to Devnet:
1. Ensure your Solana CLI is configured to devnet:
   ```bash
   solana config set --url https://api.devnet.solana.com
   ```
2. Verify you have a sufficient balance (at least 3-5 SOL is recommended for contract deployment):
   ```bash
   solana balance
   ```
3. Deploy the program utilizing a dedicated RPC cluster (such as Helius or Quicknode):
   ```bash
   anchor program deploy \
     --provider.cluster "[your-dedicated-devnet-rpc-endpoint]" \
     -- --with-compute-unit-price 50000 --use-rpc
   ```
4. Find your program ID:
   ```bash
   anchor keys list
   ```
5. Confirm the status of your deployed executable program:
   ```bash
   solana program show [YOUR_PROGRAM_ID] --url devnet
   ```

---

## 3. Frontend Integration (Next.js)

Copy these utility helper files into your Next.js application structure:
1. **Client Setup:** Copy [frontend/lib/anchor-client.ts](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/frontend/lib/anchor-client.ts) to `frontend/lib/anchor-client.ts`
2. **Profile Helpers:** Copy [frontend/lib/fetch-profiles.ts](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/frontend/lib/fetch-profiles.ts) to `frontend/lib/fetch-profiles.ts`

---

## 4. Agent Integration

Copy the agent reputation tracking tool file:
- **Reputation Tool:** Copy [agent/tools/check-reputation.ts](file:///C:/laragon/www/react/ideas/solana-100/week_15/day_99/agent/tools/check-reputation.ts) to `agent/tools/check-reputation.ts`
