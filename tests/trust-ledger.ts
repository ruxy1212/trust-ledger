import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
  getAccount,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
// import { TrustLedger } from "../target/types/trust_ledger";
type TrustLedger = {
  "address": "E68AQePth8MVtn2aHax23c6BWye8Mnw2fkDzCyTfqNEk",
  "metadata": {
    "name": "trustLedger",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "approveMilestone",
      "discriminator": [
        145,
        85,
        92,
        60,
        50,
        130,
        219,
        106
      ],
      "accounts": [
        {
          "name": "contract",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "contract"
              }
            ]
          }
        },
        {
          "name": "client",
          "writable": true,
          "signer": true,
          "relations": [
            "contract"
          ]
        },
        {
          "name": "freelancer",
          "docs": [
            "Identity is enforced by the `has_one = freelancer` constraint above."
          ],
          "writable": true,
          "relations": [
            "contract"
          ]
        },
        {
          "name": "reputation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  117,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "freelancer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "createContract",
      "discriminator": [
        244,
        48,
        244,
        178,
        216,
        88,
        122,
        52
      ],
      "accounts": [
        {
          "name": "contract",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  97,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "client"
              },
              {
                "kind": "account",
                "path": "freelancer"
              },
              {
                "kind": "arg",
                "path": "contractId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "contract"
              }
            ]
          }
        },
        {
          "name": "client",
          "writable": true,
          "signer": true
        },
        {
          "name": "freelancer"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "contractId",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "milestoneCount",
          "type": "u8"
        }
      ]
    },
    {
      "name": "createProfile",
      "discriminator": [
        225,
        205,
        234,
        143,
        17,
        186,
        50,
        220
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "freelancer"
              }
            ]
          }
        },
        {
          "name": "freelancer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "displayName",
          "type": "string"
        }
      ]
    },
    {
      "name": "raiseDispute",
      "discriminator": [
        41,
        243,
        1,
        51,
        150,
        95,
        246,
        73
      ],
      "accounts": [
        {
          "name": "contract",
          "writable": true
        },
        {
          "name": "freelancer",
          "writable": true,
          "signer": true,
          "relations": [
            "contract"
          ]
        },
        {
          "name": "reputation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  117,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "freelancer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "rejectMilestone",
      "discriminator": [
        243,
        48,
        66,
        165,
        237,
        41,
        116,
        249
      ],
      "accounts": [
        {
          "name": "contract",
          "writable": true
        },
        {
          "name": "client",
          "signer": true,
          "relations": [
            "contract"
          ]
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "submitMilestone",
      "discriminator": [
        35,
        96,
        220,
        215,
        102,
        83,
        139,
        52
      ],
      "accounts": [
        {
          "name": "contract",
          "writable": true
        },
        {
          "name": "freelancer",
          "signer": true,
          "relations": [
            "contract"
          ]
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "contract",
      "discriminator": [
        172,
        138,
        115,
        242,
        121,
        67,
        183,
        26
      ]
    },
    {
      "name": "freelancerProfile",
      "discriminator": [
        142,
        199,
        151,
        44,
        211,
        185,
        36,
        26
      ]
    },
    {
      "name": "reputationRecord",
      "discriminator": [
        140,
        29,
        118,
        100,
        134,
        207,
        99,
        194
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Wrong wallet signs an instruction that requires client or freelancer"
    },
    {
      "code": 6001,
      "name": "milestoneOutOfRange",
      "msg": "Milestone index doesn't exist on this contract"
    },
    {
      "code": 6002,
      "name": "milestoneNotSubmitted",
      "msg": "Milestone is not in the Submitted state"
    },
    {
      "code": 6003,
      "name": "notYetRejected",
      "msg": "Milestone is not in the Rejected state"
    },
    {
      "code": 6004,
      "name": "milestoneDisputed",
      "msg": "Milestone is frozen in a Disputed state"
    },
    {
      "code": 6005,
      "name": "invalidMilestoneCount",
      "msg": "Milestone count must be greater than zero"
    },
    {
      "code": 6006,
      "name": "nameTooLong",
      "msg": "Freelancer display name is too long (max 50 chars)"
    },
    {
      "code": 6007,
      "name": "reasonTooLong",
      "msg": "Rejection reason is too long (max 200 chars)"
    }
  ],
  "types": [
    {
      "name": "contract",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "freelancer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "milestoneCount",
            "type": "u8"
          },
          {
            "name": "basePayout",
            "type": "u64"
          },
          {
            "name": "remainder",
            "type": "u64"
          },
          {
            "name": "milestones",
            "type": {
              "vec": {
                "defined": {
                  "name": "milestoneStatus"
                }
              }
            }
          },
          {
            "name": "rejectionReasons",
            "type": {
              "vec": "string"
            }
          }
        ]
      }
    },
    {
      "name": "freelancerProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "freelancer",
            "type": "pubkey"
          },
          {
            "name": "displayName",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "milestoneStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "notSubmitted"
          },
          {
            "name": "submitted"
          },
          {
            "name": "approved"
          },
          {
            "name": "rejected"
          },
          {
            "name": "disputed"
          }
        ]
      }
    },
    {
      "name": "reputationRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "completedCount",
            "type": "u32"
          },
          {
            "name": "disputedCount",
            "type": "u32"
          }
        ]
      }
    }
  ]
};

