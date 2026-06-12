import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { groth16 } from "snarkjs";
import {
  commitmentFromSecret,
  gateIdFromPubkey,
  leafHash,
  MerkleTree,
  nullifierFor,
  proofToSolanaBytes,
  publicSignalsToBytes,
  type SnarkjsProof,
} from "@private-gating/shared";

const BUILD = join(__dirname, "..", "build");
const WASM = join(BUILD, "gate_js", "gate.wasm");
const ZKEY = join(BUILD, "gate.zkey");
const VKEY = JSON.parse(readFileSync(join(BUILD, "gate_vkey.json"), "utf8"));

// snapshot fixture: three members with attributes 100, 5, 10
const SECRETS = [111n, 222n, 333n];
const ATTRIBUTES = [100n, 5n, 10n];
const THRESHOLD = 10n;

let tree: MerkleTree;
let gateId: bigint;

function inputsFor(member: number, overrides: Record<string, unknown> = {}) {
  const proof = tree.proof(member);
  return {
    merkleRoot: tree.root,
    threshold: THRESHOLD,
    gateId,
    secret: SECRETS[member],
    attribute: ATTRIBUTES[member],
    pathElements: proof.pathElements,
    pathIndices: proof.pathIndices,
    ...overrides,
  };
}

beforeAll(async () => {
  const leaves: bigint[] = [];
  for (let i = 0; i < SECRETS.length; i++) {
    leaves.push(
      await leafHash(await commitmentFromSecret(SECRETS[i]), ATTRIBUTES[i]),
    );
  }
  tree = await MerkleTree.build(leaves);
  gateId = await gateIdFromPubkey(new Uint8Array(32).fill(9));
});

afterAll(async () => {
  // snarkjs keeps curve worker threads alive; terminate so vitest can exit
  const curve = (globalThis as Record<string, any>).curve_bn128;
  if (curve) await curve.terminate();
});

describe("gate circuit", () => {
  it("proves membership + threshold + nullifier for a qualifying member", async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      inputsFor(0),
      WASM,
      ZKEY,
    );

    // snarkjs public signal order: outputs first, then declared public inputs
    expect(publicSignals).toHaveLength(4);
    expect(BigInt(publicSignals[0])).toBe(
      await nullifierFor(SECRETS[0], gateId),
    );
    expect(BigInt(publicSignals[1])).toBe(tree.root);
    expect(BigInt(publicSignals[2])).toBe(THRESHOLD);
    expect(BigInt(publicSignals[3])).toBe(gateId);

    expect(await groth16.verify(VKEY, publicSignals, proof)).toBe(true);

    // encoding for the on-chain verifier
    expect(proofToSolanaBytes(proof as SnarkjsProof)).toHaveLength(256);
    expect(publicSignalsToBytes(publicSignals)).toHaveLength(4);
  });

  it("proves at exactly the threshold (attribute == threshold)", async () => {
    const { proof, publicSignals } = await groth16.fullProve(
      inputsFor(2),
      WASM,
      ZKEY,
    );
    expect(await groth16.verify(VKEY, publicSignals, proof)).toBe(true);
  });

  it("rejects a member below the threshold", async () => {
    await expect(groth16.fullProve(inputsFor(1), WASM, ZKEY)).rejects.toThrow(
      /Assert Failed/i,
    );
  });

  it("rejects a tampered merkle path", async () => {
    const inputs = inputsFor(0);
    const tampered = [...(inputs.pathElements as bigint[])];
    tampered[3] += 1n;
    await expect(
      groth16.fullProve({ ...inputs, pathElements: tampered }, WASM, ZKEY),
    ).rejects.toThrow(/Assert Failed/i);
  });

  it("rejects a lied-about attribute (leaf no longer in tree)", async () => {
    await expect(
      groth16.fullProve(inputsFor(1, { attribute: 1000n }), WASM, ZKEY),
    ).rejects.toThrow(/Assert Failed/i);
  });

  it("rejects someone else's secret for a member's leaf", async () => {
    await expect(
      groth16.fullProve(inputsFor(0, { secret: SECRETS[1] }), WASM, ZKEY),
    ).rejects.toThrow(/Assert Failed/i);
  });

  it("derives unlinkable nullifiers for the same member across gates", async () => {
    const otherGateId = await gateIdFromPubkey(new Uint8Array(32).fill(10));
    const a = await groth16.fullProve(inputsFor(0), WASM, ZKEY);
    const b = await groth16.fullProve(
      inputsFor(0, { gateId: otherGateId }),
      WASM,
      ZKEY,
    );
    expect(a.publicSignals[0]).not.toBe(b.publicSignals[0]);
  });
});
