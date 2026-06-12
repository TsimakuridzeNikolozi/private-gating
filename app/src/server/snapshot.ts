import { leafHash, MerkleTree } from "@private-gating/shared";
import { db } from "./db";
import { readAttribute } from "./holdings";

/**
 * Take a snapshot for a gate: read every registrant's attribute, assemble the
 * Poseidon Merkle tree, persist leaves + root. The returned root still has to
 * be published on-chain by the operator (publish_root) before the gate is live.
 */
export async function takeSnapshot(gateId: string) {
  const gate = await db.gate.findUniqueOrThrow({
    where: { id: gateId },
    include: { registrants: { orderBy: { createdAt: "asc" } } },
  });

  // Read every registrant's holdings concurrently — these are independent RPC
  // round-trips, and doing them serially makes large gates slow enough to risk
  // a route timeout. Promise.all preserves order, so leafIndex stays stable.
  const entries = await Promise.all(
    gate.registrants.map(async (registrant, leafIndex) => {
      const attribute = await readAttribute(
        gate.gateType,
        gate.target,
        registrant.wallet,
      );
      const leaf = await leafHash(BigInt(registrant.commitment), attribute);
      return {
        leaf,
        row: {
          commitment: registrant.commitment,
          attribute: attribute.toString(),
          leafIndex,
        },
      };
    }),
  );
  const leaves = entries.map((e) => e.leaf);
  const rows = entries.map((e) => e.row);

  const tree = await MerkleTree.build(leaves);
  const snapshot = await db.snapshot.create({
    data: {
      gateId: gate.id,
      root: tree.root.toString(),
      memberCount: leaves.length,
      leaves: { create: rows },
    },
  });
  return { snapshot, root: tree.root, memberCount: leaves.length };
}

/** Latest snapshot for a gate, or null. */
export function latestSnapshot(gateId: string) {
  return db.snapshot.findFirst({
    where: { gateId },
    orderBy: { takenAt: "desc" },
    include: { leaves: { orderBy: { leafIndex: "asc" } } },
  });
}

/**
 * Rebuild the tree of a snapshot and return the Merkle path for one
 * commitment, along with its recorded attribute. Demo-scale (O(n) Poseidon);
 * a production service would persist interior nodes.
 */
export async function proofInputFor(gateId: string, commitment: string) {
  const registrant = await db.registrant.findFirst({
    where: { gateId, commitment },
  });
  const snapshot = await latestSnapshot(gateId);
  if (!snapshot) {
    return {
      status: registrant
        ? ("no-snapshot" as const)
        : ("not-registered" as const),
    };
  }

  const member = snapshot.leaves.find((l) => l.commitment === commitment);
  if (!member) {
    // registered after the latest snapshot — a matter of timing, not an error
    return {
      status: registrant
        ? ("pending-next-snapshot" as const)
        : ("not-registered" as const),
    };
  }

  const leaves: bigint[] = [];
  for (const l of snapshot.leaves) {
    leaves.push(await leafHash(BigInt(l.commitment), BigInt(l.attribute)));
  }
  const tree = await MerkleTree.build(leaves);
  const path = tree.proof(member.leafIndex);
  return {
    status: "included" as const,
    root: tree.root.toString(),
    attribute: member.attribute,
    leafIndex: member.leafIndex,
    pathElements: path.pathElements.map(String),
    pathIndices: path.pathIndices,
    takenAt: snapshot.takenAt,
  };
}