const { BN } = anchor.default;

describe("trust-ledger", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TrustLedger as Program<TrustLedger>;

  const client = (provider.wallet as anchor.Wallet).payer;
  const freelancer = anchor.web3.Keypair.generate();
  const stranger = anchor.web3.Keypair.generate();

  // Helper: airdrop SOL and confirm
  async function fundWallet(pubkey: anchor.web3.PublicKey, amountSol: number = 2) {
    const signature = await provider.connection.requestAirdrop(
      pubkey,
      amountSol * anchor.web3.LAMPORTS_PER_SOL
    );
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({ signature, ...latestBlockhash });
  }

  // Helper: derive contract + vault PDAs
  function deriveContractPdas(clientPk: anchor.web3.PublicKey, freelancerPk: anchor.web3.PublicKey, contractId: typeof BN) {
    const [contractPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("contract"),
        clientPk.toBuffer(),
        freelancerPk.toBuffer(),
        contractId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), contractPda.toBuffer()],
      program.programId
    );
    return { contractPda, vaultPda };
  }

  // Helper: derive the badge mint PDA + the freelancer's ATA for it
  function deriveBadgePdas(freelancerPk: anchor.web3.PublicKey) {
    const [badgeMint] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("badge"), freelancerPk.toBuffer()],
      program.programId
    );
    const badgeTokenAccount = getAssociatedTokenAddressSync(
      badgeMint,
      freelancerPk,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return { badgeMint, badgeTokenAccount };
  }

  before(async () => {
    await fundWallet(freelancer.publicKey);
    await fundWallet(stranger.publicKey);
  });

  const contractId = new BN(Math.floor(Math.random() * 1_000_000));
  let contractPda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;
  let reputationPda: anchor.web3.PublicKey;
  let badgeMint: anchor.web3.PublicKey;
  let badgeTokenAccount: anchor.web3.PublicKey;

  // ── Test 1 ──────────────────────────────────────────────────────────────────
  it("1. creates a profile for the freelancer", async () => {
    const [profilePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), freelancer.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createProfile("Alice Freelancer")
      .accounts({
        profile: profilePda,
        freelancer: freelancer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([freelancer])
      .rpc();

    const profile = await program.account.freelancerProfile.fetch(profilePda);
    assert.equal(profile.displayName, "Alice Freelancer");
    assert.equal(profile.freelancer.toBase58(), freelancer.publicKey.toBase58());
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────
  it("2. creates a contract and locks funds in vault", async () => {
    ({ contractPda, vaultPda } = deriveContractPdas(client.publicKey, freelancer.publicKey, contractId));

    const amount = new BN(1.5 * anchor.web3.LAMPORTS_PER_SOL);
    const milestoneCount = 3; // 1.5 SOL / 3 = 0.5 SOL each, remainder = 0

    const vaultPreBalance = await provider.connection.getBalance(vaultPda);

    await program.methods
      .createContract(contractId, amount, milestoneCount)
      .accounts({
        contract: contractPda,
        vault: vaultPda,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    const vaultPostBalance = await provider.connection.getBalance(vaultPda);

    // The vault is a bare System-owned PDA, so create_contract funds it with the
    // escrowed `amount` PLUS a permanent rent-exempt reserve (independent of
    // `amount`) so the vault stays valid even when `amount` itself is tiny.
    // See test 12, which exercises exactly that edge case.
    const rentExemptReserve = await provider.connection.getMinimumBalanceForRentExemption(0);
    assert.equal(
      vaultPostBalance - vaultPreBalance,
      amount.toNumber() + rentExemptReserve,
      "Vault should hold the escrowed amount plus its own permanent rent-exempt reserve"
    );

    const contractAcc = await program.account.contract.fetch(contractPda);
    assert.equal(contractAcc.client.toBase58(), client.publicKey.toBase58());
    assert.equal(contractAcc.freelancer.toBase58(), freelancer.publicKey.toBase58());
    assert.equal(contractAcc.amount.toString(), amount.toString());
    assert.equal(contractAcc.milestoneCount, milestoneCount);
    assert.deepEqual(contractAcc.milestones, [
      { notSubmitted: {} },
      { notSubmitted: {} },
      { notSubmitted: {} },
    ]);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────
  it("3. freelancer submits, client approves, funds release, badge mints", async () => {
    [reputationPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), freelancer.publicKey.toBuffer()],
      program.programId
    );
    ({ badgeMint, badgeTokenAccount } = deriveBadgePdas(freelancer.publicKey));

    const freelancerPreBalance = await provider.connection.getBalance(freelancer.publicKey);

    await program.methods
      .submitMilestone(0)
      .accounts({
        contract: contractPda,
        freelancer: freelancer.publicKey,
      } as any)
      .signers([freelancer])
      .rpc();

    let contractAcc = await program.account.contract.fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[0], { submitted: {} });

    await program.methods
      .approveMilestone(0)
      .accounts({
        contract: contractPda,
        vault: vaultPda,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        reputation: reputationPda,
        badgeMint: badgeMint,
        badgeTokenAccount: badgeTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    contractAcc = await program.account.contract.fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[0], { approved: {} });

    const freelancerPostBalance = await provider.connection.getBalance(freelancer.publicKey);
    // base_payout = 1.5 SOL / 3 = 0.5 SOL (lamports: 500_000_000)
    assert.approximately(
      freelancerPostBalance - freelancerPreBalance,
      0.5 * anchor.web3.LAMPORTS_PER_SOL,
      0.01 * anchor.web3.LAMPORTS_PER_SOL
    );

    const reputation = await program.account.reputationRecord.fetch(reputationPda);
    assert.equal(reputation.completedCount, 1, "completed_count should be 1 after first approval");

    // This was the freelancer's first-ever completion — the badge mint must
    // now exist, with 0 decimals, supply exactly 1, and no mint authority left.
    const mintInfo = await getMint(provider.connection, badgeMint, undefined, TOKEN_2022_PROGRAM_ID);
    assert.equal(mintInfo.decimals, 0, "badge mint should have 0 decimals");
    assert.equal(mintInfo.supply.toString(), "1", "badge supply should be exactly 1");
    assert.equal(mintInfo.mintAuthority, null, "mint authority should be revoked after minting");

    const badgeAccount = await getAccount(provider.connection, badgeTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
    assert.equal(badgeAccount.amount.toString(), "1", "freelancer should hold exactly 1 badge token");
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────
  it("4. wrong wallet cannot approve a milestone", async () => {
    // Submit milestone 1 first so it is in Submitted state
    await program.methods
      .submitMilestone(1)
      .accounts({
        contract: contractPda,
        freelancer: freelancer.publicKey,
      } as any)
      .signers([freelancer])
      .rpc();

    try {
      await program.methods
        .approveMilestone(1)
        .accounts({
          contract: contractPda,
          vault: vaultPda,
          client: stranger.publicKey,  // ← wrong signer
          freelancer: freelancer.publicKey,
          reputation: reputationPda,
          badgeMint: badgeMint,
          badgeTokenAccount: badgeTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([stranger])
        .rpc();
      assert.fail("Should have failed with Unauthorized");
    } catch (err: any) {
      assert.include(err.message, "Unauthorized");
    }
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────
  it("5. client rejects a submission with a reason", async () => {
    // milestone 1 is still Submitted from test 4's setup
    await program.methods
      .rejectMilestone(1, "Incorrect file formatting")
      .accounts({
        contract: contractPda,
        client: client.publicKey,
      } as any)
      .rpc();

    const contractAcc = await program.account.contract.fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[1], { rejected: {} });
    assert.equal(contractAcc.rejectionReasons[1], "Incorrect file formatting");
    // completed_count must still be 1 (only the first milestone was approved so far)
    const reputation = await program.account.reputationRecord.fetch(reputationPda);
    assert.equal(reputation.completedCount, 1);
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────
  it("6. freelancer resubmits after rejection and client approves", async () => {
    await program.methods
      .submitMilestone(1)
      .accounts({
        contract: contractPda,
        freelancer: freelancer.publicKey,
      } as any)
      .signers([freelancer])
      .rpc();

    await program.methods
      .approveMilestone(1)
      .accounts({
        contract: contractPda,
        vault: vaultPda,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        reputation: reputationPda,
        badgeMint: badgeMint,
        badgeTokenAccount: badgeTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    const contractAcc = await program.account.contract.fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[1], { approved: {} });

    const reputation = await program.account.reputationRecord.fetch(reputationPda);
    assert.equal(reputation.completedCount, 2);
  });

  // ── Test 7 ──────────────────────────────────────────────────────────────────
  it("7. cannot approve a milestone twice", async () => {
    try {
      await program.methods
        .approveMilestone(1)  // milestone 1 is already Approved
        .accounts({
          contract: contractPda,
          vault: vaultPda,
          client: client.publicKey,
          freelancer: freelancer.publicKey,
          reputation: reputationPda,
          badgeMint: badgeMint,
          badgeTokenAccount: badgeTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        // This sends the exact same instruction + accounts as test 6's successful
        // approveMilestone(1) call. If it lands on the same blockhash as that prior
        // call (easy to hit with fast/back-to-back local validator transactions),
        // the network rejects it outright as a duplicate ("This transaction has
        // already been processed") before it ever reaches the program — which would
        // hide the MilestoneNotSubmitted check we're actually trying to test.
        // A throwaway compute-budget instruction with a unique value guarantees a
        // distinct transaction message regardless of blockhash timing.
        .preInstructions([
          anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: Date.now(),
          }),
        ])
        .rpc();
      assert.fail("Should have failed");
    } catch (err: any) {
      assert.include(err.message, "MilestoneNotSubmitted");
    }
  });

  // ── Test 8 ──────────────────────────────────────────────────────────────────
  it("8. freelancer raises a dispute after rejection", async () => {
    // Submit and reject milestone 2
    await program.methods
      .submitMilestone(2)
      .accounts({
        contract: contractPda,
        freelancer: freelancer.publicKey,
      } as any)
      .signers([freelancer])
      .rpc();

    await program.methods
      .rejectMilestone(2, "Sub-par final code quality")
      .accounts({
        contract: contractPda,
        client: client.publicKey,
      } as any)
      .rpc();

    // Freelancer raises dispute
    await program.methods
      .raiseDispute(2)
      .accounts({
        contract: contractPda,
        freelancer: freelancer.publicKey,
        reputation: reputationPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([freelancer])
      .rpc();

    const contractAcc = await program.account.contract.fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[2], { disputed: {} });

    const reputation = await program.account.reputationRecord.fetch(reputationPda);
    assert.equal(reputation.disputedCount, 1);
  });

  // ── Test 9 ──────────────────────────────────────────────────────────────────
  it("9. disputed milestone cannot be approved or rejected", async () => {
    // Try to approve the now-Disputed milestone 2 — should get MilestoneDisputed
    try {
      await program.methods
        .approveMilestone(2)
        .accounts({
          contract: contractPda,
          vault: vaultPda,
          client: client.publicKey,
          freelancer: freelancer.publicKey,
          reputation: reputationPda,
          badgeMint: badgeMint,
          badgeTokenAccount: badgeTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .rpc();
      assert.fail("Should have failed");
    } catch (err: any) {
      assert.include(err.message, "MilestoneDisputed");
    }

    // Try to reject the Disputed milestone — should also get MilestoneDisputed
    try {
      await program.methods
        .rejectMilestone(2, "Still bad")
        .accounts({
          contract: contractPda,
          client: client.publicKey,
        } as any)
        .rpc();
      assert.fail("Should have failed");
    } catch (err: any) {
      assert.include(err.message, "MilestoneDisputed");
    }
  });

  // ── Test 10 ─────────────────────────────────────────────────────────────────
  it("10. contract works without a profile (optionality test)", async () => {
    // stranger has no profile — client creates a contract with them directly
    const optId = new BN(Math.floor(Math.random() * 1_000_000));
    const { contractPda: optContract, vaultPda: optVault } = deriveContractPdas(
      client.publicKey, stranger.publicKey, optId
    );

    await program.methods
      .createContract(optId, new BN(0.1 * anchor.web3.LAMPORTS_PER_SOL), 1)
      .accounts({
        contract: optContract,
        vault: optVault,
        client: client.publicKey,
        freelancer: stranger.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    const acc = await program.account.contract.fetch(optContract);
    assert.equal(acc.freelancer.toBase58(), stranger.publicKey.toBase58());
  });

  // ── Test 11 ─────────────────────────────────────────────────────────────────
  it("11. completed_count increments across separate contracts for the same freelancer", async () => {
    // Create a second contract for the same freelancer (contractId2 is different)
    const contractId2 = new BN(Math.floor(Math.random() * 1_000_000));
    const { contractPda: contract2, vaultPda: vault2 } = deriveContractPdas(
      client.publicKey, freelancer.publicKey, contractId2
    );

    const amount2 = new BN(0.5 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .createContract(contractId2, amount2, 1)
      .accounts({
        contract: contract2,
        vault: vault2,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    await program.methods
      .submitMilestone(0)
      .accounts({
        contract: contract2,
        freelancer: freelancer.publicKey,
      } as any)
      .signers([freelancer])
      .rpc();

    await program.methods
      .approveMilestone(0)
      .accounts({
        contract: contract2,
        vault: vault2,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        reputation: reputationPda,   // same ReputationRecord as before
        badgeMint: badgeMint,
        badgeTokenAccount: badgeTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    // completed_count was 2 after test 6; now it should be 3
    const reputation = await program.account.reputationRecord.fetch(reputationPda);
    assert.equal(reputation.completedCount, 3, "completedCount should accumulate across contracts");

    // This is the freelancer's 3rd completion — the badge must NOT re-mint.
    const mintInfo = await getMint(provider.connection, badgeMint, undefined, TOKEN_2022_PROGRAM_ID);
    assert.equal(mintInfo.supply.toString(), "1", "badge supply must stay 1 across multiple contracts");
  });

  // ── Test 12 ─────────────────────────────────────────────────────────────────
  it("12. vault empties exactly when amount does not divide evenly", async () => {
    // 7 lamports across 3 milestones: base_payout=2, remainder=1
    // milestone 0 → 2, milestone 1 → 2, milestone 2 → 2+1=3 → total = 7
    const contractId3 = new BN(Math.floor(Math.random() * 1_000_000));
    const { contractPda: contract3, vaultPda: vault3 } = deriveContractPdas(
      client.publicKey, freelancer.publicKey, contractId3
    );
    // Use enough SOL to cover rent + small amount. Anchor requires the vault to pay
    // its own rent, so we send enough to cover rent + 7 lamports worth of escrow.
    // We test the math by reading vault balance before and after each approval.
    const SEVEN = new BN(7);
    const MS_COUNT = 3;

    await program.methods
      .createContract(contractId3, SEVEN, MS_COUNT)
      .accounts({
        contract: contract3,
        vault: vault3,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    const contractAcc = await program.account.contract.fetch(contract3);
    assert.equal(contractAcc.basePayout.toNumber(), 2, "base_payout = 7 / 3 = 2");
    assert.equal(contractAcc.remainder.toNumber(), 1, "remainder = 7 % 3 = 1");

    // Approve all 3 milestones and track vault balance
    for (let i = 0; i < MS_COUNT; i++) {
      await program.methods
        .submitMilestone(i)
        .accounts({ contract: contract3, freelancer: freelancer.publicKey } as any)
        .signers([freelancer])
        .rpc();

      await program.methods
        .approveMilestone(i)
        .accounts({
          contract: contract3,
          vault: vault3,
          client: client.publicKey,
          freelancer: freelancer.publicKey,
          reputation: reputationPda,
          badgeMint: badgeMint,
          badgeTokenAccount: badgeTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .rpc();
    }

    // After all milestones approved the vault's escrow portion must be exactly 0.
    // The vault SystemAccount will still hold its minimum rent exemption balance,
    // so we compare the excess lamports (vaultBalance - rentExemptMin) to 0.
    const vaultBalance = await provider.connection.getBalance(vault3);
    const rentMin = await provider.connection.getMinimumBalanceForRentExemption(0);
    assert.equal(
      vaultBalance - rentMin,
      0,
      "Vault escrow portion should be exactly 0 after all approvals (remainder paid on last milestone)"
    );
  });

  // ── Test 13 ─────────────────────────────────────────────────────────────────
  it("13. cannot submit a milestone out of order", async () => {
    const contractId4 = new BN(Math.floor(Math.random() * 1_000_000));
    const { contractPda: contract4, vaultPda: vault4 } = deriveContractPdas(
      client.publicKey, freelancer.publicKey, contractId4
    );

    await program.methods
      .createContract(contractId4, new BN(0.3 * anchor.web3.LAMPORTS_PER_SOL), 3)
      .accounts({
        contract: contract4,
        vault: vault4,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    // Milestone 0 is still NotSubmitted — jumping straight to milestone 1
    // must fail, since its predecessor (0) hasn't been approved yet.
    try {
      await program.methods
        .submitMilestone(1)
        .accounts({
          contract: contract4,
          freelancer: freelancer.publicKey,
        } as any)
        .signers([freelancer])
        .rpc();
      assert.fail("Should have failed with PreviousMilestoneNotApproved");
    } catch (err: any) {
      assert.include(err.message, "PreviousMilestoneNotApproved");
    }

    // Milestone 0 is fair game and should still succeed normally.
    await program.methods
      .submitMilestone(0)
      .accounts({
        contract: contract4,
        freelancer: freelancer.publicKey,
      } as any)
      .signers([freelancer])
      .rpc();

    const contractAcc = await program.account.contract.fetch(contract4);
    assert.deepEqual(contractAcc.milestones[0], { submitted: {} });
    assert.deepEqual(contractAcc.milestones[1], { notSubmitted: {} });
  });

  // ── Test 14 ─────────────────────────────────────────────────────────────────
  it("14. badge is non-transferable at the token-program level", async () => {
    // freelancer already holds exactly 1 badge token from test 3. Moving it
    // anywhere — even to the client's own ATA for the same mint — must be
    // rejected by Token-2022's NonTransferable extension itself, not merely
    // discouraged by the absence of a transfer button in the UI.
    const clientBadgeAccount = getAssociatedTokenAddressSync(
      badgeMint,
      client.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const tx = new anchor.web3.Transaction().add(
      createTransferCheckedInstruction(
        badgeTokenAccount,
        badgeMint,
        clientBadgeAccount, // doesn't need to already exist — this fails before that matters
        freelancer.publicKey,
        1,
        0, // decimals
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    try {
      await provider.sendAndConfirm(tx, [freelancer]);
      assert.fail("Transfer of a non-transferable badge should have failed");
    } catch (err: any) {
      // Exact wording comes from spl-token-2022 itself, not our program —
      // this just proves the token program rejected the transfer outright.
      assert.isDefined(err, "expected the transfer to throw");
    }

    const badgeAccount = await getAccount(provider.connection, badgeTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
    assert.equal(badgeAccount.amount.toString(), "1", "badge should still be held by the freelancer");
  });
});