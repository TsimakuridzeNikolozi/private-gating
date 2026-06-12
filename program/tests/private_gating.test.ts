import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { groth16 } from "snarkjs";
import {
  commitmentFromSecret,
  fieldToBytes32,
  gateIdFromPubkey,
  leafHash,
  MerkleTree,
  nullifierFor,
  proofToSolanaBytes,
  publicSignalsToBytes,
  pubkeyToLimbs,
  type SnarkjsProof,
} from "@private-gating/shared";
import idl from "../target/idl/private_gating.json";
import type { PrivateGating } from "../target/types/private_gating";

const here = dirname(fileURLToPath(import.meta.url));
const CIRCUITS = join(here, "..", "..", "circuits", "build");
const GATE_WASM = join(CIRCUITS, "gate_js", "gate.wasm");
const GATE_ZKEY = join(CIRCUITS, "gate.zkey");
const CLAIM_WASM = join(CIRCUITS, "claim_js", "claim.wasm");
const CLAIM_ZKEY = join(CIRCUITS, "claim.zkey");

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = new Program<PrivateGating>(idl as PrivateGating, provider);
const operator = provider.wallet.publicKey;

// snapshot fixture: three members, threshold 10
const SECRETS = [111n, 222n, 333n];
const ATTRIBUTES = [100n, 5n, 10n];
const THRESHOLD = 10n;

const relayer = Keypair.generate();
let tree: MerkleTree;
let gatePda: PublicKey;
let gateBPda: PublicKey;

function sha256(data: Uint8Array | string): Buffer {
  return createHash("sha256").update(data).digest();
}

function gateAddress(label: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("gate"), operator.toBuffer(), sha256(label)],
    program.programId,
  )[0];
}

function nullifierAddress(gate: PublicKey, nullifier: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("nullifier"), gate.toBuffer(), Buffer.from(nullifier)],
    program.programId,
  )[0];
}

async function createGate(label: string, threshold: bigint): Promise<PublicKey> {
  const gate = gateAddress(label);
  await program.methods
    .createGate(
      Array.from(sha256(label)),
      label,
      { tokenBalance: {} },
      Keypair.generate().publicKey, // demo target mint
      new BN(threshold.toString()),
    )
    .accountsPartial({ gate, operator, systemProgram: SystemProgram.programId })
    .rpc();
  return gate;
}

async function publishRoot(gate: PublicKey): Promise<void> {
  await program.methods
    .publishRoot(Array.from(fieldToBytes32(tree.root)), tree.leafCount)
    .accountsPartial({ gate, operator })
    .rpc();
}

/** Generate a gate proof for a member, optionally against a specific gate. */
async function proveGate(member: number, gate: PublicKey) {
  const gateId = await gateIdFromPubkey(gate.toBytes());
  const path = tree.proof(member);
  const { proof, publicSignals } = await groth16.fullProve(
    {
      merkleRoot: tree.root,
      threshold: THRESHOLD,
      gateId,
      secret: SECRETS[member],
      attribute: ATTRIBUTES[member],
      pathElements: path.pathElements,
      pathIndices: path.pathIndices,
    },
    GATE_WASM,
    GATE_ZKEY,
  );
  return {
    proofBytes: proofToSolanaBytes(proof as SnarkjsProof),
    signals: publicSignalsToBytes(publicSignals),
  };
}

/** Submit verify_and_pass through the relayer (the holder signs nothing). */
function submitPass(
  gate: PublicKey,
  proofBytes: Uint8Array,
  signals: Uint8Array[],
  nullifierSeed?: Uint8Array,
) {
  const nullifier = nullifierSeed ?? signals[0];
  return program.methods
    .verifyAndPass(
      Array.from(nullifier),
      Array.from(proofBytes),
      signals.map((s) => Array.from(s)),
    )
    .accountsPartial({
      gate,
      nullifierRecord: nullifierAddress(gate, nullifier),
      payer: relayer.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })])
    .signers([relayer])
    .rpc();
}

beforeAll(async () => {
  const sig = await provider.connection.requestAirdrop(relayer.publicKey, 5 * LAMPORTS_PER_SOL);
  await provider.connection.confirmTransaction(sig);

  const leaves: bigint[] = [];
  for (let i = 0; i < SECRETS.length; i++) {
    leaves.push(await leafHash(await commitmentFromSecret(SECRETS[i]), ATTRIBUTES[i]));
  }
  tree = await MerkleTree.build(leaves);
});

afterAll(async () => {
  const curve = (globalThis as Record<string, any>).curve_bn128;
  if (curve) await curve.terminate();
});

