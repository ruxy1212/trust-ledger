// Infers the Program's TS type straight from the IDL JSON — no hand-copied
// type literal to keep in sync if the program changes. Requires
// "resolveJsonModule": true in tsconfig.json (on by default in create-next-app).
import idlJson from "../idl/trust_ledger.json";

export type TrustLedger = typeof idlJson;
export const IDL = idlJson as TrustLedger;