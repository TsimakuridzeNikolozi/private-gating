import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";

const MAX_AGE_SECONDS = 300;

/**
 * Signatures are single-use: once verified, a signature is consumed and a
 * replay within the timestamp window is rejected. Per-instance memory is
 * enough because the timestamp check bounds how long an entry must be
 * remembered (a restart can't resurrect an expired signature).
 */
const consumed = new Map<string, number>(); // signature -> expiry (ms)

function consumeOnce(signature: string): boolean {
  const now = Date.now();
  for (const [sig, expiry] of consumed) {
    if (expiry <= now) consumed.delete(sig);
  }
  if (consumed.has(signature)) return false;
  consumed.set(signature, now + 2 * MAX_AGE_SECONDS * 1000);
  return true;
}

/** The message a wallet signs to authorize an API action. */
export function walletAuthMessage(
  action: string,
  slug: string,
  timestamp: number,
  extra?: string,
): string {
  return (
    `private-gating:${action}:${slug}:${timestamp}` + (extra ? `:${extra}` : "")
  );
}

/**
 * Verify a wallet-signed request: the client sends the wallet, a unix
 * timestamp, and a base58 signature over walletAuthMessage. The timestamp
 * bounds the window to five minutes and each signature is accepted once.
 */
export function verifyWalletSignature(params: {
  action: string;
  slug: string;
  wallet: string;
  timestamp: number;
  signature: string;
  extra?: string;
}): boolean {
  const { action, slug, wallet, timestamp, signature, extra } = params;
  if (Math.abs(Date.now() / 1000 - timestamp) > MAX_AGE_SECONDS) return false;
  try {
    const message = new TextEncoder().encode(
      walletAuthMessage(action, slug, timestamp, extra),
    );
    const valid = nacl.sign.detached.verify(
      message,
      bs58.decode(signature),
      new PublicKey(wallet).toBytes(),
    );
    return valid && consumeOnce(signature);
  } catch {
    return false;
  }
}
