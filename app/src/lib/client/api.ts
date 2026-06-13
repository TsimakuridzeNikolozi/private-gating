"use client";

import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import idl from "@/lib/idl/private_gating.json";

export const PROGRAM_ID = new PublicKey((idl as { address: string }).address);

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://127.0.0.1:8899";

export function clientConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export interface GateInfo {
  slug: string;
  label: string;
  description: string | null;
  gateType: "tokenBalance" | "nftCollection" | "sybilAction";
  target: string;
  threshold: string;
  decimals: number;
  operator: string;
  address: string;
  registrantCount: number;
  latestSnapshot: { root: string; memberCount: number; takenAt: string } | null;
}

export interface OnChainInfo {
  status: "registering" | "live";
  merkleRoot: string;
  memberCount: number;
  snapshotTs: number;
  passCount: number;
  winningNullifier: string | null;
  prizeClaimed: boolean;
}

export type ProofInput =
  | { status: "not-registered" }
  | { status: "no-snapshot" }
  | { status: "pending-next-snapshot" }
  | {
      status: "included";
      root: string;
      attribute: string;
      leafIndex: number;
      pathElements: string[];
      pathIndices: number[];
      takenAt: string;
    };

export async function fetchGate(slug: string) {
  const res = await fetch(`/api/gates/${slug}`);
  if (!res.ok) throw new Error((await res.json()).error ?? "gate not found");
  return (await res.json()) as { gate: GateInfo; onChain: OnChainInfo | null };
}

export async function registerCommitment(
  slug: string,
  wallet: string,
  commitment: bigint,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
) {
  // prove control of `wallet` by signing a message bound to this commitment;
  // the server reads this wallet's holdings, so ownership must be proven
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `private-gating:register:${slug}:${timestamp}:${commitment.toString()}`;
  const signature = bs58.encode(
    await signMessage(new TextEncoder().encode(message)),
  );

  const res = await fetch(`/api/gates/${slug}/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      wallet,
      commitment: commitment.toString(),
      timestamp,
      signature,
    }),
  });
  if (!res.ok)
    throw new Error((await res.json()).error ?? "registration failed");
  return (await res.json()) as {
    registered: boolean;
    includedInLatestSnapshot: boolean;
  };
}

export async function fetchProofInput(
  slug: string,
  commitment: bigint,
): Promise<ProofInput> {
  const res = await fetch(
    `/api/gates/${slug}/proof-input?commitment=${commitment.toString()}`,
  );
  if (!res.ok)
    throw new Error((await res.json()).error ?? "proof input unavailable");
  return (await res.json()) as ProofInput;
}

export async function relay(
  slug: string,
  payload: {
    kind: "pass" | "claim";
    proof: number[];
    publicSignals: number[][];
    recipient?: string;
  },
): Promise<{ signature: string; reward: string | null }> {
  const res = await fetch(`/api/gates/${slug}/relay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "relay failed");
  return {
    signature: json.signature as string,
    reward: (json.reward ?? null) as string | null,
  };
}

/** Re-fetch a gate's unlock content for a member who already passed. */
export async function revealReward(
  slug: string,
  wallet: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
): Promise<string | null> {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `private-gating:reveal:${slug}:${timestamp}`;
  const signature = bs58.encode(
    await signMessage(new TextEncoder().encode(message)),
  );
  const res = await fetch(`/api/gates/${slug}/reward`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, timestamp, signature }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "could not reveal content");
  return (json.reward ?? null) as string | null;
}

export function nullifierPdaClient(
  gate: PublicKey,
  nullifier: Uint8Array,
): PublicKey {
  // Uint8Array seeds only — no Buffer in browser code
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("nullifier"), gate.toBytes(), nullifier],
    PROGRAM_ID,
  )[0];
}

/** Human label for the configured cluster, derived from the RPC URL. */
export function clusterLabel(): string {
  if (RPC_URL.includes("devnet")) return "Devnet";
  if (RPC_URL.includes("testnet")) return "Testnet";
  if (RPC_URL.includes("mainnet")) return "Mainnet";
  return "Localnet";
}

export function explorerTxUrl(signature: string): string {
  if (RPC_URL.includes("devnet"))
    return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
}

export function explorerAddressUrl(address: string): string {
  if (RPC_URL.includes("devnet"))
    return `https://explorer.solana.com/address/${address}?cluster=devnet`;
  return `https://explorer.solana.com/address/${address}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
}

/** Human display of a raw threshold given mint decimals. */
export function formatThreshold(raw: string, decimals: number): string {
  if (decimals === 0) return raw;
  const v = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
