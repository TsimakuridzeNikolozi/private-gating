import { buildPoseidon } from "circomlibjs";

interface PoseidonHasher {
  (inputs: (bigint | number | string)[]): Uint8Array;
  F: { toObject(x: Uint8Array): bigint };
}

let cached: Promise<PoseidonHasher> | undefined;

function getPoseidon(): Promise<PoseidonHasher> {
  cached ??= buildPoseidon() as Promise<PoseidonHasher>;
  return cached;
}

/** Poseidon hash over BN254, matching circomlib's Poseidon template. */
export async function poseidon(inputs: bigint[]): Promise<bigint> {
  const p = await getPoseidon();
  return p.F.toObject(p(inputs));
}
