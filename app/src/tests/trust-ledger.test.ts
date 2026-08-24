import { AnchorProvider, Program, setProvider } from "@anchor-lang/core";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram, Transaction } from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { getMint, getAccount, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { IDL, TrustLedger } from "../types/idl";
import {
  deriveProfilePda,
  deriveContractPda,
  deriveVaultPda,
  deriveReputationPda,
  deriveBadgeMintPda,
  deriveBadgeTokenAccount,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "../lib/pda";
import {
  contracts,
  freelancerProfiles,
  reputationRecords,
} from "../types/accounts";

describe("trust-ledger frontend integration", () => {
  const provider = AnchorProvider.env();
  setProvider(provider);

  const program = new Program<TrustLedger>(IDL, provider);

  const client = (provider.wallet as any).payer as Keypair;
  const freelancer = Keypair.generate();
  const stranger = Keypair.generate();

  async function fundWallet(pubkey: PublicKey, amountSol = 2) {
    const signature = await provider.connection.requestAirdrop(
      pubkey,
      amountSol * LAMPORTS_PER_SOL
    );
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({ signature, ...latestBlockhash });
  }

  function deriveContractPdas(clientPk: PublicKey, freelancerPk: PublicKey, contractId: BN) {
    const contractPda = deriveContractPda(clientPk, freelancerPk, contractId);
    const vaultPda = deriveVaultPda(contractPda);
    return { contractPda, vaultPda };
  }

  before(async () => {
    await fundWallet(freelancer.publicKey);
    await fundWallet(stranger.publicKey);
  });

  const contractId = new BN(Math.floor(Math.random() * 1_000_000));
  let contractPda: PublicKey;
  let vaultPda: PublicKey;
  let reputationPda: PublicKey;
  let badgeMint: PublicKey;
  let badgeTokenAccount: PublicKey;

  it("1. creates a profile for the freelancer", async () => {
    const profilePda = deriveProfilePda(freelancer.publicKey);

    await program.methods
      .createProfile("Alice Freelancer")
      .accounts({
        profile: profilePda,
        freelancer: freelancer.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([freelancer])
      .rpc();

    const profile = await freelancerProfiles(program).fetchNullable(profilePda);
    assert.isNotNull(profile);
    assert.equal(profile!.displayName, "Alice Freelancer");
    assert.equal(profile!.freelancer.toBase58(), freelancer.publicKey.toBase58());
  });

  it("2. creates a contract and locks funds in vault", async () => {
    ({ contractPda, vaultPda } = deriveContractPdas(client.publicKey, freelancer.publicKey, contractId));

    const amount = new BN(1.5 * LAMPORTS_PER_SOL);
    const milestoneCount = 3;

    const vaultPreBalance = await provider.connection.getBalance(vaultPda);

    await program.methods
      .createContract(contractId, amount, milestoneCount)
      .accounts({
        contract: contractPda,
        vault: vaultPda,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const vaultPostBalance = await provider.connection.getBalance(vaultPda);
    const rentExemptReserve = await provider.connection.getMinimumBalanceForRentExemption(0);
    assert.equal(
      vaultPostBalance - vaultPreBalance,
      amount.toNumber() + rentExemptReserve,
      "Vault should hold the escrowed amount plus its own permanent rent-exempt reserve"
    );

    const contractAcc = await contracts(program).fetch(contractPda);
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

  it("3. freelancer submits, client approves, funds release, badge mints", async () => {
    reputationPda = deriveReputationPda(freelancer.publicKey);
    badgeMint = deriveBadgeMintPda(freelancer.publicKey);
    badgeTokenAccount = deriveBadgeTokenAccount(freelancer.publicKey);

    const freelancerPreBalance = await provider.connection.getBalance(freelancer.publicKey);

    await program.methods
      .submitMilestone(0)
      .accounts({
        contract: contractPda,
        freelancer: freelancer.publicKey,
      } as any)
      .signers([freelancer])
      .rpc();

    let contractAcc = await contracts(program).fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[0], { submitted: {} });

    await program.methods
      .approveMilestone(0)
      .accounts({
        contract: contractPda,
        vault: vaultPda,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        reputation: reputationPda,
        badgeMint,
        badgeTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    contractAcc = await contracts(program).fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[0], { approved: {} });

    const freelancerPostBalance = await provider.connection.getBalance(freelancer.publicKey);
    assert.approximately(
      freelancerPostBalance - freelancerPreBalance,
      0.5 * LAMPORTS_PER_SOL,
      0.01 * LAMPORTS_PER_SOL
    );

    const reputation = await reputationRecords(program).fetchNullable(reputationPda);
    assert.isNotNull(reputation);
    assert.equal(reputation!.completedCount, 1);

    const mintInfo = await getMint(provider.connection, badgeMint, undefined, TOKEN_2022_PROGRAM_ID);
    assert.equal(mintInfo.decimals, 0);
    assert.equal(mintInfo.supply.toString(), "1");
    assert.equal(mintInfo.mintAuthority, null);

    const badgeAccount = await getAccount(provider.connection, badgeTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
    assert.equal(badgeAccount.amount.toString(), "1");
  });

  it("4. wrong wallet cannot approve a milestone", async () => {
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
          client: stranger.publicKey,
          freelancer: freelancer.publicKey,
          reputation: reputationPda,
          badgeMint,
          badgeTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([stranger])
        .rpc();
      assert.fail("Should have failed with Unauthorized");
    } catch (err: any) {
      assert.include(err.message, "Unauthorized");
    }
  });

  it("5. client rejects a submission with a reason", async () => {
    await program.methods
      .rejectMilestone(1, "Incorrect file formatting")
      .accounts({
        contract: contractPda,
        client: client.publicKey,
      } as any)
      .rpc();

    const contractAcc = await contracts(program).fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[1], { rejected: {} });
    assert.equal(contractAcc.rejectionReasons[1], "Incorrect file formatting");

    const reputation = await reputationRecords(program).fetchNullable(reputationPda);
    assert.isNotNull(reputation);
    assert.equal(reputation!.completedCount, 1);
  });

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
        badgeMint,
        badgeTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const contractAcc = await contracts(program).fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[1], { approved: {} });

    const reputation = await reputationRecords(program).fetchNullable(reputationPda);
    assert.isNotNull(reputation);
    assert.equal(reputation!.completedCount, 2);
  });

  it("7. cannot approve a milestone twice", async () => {
    try {
      await program.methods
        .approveMilestone(1)
        .accounts({
          contract: contractPda,
          vault: vaultPda,
          client: client.publicKey,
          freelancer: freelancer.publicKey,
          reputation: reputationPda,
          badgeMint,
          badgeTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: Date.now(),
          }),
        ])
        .rpc();
      assert.fail("Should have failed");
    } catch (err: any) {
      assert.include(err.message, "MilestoneNotSubmitted");
    }
  });

  it("8. freelancer raises a dispute after rejection", async () => {
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

    await program.methods
      .raiseDispute(2)
      .accounts({
        contract: contractPda,
        freelancer: freelancer.publicKey,
        reputation: reputationPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([freelancer])
      .rpc();

    const contractAcc = await contracts(program).fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[2], { disputed: {} });

    const reputation = await reputationRecords(program).fetchNullable(reputationPda);
    assert.isNotNull(reputation);
    assert.equal(reputation!.disputedCount, 1);
  });

  it("9. disputed milestone cannot be approved or rejected", async () => {
    try {
      await program.methods
        .approveMilestone(2)
        .accounts({
          contract: contractPda,
          vault: vaultPda,
          client: client.publicKey,
          freelancer: freelancer.publicKey,
          reputation: reputationPda,
          badgeMint,
          badgeTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
      assert.fail("Should have failed");
    } catch (err: any) {
      assert.include(err.message, "MilestoneDisputed");
    }

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

  it("10. contract works without a profile (optionality test)", async () => {
    const optId = new BN(Math.floor(Math.random() * 1_000_000));
    const { contractPda: optContract, vaultPda: optVault } = deriveContractPdas(
      client.publicKey, stranger.publicKey, optId
    );

    await program.methods
      .createContract(optId, new BN(0.1 * LAMPORTS_PER_SOL), 1)
      .accounts({
        contract: optContract,
        vault: optVault,
        client: client.publicKey,
        freelancer: stranger.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const acc = await contracts(program).fetch(optContract);
    assert.equal(acc.freelancer.toBase58(), stranger.publicKey.toBase58());
  });

  it("11. completed_count increments across separate contracts for the same freelancer", async () => {
    const contractId2 = new BN(Math.floor(Math.random() * 1_000_000));
    const { contractPda: contract2, vaultPda: vault2 } = deriveContractPdas(
      client.publicKey, freelancer.publicKey, contractId2
    );

    const amount2 = new BN(0.5 * LAMPORTS_PER_SOL);

    await program.methods
      .createContract(contractId2, amount2, 1)
      .accounts({
        contract: contract2,
        vault: vault2,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        systemProgram: SystemProgram.programId,
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
        reputation: reputationPda,
        badgeMint,
        badgeTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const reputation = await reputationRecords(program).fetchNullable(reputationPda);
    assert.isNotNull(reputation);
    assert.equal(reputation!.completedCount, 3);

    const mintInfo = await getMint(provider.connection, badgeMint, undefined, TOKEN_2022_PROGRAM_ID);
    assert.equal(mintInfo.supply.toString(), "1");
  });

  it("12. vault empties exactly when amount does not divide evenly", async () => {
    const contractId3 = new BN(Math.floor(Math.random() * 1_000_000));
    const { contractPda: contract3, vaultPda: vault3 } = deriveContractPdas(
      client.publicKey, freelancer.publicKey, contractId3
    );
    const SEVEN = new BN(7);
    const MS_COUNT = 3;

    await program.methods
      .createContract(contractId3, SEVEN, MS_COUNT)
      .accounts({
        contract: contract3,
        vault: vault3,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const contractAcc = await contracts(program).fetch(contract3);
    assert.equal(contractAcc.basePayout.toNumber(), 2);
    assert.equal(contractAcc.remainder.toNumber(), 1);

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
          badgeMint,
          badgeTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
    }

    const vaultBalance = await provider.connection.getBalance(vault3);
    const rentMin = await provider.connection.getMinimumBalanceForRentExemption(0);
    assert.equal(
      vaultBalance - rentMin,
      0,
      "Vault escrow portion should be exactly 0 after all approvals"
    );
  });

  it("13. cannot submit a milestone out of order", async () => {
    const contractId4 = new BN(Math.floor(Math.random() * 1_000_000));
    const { contractPda: contract4, vaultPda: vault4 } = deriveContractPdas(
      client.publicKey, freelancer.publicKey, contractId4
    );

    await program.methods
      .createContract(contractId4, new BN(0.3 * LAMPORTS_PER_SOL), 3)
      .accounts({
        contract: contract4,
        vault: vault4,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

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

    await program.methods
      .submitMilestone(0)
      .accounts({
        contract: contract4,
        freelancer: freelancer.publicKey,
      } as any)
      .signers([freelancer])
      .rpc();

    const contractAcc = await contracts(program).fetch(contract4);
    assert.deepEqual(contractAcc.milestones[0], { submitted: {} });
    assert.deepEqual(contractAcc.milestones[1], { notSubmitted: {} });
  });

  it("14. badge is non-transferable at the token-program level", async () => {
    const clientBadgeAccount = getAssociatedTokenAddressSync(
      badgeMint,
      client.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const tx = new Transaction().add(
      createTransferCheckedInstruction(
        badgeTokenAccount,
        badgeMint,
        clientBadgeAccount,
        freelancer.publicKey,
        1,
        0,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    try {
      await provider.sendAndConfirm(tx, [freelancer]);
      assert.fail("Transfer of a non-transferable badge should have failed");
    } catch (err: any) {
      assert.isDefined(err);
    }

    const badgeAccount = await getAccount(provider.connection, badgeTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
    assert.equal(badgeAccount.amount.toString(), "1");
  });
});
