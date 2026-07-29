import type { PublicKey } from "@solana/web3.js";
import type { Program } from "@anchor-lang/core";
import type { GetProgramAccountsFilter } from "@solana/web3.js";
import type BN from "bn.js";

/**
 * Hand-written mirrors of the on-chain account structs.
 *
 * These aren't derived from the IDL automatically because `@anchor-lang/core`'s
 * `Program` constructor is typed `constructor(idl: any, ...)` — with an `any`
 * parameter, TypeScript has nothing to infer the `IDL` generic from, so
 * `new Program(idl, ...)` silently falls back to the default, keyless `Idl`
 * type. That's the direct cause of "Property 'freelancerProfile' does not
 * exist on type 'AccountNamespace<Idl>'".
 *
 * Forcing the generic (`new Program<TrustLedger>(...)`) doesn't fix it either:
 * importing the IDL from `.json` widens string literals (`"kind": "struct"`
 * becomes `"kind": string`), which fails the `Idl` constraint outright — and
 * even with that solved, the raw IDL's account names are PascalCase
 * ("FreelancerProfile") while Anchor only camelCases them at runtime
 * ("freelancerProfile"), so a literal-correct type still wouldn't line up
 * with the real object's keys.
 *
 * These two small interfaces just describe the account layouts directly. The
 * helpers below cast at the one spot where we lose type information —
 * everywhere else stays fully typed.
 */
export interface FreelancerProfileAccount {
  freelancer: PublicKey;
  displayName: string;
}

export interface ReputationRecordAccount {
  completedCount: number;
  disputedCount: number;
}

type AnyProgram = Program<any>;

interface FreelancerProfileClient {
  fetchNullable(address: PublicKey | string): Promise<FreelancerProfileAccount | null>;
  all(): Promise<{ publicKey: PublicKey; account: FreelancerProfileAccount }[]>;
}

interface ReputationRecordClient {
  fetchNullable(address: PublicKey | string): Promise<ReputationRecordAccount | null>;
  fetchMultiple(addresses: PublicKey[]): Promise<(ReputationRecordAccount | null)[]>;
}

export type MilestoneStatus =
  | { notSubmitted: Record<string, never> }
  | { submitted: Record<string, never> }
  | { approved: Record<string, never> }
  | { rejected: Record<string, never> }
  | { disputed: Record<string, never> };

export interface ContractAccount {
  client: PublicKey;
  freelancer: PublicKey;
  amount: BN;
  milestoneCount: number;
  basePayout: BN;
  remainder: BN;
  milestones: MilestoneStatus[];
  rejectionReasons: string[];
}

interface ContractClient {
  fetch(address: PublicKey | string): Promise<ContractAccount>;
  fetchNullable(address: PublicKey | string): Promise<ContractAccount | null>;
  all(
    filters?: GetProgramAccountsFilter[]
  ): Promise<{ publicKey: PublicKey; account: ContractAccount }[]>;
}

export function contracts(program: AnyProgram): ContractClient {
  return (program.account as any).contract;
}

export function freelancerProfiles(program: AnyProgram): FreelancerProfileClient {
  return (program.account as any).freelancerProfile;
}

export function reputationRecords(program: AnyProgram): ReputationRecordClient {
  return (program.account as any).reputationRecord;
}