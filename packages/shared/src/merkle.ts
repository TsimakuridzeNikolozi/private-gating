import { poseidon } from "./poseidon";

/** Fixed tree depth shared by the circuit, the snapshot service, and tests. */
export const TREE_DEPTH = 20;

export interface MerkleProof {
  pathElements: bigint[];
  pathIndices: number[];
}

/**
 * Fixed-depth Poseidon Merkle tree with zero-leaf padding (zero value 0).
 * Only materializes the nodes above real leaves; absent siblings fall back to
 * the precomputed zero subtree hashes.
 */
export class MerkleTree {
  private constructor(
    readonly depth: number,
    private readonly levels: bigint[][],
    private readonly zeros: bigint[],
  ) {}

  static async build(
    leaves: bigint[],
    depth = TREE_DEPTH,
  ): Promise<MerkleTree> {
    if (leaves.length > 2 ** depth)
      throw new Error("too many leaves for tree depth");
    const zeros: bigint[] = [0n];
    for (let i = 1; i <= depth; i++) {
      zeros.push(await poseidon([zeros[i - 1], zeros[i - 1]]));
    }
    const levels: bigint[][] = [leaves.slice()];
    for (let d = 0; d < depth; d++) {
      const cur = levels[d];
      const next: bigint[] = [];
      for (let i = 0; i < cur.length; i += 2) {
        const left = cur[i];
        const right = i + 1 < cur.length ? cur[i + 1] : zeros[d];
        next.push(await poseidon([left, right]));
      }
      levels.push(next);
    }
    return new MerkleTree(depth, levels, zeros);
  }

  get leafCount(): number {
    return this.levels[0].length;
  }

  get root(): bigint {
    return this.levels[this.depth][0] ?? this.zeros[this.depth];
  }

  proof(index: number): MerkleProof {
    if (index < 0 || index >= this.leafCount)
      throw new Error("leaf index out of range");
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let idx = index;
    for (let d = 0; d < this.depth; d++) {
      pathElements.push(this.levels[d][idx ^ 1] ?? this.zeros[d]);
      pathIndices.push(idx & 1);
      idx >>= 1;
    }
    return { pathElements, pathIndices };
  }

  /** Recompute a root from a leaf and proof — used by tests and sanity checks. */
  static async verify(
    leaf: bigint,
    proof: MerkleProof,
    root: bigint,
  ): Promise<boolean> {
    let cur = leaf;
    for (let d = 0; d < proof.pathElements.length; d++) {
      const sibling = proof.pathElements[d];
      cur =
        proof.pathIndices[d] === 0
          ? await poseidon([cur, sibling])
          : await poseidon([sibling, cur]);
    }
    return cur === root;
  }
}