describe("gate lifecycle", () => {
  it("creates a gate and publishes the snapshot root", async () => {
    gatePda = await createGate("members-club", THRESHOLD);
    gateBPda = await createGate("other-gate", THRESHOLD);

    let gate = await program.account.gate.fetch(gatePda);
    expect(gate.status).toEqual({ registering: {} });

    await publishRoot(gatePda);
    await publishRoot(gateBPda);

    gate = await program.account.gate.fetch(gatePda);
    expect(gate.status).toEqual({ live: {} });
    expect(Buffer.from(gate.merkleRoot)).toEqual(Buffer.from(fieldToBytes32(tree.root)));
    expect(gate.memberCount).toBe(3);
  });

  it("verifies a real proof on-chain and consumes the nullifier", async () => {
    const { proofBytes, signals } = await proveGate(0, gatePda);
    await submitPass(gatePda, proofBytes, signals);

    const gate = await program.account.gate.fetch(gatePda);
    expect(gate.passCount.toNumber()).toBe(1);

    const record = await program.account.nullifierRecord.fetch(
      nullifierAddress(gatePda, signals[0]),
    );
    expect(record.gate.toBase58()).toBe(gatePda.toBase58());
    const expectedNullifier = await nullifierFor(
      SECRETS[0],
      await gateIdFromPubkey(gatePda.toBytes()),
    );
    expect(Buffer.from(record.nullifier)).toEqual(Buffer.from(fieldToBytes32(expectedNullifier)));
  });

  it("rejects a replay (same nullifier, fresh proof)", async () => {
    const { proofBytes, signals } = await proveGate(0, gatePda);
    await expect(submitPass(gatePda, proofBytes, signals)).rejects.toThrow(/already in use/i);
  });

  it("rejects a nullifier seed that differs from the proof signal", async () => {
    const { proofBytes, signals } = await proveGate(2, gatePda);
    const bogusSeed = new Uint8Array(32).fill(42);
    await expect(submitPass(gatePda, proofBytes, signals, bogusSeed)).rejects.toThrow(
      /NullifierSeedMismatch/,
    );
  });

  it("rejects a proof bound to a different gate", async () => {
    const { proofBytes, signals } = await proveGate(2, gatePda);
    await expect(submitPass(gateBPda, proofBytes, signals)).rejects.toThrow(/GateIdMismatch/);
  });

  it("rejects tampered root / threshold signals", async () => {
    const { proofBytes, signals } = await proveGate(2, gatePda);

    const badRoot = signals.map((s, i) => (i === 1 ? new Uint8Array(32).fill(1) : s));
    await expect(submitPass(gatePda, proofBytes, badRoot)).rejects.toThrow(/RootMismatch/);

    const badThreshold = signals.map((s, i) => {
      if (i !== 2) return s;
      const t = new Uint8Array(32);
      t[31] = 99;
      return t;
    });
    await expect(submitPass(gatePda, proofBytes, badThreshold)).rejects.toThrow(
      /ThresholdMismatch/,
    );
  });

  it("rejects a tampered proof", async () => {
    const { proofBytes, signals } = await proveGate(2, gatePda);
    const tampered = new Uint8Array(proofBytes);
    tampered[10] ^= 0xff;
    await expect(submitPass(gatePda, tampered, signals)).rejects.toThrow(/InvalidProof/);
  });

  it("accepts the remaining qualifying member (attribute == threshold)", async () => {
    const { proofBytes, signals } = await proveGate(2, gatePda);
    await submitPass(gatePda, proofBytes, signals);
    const gate = await program.account.gate.fetch(gatePda);
    expect(gate.passCount.toNumber()).toBe(2);
  });
});

