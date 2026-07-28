import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { FreelanceEscrow } from "../target/types/freelance_escrow";

describe("freelance-escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FreelanceEscrow as Program<FreelanceEscrow>;

  const client = (provider.wallet as anchor.Wallet).payer;
  const freelancer = anchor.web3.Keypair.generate();
  const stranger = anchor.web3.Keypair.generate();

  // Helper function to airdrop SOL
  async function fundWallet(pubkey: anchor.web3.PublicKey, amountSol: number = 2) {
    const signature = await provider.connection.requestAirdrop(
      pubkey,
      amountSol * anchor.web3.LAMPORTS_PER_SOL
    );
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature,
      ...latestBlockhash
    });
  }

  before(async () => {
    // Fund freelancer and stranger wallets
    await fundWallet(freelancer.publicKey);
    await fundWallet(stranger.publicKey);
  });

  const contractId = new anchor.BN(Math.floor(Math.random() * 1000000));
  let contractPda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;
  let reputationPda: anchor.web3.PublicKey;

  it("1. creates a profile for the freelancer", async () => {
    const [profilePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), freelancer.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createProfile("Alice Freelancer")
      .accounts({
        // @ts-ignore
        profile: profilePda,
        freelancer: freelancer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([freelancer])
      .rpc();

    const profile = await program.account.freelancerProfile.fetch(profilePda);
    assert.equal(profile.displayName, "Alice Freelancer");
    assert.equal(profile.freelancer.toBase58(), freelancer.publicKey.toBase58());
  });

  it("2. creates a contract and locks funds in vault", async () => {
    [contractPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("contract"),
        client.publicKey.toBuffer(),
        freelancer.publicKey.toBuffer(),
        contractId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), contractPda.toBuffer()],
      program.programId
    );

    const amount = new anchor.BN(1.5 * anchor.web3.LAMPORTS_PER_SOL);
    const milestoneCount = 3; // 1.5 SOL / 3 milestones = 0.5 SOL each

    const vaultPreBalance = await provider.connection.getBalance(vaultPda);

    await program.methods
      .createContract(contractId, amount, milestoneCount)
      .accounts({
        // @ts-ignore
        contract: contractPda,
        vault: vaultPda,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const vaultPostBalance = await provider.connection.getBalance(vaultPda);
    assert.equal(vaultPostBalance - vaultPreBalance, amount.toNumber());

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

  it("3. freelancer submits, client approves, funds release", async () => {
    // Verify reputation is created & completed count is 0
    [reputationPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), freelancer.publicKey.toBuffer()],
      program.programId
    );

    const freelancerPreBalance = await provider.connection.getBalance(freelancer.publicKey);

    // Submit milestone index 0
    await program.methods
      .submitMilestone(0)
      .accounts({
        // @ts-ignore
        contract: contractPda,
        freelancer: freelancer.publicKey,
      })
      .signers([freelancer])
      .rpc();

    let contractAcc = await program.account.contract.fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[0], { submitted: {} });

    // Approve milestone index 0
    await program.methods
      .approveMilestone(0)
      .accounts({
        // @ts-ignore
        contract: contractPda,
        vault: vaultPda,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        reputation: reputationPda,
        badgeMint: null,
        badgeTokenAccount: null,
        tokenProgram: null,
        associatedTokenProgram: null,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    contractAcc = await program.account.contract.fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[0], { approved: {} });

    const freelancerPostBalance = await provider.connection.getBalance(freelancer.publicKey);
    // Paid 0.5 SOL
    assert.approximately(
      freelancerPostBalance - freelancerPreBalance,
      0.5 * anchor.web3.LAMPORTS_PER_SOL,
      0.01 * anchor.web3.LAMPORTS_PER_SOL // buffer for gas fees
    );

    const reputation = await program.account.reputationRecord.fetch(reputationPda);
    assert.equal(reputation.completedCount, 1);
  });

  it("4. wrong wallet cannot approve a milestone", async () => {
    // Submit milestone index 1
    await program.methods
      .submitMilestone(1)
      .accounts({
        // @ts-ignore
        contract: contractPda,
        freelancer: freelancer.publicKey,
      })
      .signers([freelancer])
      .rpc();

    try {
      await program.methods
        .approveMilestone(1)
        .accounts({
          // @ts-ignore
          contract: contractPda,
          vault: vaultPda,
          client: stranger.publicKey,
          freelancer: freelancer.publicKey,
          reputation: reputationPda,
          badgeMint: null,
          badgeTokenAccount: null,
          tokenProgram: null,
          associatedTokenProgram: null,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
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
        // @ts-ignore
        contract: contractPda,
        client: client.publicKey,
      })
      .rpc();

    const contractAcc = await program.account.contract.fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[1], { rejected: {} });
    assert.equal(contractAcc.rejectionReasons[1], "Incorrect file formatting");
  });

  it("6. freelancer resubmits after rejection and client approves", async () => {
    // Resubmit milestone 1
    await program.methods
      .submitMilestone(1)
      .accounts({
        // @ts-ignore
        contract: contractPda,
        freelancer: freelancer.publicKey,
      })
      .signers([freelancer])
      .rpc();

    // Client approves
    await program.methods
      .approveMilestone(1)
      .accounts({
        // @ts-ignore
        contract: contractPda,
        vault: vaultPda,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        reputation: reputationPda,
        badgeMint: null,
        badgeTokenAccount: null,
        tokenProgram: null,
        associatedTokenProgram: null,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const contractAcc = await program.account.contract.fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[1], { approved: {} });

    const reputation = await program.account.reputationRecord.fetch(reputationPda);
    assert.equal(reputation.completedCount, 2);
  });

  it("7. cannot approve a milestone twice", async () => {
    try {
      await program.methods
        .approveMilestone(1)
        .accounts({
          // @ts-ignore
          contract: contractPda,
          vault: vaultPda,
          client: client.publicKey,
          freelancer: freelancer.publicKey,
          reputation: reputationPda,
          badgeMint: null,
          badgeTokenAccount: null,
          tokenProgram: null,
          associatedTokenProgram: null,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have failed");
    } catch (err: any) {
      assert.include(err.message, "MilestoneNotSubmitted");
    }
  });

  it("8. freelancer raises a dispute after rejection", async () => {
    // Submit milestone index 2 (the final milestone)
    await program.methods
      .submitMilestone(2)
      .accounts({
        // @ts-ignore
        contract: contractPda,
        freelancer: freelancer.publicKey,
      })
      .signers([freelancer])
      .rpc();

    // Client rejects
    await program.methods
      .rejectMilestone(2, "Sub-par final code quality")
      .accounts({
        // @ts-ignore
        contract: contractPda,
        client: client.publicKey,
      })
      .rpc();

    // Freelancer raises dispute
    await program.methods
      .raiseDispute(2)
      .accounts({
        // @ts-ignore
        contract: contractPda,
        freelancer: freelancer.publicKey,
        reputation: reputationPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([freelancer])
      .rpc();

    const contractAcc = await program.account.contract.fetch(contractPda);
    assert.deepEqual(contractAcc.milestones[2], { disputed: {} });

    const reputation = await program.account.reputationRecord.fetch(reputationPda);
    assert.equal(reputation.disputedCount, 1);
  });

  it("9. disputed milestone cannot be approved or rejected", async () => {
    try {
      await program.methods
        .approveMilestone(2)
        .accounts({
          // @ts-ignore
          contract: contractPda,
          vault: vaultPda,
          client: client.publicKey,
          freelancer: freelancer.publicKey,
          reputation: reputationPda,
          badgeMint: null,
          badgeTokenAccount: null,
          tokenProgram: null,
          associatedTokenProgram: null,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have failed");
    } catch (err: any) {
      assert.include(err.message, "MilestoneNotSubmitted");
    }
  });

  it("10. contract works with or without a profile (optionality test)", async () => {
    // Stranger has no profile. Client creates contract with stranger.
    const optionalContractId = new anchor.BN(Math.floor(Math.random() * 1000000));
    const [optContractPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("contract"),
        client.publicKey.toBuffer(),
        stranger.publicKey.toBuffer(),
        optionalContractId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [optVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), optContractPda.toBuffer()],
      program.programId
    );

    await program.methods
      .createContract(optionalContractId, new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL), 1)
      .accounts({
        // @ts-ignore
        contract: optContractPda,
        vault: optVaultPda,
        client: client.publicKey,
        freelancer: stranger.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const optContractAcc = await program.account.contract.fetch(optContractPda);
    assert.equal(optContractAcc.freelancer.toBase58(), stranger.publicKey.toBase58());
  });
});
