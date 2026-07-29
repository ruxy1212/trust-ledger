# Trust Ledger

Trust Ledger is the Day 99 capstone for 100 Days of Solana: a milestone-based escrow app where clients lock funds on-chain, freelancers build a portable reputation, and an AI agent can read the record without taking custody of anything.

The app is built with Next.js, Anchor, and the Solana wallet adapter. It includes:

- a client flow for creating contracts with milestones
- freelancer profiles that live on chain
- milestone tracking that makes progress visible
- a dashboard for tracking active work
- public contract and profile pages
- a read-only AI tool that checks reputation from chain data

## Local Setup

1. Install dependencies.

```bash
pnpm install
```

2. Create your local environment file.

```bash
cp env.example .env.local
```

3. Fill in the RPC and AI settings in `.env.local`.

Required variables:

- `NEXT_PUBLIC_RPC_URL`
- `RPC_URL`
- `OPEN_AI_API_KEY`
- `OPEN_AI_BASE_URL`
- `OPEN_AI_MODEL`
- `NEXT_APP_URL` if you want metadata to point at a custom host

4. Start the app.

```bash
pnpm dev
```

5. Open the local site in your browser.

```text
http://localhost:3000
```

## Available Scripts

- `pnpm dev` starts the development server
- `pnpm build` creates a production build
- `pnpm start` runs the production server
- `pnpm lint` runs ESLint

## What It Is For

This project is about proving that a Solana app can do more than store data. It can coordinate work, enforce contract milestones, preserve reputation across sessions, and still leave the wallet owner in control.

## To-Dos
- A verification badge that can be revoked (using another PDA + Token2022 Extensions)
- Dispute handling (for now, when a dispute is created, the funds stay locked in the vault)
- UI Adjustments, the flow is not yet smooth, across the entire app.