describe("raffle draw and private claim", () => {
  let winningNullifier: Uint8Array;

  it("operator draws a winner from consumed nullifiers", async () => {
    winningNullifier = fieldToBytes32(
      await nullifierFor(SECRETS[0], await gateIdFromPubkey(gatePda.toBytes())),
    );
    await program.methods
      .drawWinner()
      .accountsPartial({
        gate: gatePda,
        operator,
        winner: nullifierAddress(gatePda, winningNullifier),
      })
      .rpc();
    const gate = await program.account.gate.fetch(gatePda);
    expect(Buffer.from(gate.winningNullifier!)).toEqual(Buffer.from(winningNullifier));
  });

  it("pays the prize to the recipient bound inside the claim proof", async () => {
    // operator funds the prize pot by transferring to the gate PDA
    const fund = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: operator,
        toPubkey: gatePda,
        lamports: LAMPORTS_PER_SOL,
      }),
    );
    await provider.sendAndConfirm(fund);

    const recipient = Keypair.generate().publicKey; // fresh, unlinkable wallet
    const gateId = await gateIdFromPubkey(gatePda.toBytes());
    const { hi, lo } = pubkeyToLimbs(recipient.toBytes());
    const { proof, publicSignals } = await groth16.fullProve(
      {
        nullifier: await nullifierFor(SECRETS[0], gateId),
        gateId,
        recipientHi: hi,
        recipientLo: lo,
        secret: SECRETS[0],
      },
      CLAIM_WASM,
      CLAIM_ZKEY,
    );

    // a relayer submitting to a *different* recipient must fail
    const thief = Keypair.generate().publicKey;
    await expect(
      program.methods
        .claimPrize(
          Array.from(proofToSolanaBytes(proof as SnarkjsProof)),
          publicSignalsToBytes(publicSignals).map((s) => Array.from(s)),
        )
        .accountsPartial({ gate: gatePda, recipient: thief, payer: relayer.publicKey })
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })])
        .signers([relayer])
        .rpc(),
    ).rejects.toThrow(/RecipientMismatch/);

    await program.methods
      .claimPrize(
        Array.from(proofToSolanaBytes(proof as SnarkjsProof)),
        publicSignalsToBytes(publicSignals).map((s) => Array.from(s)),
      )
      .accountsPartial({ gate: gatePda, recipient, payer: relayer.publicKey })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })])
      .signers([relayer])
      .rpc();

    const balance = await provider.connection.getBalance(recipient);
    expect(balance).toBe(LAMPORTS_PER_SOL);
    const gate = await program.account.gate.fetch(gatePda);
    expect(gate.prizeClaimed).toBe(true);

    // double claim refused
    await expect(
      program.methods
        .claimPrize(
          Array.from(proofToSolanaBytes(proof as SnarkjsProof)),
          publicSignalsToBytes(publicSignals).map((s) => Array.from(s)),
        )
        .accountsPartial({ gate: gatePda, recipient, payer: relayer.publicKey })
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })])
        .signers([relayer])
        .rpc(),
    ).rejects.toThrow(/PrizeAlreadyClaimed/);
  });

  it("rejects a claim against an unfunded prize pot (latch stays open)", async () => {
    // Run a member through gate B and draw them, but never fund the pot — the
    // gate account holds only its rent-exempt minimum.
    const { proofBytes, signals } = await proveGate(0, gateBPda);
    await submitPass(gateBPda, proofBytes, signals);

    const gateBId = await gateIdFromPubkey(gateBPda.toBytes());
    const winningNullifierB = fieldToBytes32(await nullifierFor(SECRETS[0], gateBId));
    await program.methods
      .drawWinner()
      .accountsPartial({
        gate: gateBPda,
        operator,
        winner: nullifierAddress(gateBPda, winningNullifierB),
      })
      .rpc();

    // A fully valid claim proof for the bound recipient.
    const recipient = Keypair.generate().publicKey;
    const { hi, lo } = pubkeyToLimbs(recipient.toBytes());
    const { proof, publicSignals } = await groth16.fullProve(
      {
        nullifier: await nullifierFor(SECRETS[0], gateBId),
        gateId: gateBId,
        recipientHi: hi,
        recipientLo: lo,
        secret: SECRETS[0],
      },
      CLAIM_WASM,
      CLAIM_ZKEY,
    );

    // The proof verifies and the recipient matches, but the pot is empty —
    // claiming must revert rather than burn the one-way prize_claimed latch.
    await expect(
      program.methods
        .claimPrize(
          Array.from(proofToSolanaBytes(proof as SnarkjsProof)),
          publicSignalsToBytes(publicSignals).map((s) => Array.from(s)),
        )
        .accountsPartial({ gate: gateBPda, recipient, payer: relayer.publicKey })
        .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })])
        .signers([relayer])
        .rpc(),
    ).rejects.toThrow(/PrizePotEmpty/);

    // The latch is untouched, so a later top-up can still be claimed.
    const gate = await program.account.gate.fetch(gateBPda);
    expect(gate.prizeClaimed).toBe(false);
  });

  it("rejects draw_winner from a non-operator", async () => {
    await expect(
      program.methods
        .drawWinner()
        .accountsPartial({
          gate: gatePda,
          operator: relayer.publicKey,
          winner: nullifierAddress(gatePda, winningNullifier),
        })
        .signers([relayer])
        .rpc(),
    ).rejects.toThrow(/ConstraintHasOne|has one constraint/i);
  });
});
