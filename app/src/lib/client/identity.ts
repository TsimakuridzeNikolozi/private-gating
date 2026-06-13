"use client";

import {
  commitmentFromSecret,
  IDENTITY_MESSAGE,
  secretFromSignature,
} from "@private-gating/shared";

export interface PrivateIdentity {
  secret: bigint;
  commitment: bigint;
}

/**
 * Derive the holder's private identity from a wallet signature over the fixed
 * message. Deterministic: the same wallet always reproduces the same identity,
 * so there is nothing to store or back up. Kept in memory only.
 */
export async function deriveIdentity(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
): Promise<PrivateIdentity> {
  const signature = await signMessage(
    new TextEncoder().encode(IDENTITY_MESSAGE),
  );
  const secret = await secretFromSignature(signature);
  const commitment = await commitmentFromSecret(secret);
  return { secret, commitment };
}
