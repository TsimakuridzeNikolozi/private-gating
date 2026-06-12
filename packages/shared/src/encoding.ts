/** BN254 scalar field modulus r (field of circuit signals and public inputs). */
export const SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** BN254 base field modulus p (field of curve point coordinates). */
export const BASE_FIELD =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

export function bytesToBigIntBE(bytes: Uint8Array): bigint {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}

/** Serialize a field element as a 32-byte big-endian array (groth16-solana convention). */
export function fieldToBytes32(value: bigint): Uint8Array {
  if (value < 0n || value >= 1n << 256n) throw new Error("value out of range");
  const out = new Uint8Array(32);
  let v = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/**
 * Split a 32-byte Solana pubkey into two 128-bit big-endian limbs.
 * Each limb fits well below the BN254 scalar field, so the full pubkey can be
 * bound into a proof without reduction (a single field element could not hold
 * all 256 bits: r ≈ 2^253.6).
 */
export function pubkeyToLimbs(pubkey: Uint8Array): { hi: bigint; lo: bigint } {
  if (pubkey.length !== 32) throw new Error("pubkey must be 32 bytes");
  return {
    hi: bytesToBigIntBE(pubkey.subarray(0, 16)),
    lo: bytesToBigIntBE(pubkey.subarray(16, 32)),
  };
}

/** Groth16 proof as produced by snarkjs (decimal-string affine coordinates). */
export interface SnarkjsProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

function g1ToBytes(point: string[], negate = false): Uint8Array {
  const x = BigInt(point[0]);
  let y = BigInt(point[1]);
  if (negate && y !== 0n) y = BASE_FIELD - y;
  const out = new Uint8Array(64);
  out.set(fieldToBytes32(x), 0);
  out.set(fieldToBytes32(y), 32);
  return out;
}

/**
 * G2 in the alt_bn128 syscall (EVM precompile) layout: for each coordinate the
 * imaginary part comes first — x_c1 || x_c0 || y_c1 || y_c0. snarkjs stores
 * pi_b as [[x_c0, x_c1], [y_c0, y_c1], [1, 0]].
 */
function g2ToBytes(point: string[][]): Uint8Array {
  const out = new Uint8Array(128);
  out.set(fieldToBytes32(BigInt(point[0][1])), 0);
  out.set(fieldToBytes32(BigInt(point[0][0])), 32);
  out.set(fieldToBytes32(BigInt(point[1][1])), 64);
  out.set(fieldToBytes32(BigInt(point[1][0])), 96);
  return out;
}

/**
 * Encode a snarkjs proof into the 256-byte layout groth16-solana expects:
 * A (negated, 64) || B (128) || C (64), all coordinates 32-byte big-endian.
 * A is negated here so the program can feed the bytes straight to the verifier.
 */
export function proofToSolanaBytes(proof: SnarkjsProof): Uint8Array {
  const out = new Uint8Array(256);
  out.set(g1ToBytes(proof.pi_a, true), 0);
  out.set(g2ToBytes(proof.pi_b), 64);
  out.set(g1ToBytes(proof.pi_c, false), 192);
  return out;
}

/** Encode snarkjs public signals (decimal strings) as 32-byte BE field elements. */
export function publicSignalsToBytes(signals: string[]): Uint8Array[] {
  return signals.map((s) => fieldToBytes32(BigInt(s)));
}
