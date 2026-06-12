import { poseidon } from "./poseidon";
import { bytesToBigIntBE, SCALAR_FIELD } from "./encoding";

/**
 * The fixed message every holder signs to derive their private identity.
 * Ed25519 signing is deterministic (RFC 8032), so re-signing this message
 * with the same wallet always reproduces the same secret — nothing to back up.
 * Changing this string would orphan every existing identity.
 */
export const IDENTITY_MESSAGE =
  "Private Gating identity v1\n\nSign this message to derive your private gating identity. This signature stays on your device and is never sent anywhere.";

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buf = new Uint8Array(data.length);
  buf.set(data);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

/** Derive the member secret from the wallet's signature over IDENTITY_MESSAGE. */
export async function secretFromSignature(
  signature: Uint8Array,
): Promise<bigint> {
  const digest = await sha256(signature);
  return bytesToBigIntBE(digest) % SCALAR_FIELD;
}

/** Public commitment: Poseidon(secret). Safe to share; reveals nothing about the secret. */
export function commitmentFromSecret(secret: bigint): Promise<bigint> {
  return poseidon([secret]);
}

/** Snapshot leaf: Poseidon(commitment, attribute). */
export function leafHash(
  commitment: bigint,
  attribute: bigint,
): Promise<bigint> {
  return poseidon([commitment, attribute]);
}

/** One-time marker for a (member, gate) pair: Poseidon(secret, gateId). */
export function nullifierFor(secret: bigint, gateId: bigint): Promise<bigint> {
  return poseidon([secret, gateId]);
}

/**
 * Gate identifier as a field element: sha256(gate PDA pubkey) mod r.
 * The on-chain program recomputes this and checks it against the proof's
 * public signal, binding every proof (and nullifier) to exactly one gate.
 */
export async function gateIdFromPubkey(
  gatePubkey: Uint8Array,
): Promise<bigint> {
  if (gatePubkey.length !== 32) throw new Error("gate pubkey must be 32 bytes");
  const digest = await sha256(gatePubkey);
  return bytesToBigIntBE(digest) % SCALAR_FIELD;
}
