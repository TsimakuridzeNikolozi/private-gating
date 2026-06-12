import { describe, expect, it } from "vitest";
import {
  commitmentFromSecret,
  fieldToBytes32,
  bytesToBigIntBE,
  gateIdFromPubkey,
  leafHash,
  MerkleTree,
  nullifierFor,
  pubkeyToLimbs,
  SCALAR_FIELD,
  secretFromSignature,
  TREE_DEPTH,
} from "../src/index.js";

describe("identity", () => {
  it("derives the same secret from the same signature", async () => {
    const sig = new Uint8Array(64).fill(7);
    const a = await secretFromSignature(sig);
    const b = await secretFromSignature(sig);
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0n);
    expect(a).toBeLessThan(SCALAR_FIELD);
  });

  it("derives different secrets from different signatures", async () => {
    const a = await secretFromSignature(new Uint8Array(64).fill(1));
    const b = await secretFromSignature(new Uint8Array(64).fill(2));
    expect(a).not.toBe(b);
  });

  it("nullifiers are stable per gate and unlinkable across gates", async () => {
    const secret = 1234567890123456789n;
    const gateA = await gateIdFromPubkey(new Uint8Array(32).fill(3));
    const gateB = await gateIdFromPubkey(new Uint8Array(32).fill(4));
    expect(await nullifierFor(secret, gateA)).toBe(
      await nullifierFor(secret, gateA),
    );
    expect(await nullifierFor(secret, gateA)).not.toBe(
      await nullifierFor(secret, gateB),
    );
  });
});

describe("merkle tree", () => {
  it("builds, proves, and verifies membership", async () => {
    const leaves: bigint[] = [];
    for (let i = 0; i < 5; i++) {
      leaves.push(
        await leafHash(
          await commitmentFromSecret(BigInt(i + 1)),
          BigInt(i * 10),
        ),
      );
    }
    const tree = await MerkleTree.build(leaves);
    expect(tree.leafCount).toBe(5);
    for (let i = 0; i < 5; i++) {
      const proof = tree.proof(i);
      expect(proof.pathElements).toHaveLength(TREE_DEPTH);
      expect(await MerkleTree.verify(leaves[i], proof, tree.root)).toBe(true);
    }
    // a proof for one leaf must not verify for another
    expect(await MerkleTree.verify(leaves[0], tree.proof(1), tree.root)).toBe(
      false,
    );
  });

  it("empty tree has the zero root and trees are order-sensitive", async () => {
    const empty = await MerkleTree.build([]);
    const t1 = await MerkleTree.build([1n, 2n]);
    const t2 = await MerkleTree.build([2n, 1n]);
    expect(empty.root).not.toBe(t1.root);
    expect(t1.root).not.toBe(t2.root);
  });
});

describe("encoding", () => {
  it("round-trips field elements through 32-byte BE", () => {
    const v = 123456789012345678901234567890n;
    expect(bytesToBigIntBE(fieldToBytes32(v))).toBe(v);
    expect(fieldToBytes32(v)).toHaveLength(32);
  });

  it("splits pubkeys into 128-bit limbs that reassemble", () => {
    const pubkey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) pubkey[i] = (i * 37 + 1) % 256;
    const { hi, lo } = pubkeyToLimbs(pubkey);
    expect(hi).toBeLessThan(1n << 128n);
    expect(lo).toBeLessThan(1n << 128n);
    expect((hi << 128n) | lo).toBe(bytesToBigIntBE(pubkey));
  });
});
