"use client";

import bs58 from "bs58";

export interface OperatorGateSummary {
  slug: string;
  label: string;
  gateType: "tokenBalance" | "nftCollection" | "sybilAction";
  threshold: string;
  _count: { registrants: number };
  snapshots: { takenAt: string }[];
}

type SignMessage = (message: Uint8Array) => Promise<Uint8Array>;

export interface SignedAuth {
  timestamp: number;
  signature: string;
}

export async function signAuth(
  action: string,
  slug: string,
  signMessage: SignMessage,
): Promise<SignedAuth> {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `private-gating:${action}:${slug}:${timestamp}`;
  const signature = bs58.encode(
    await signMessage(new TextEncoder().encode(message)),
  );
  return { timestamp, signature };
}

export async function listGates(
  operator?: string,
): Promise<OperatorGateSummary[]> {
  const url = operator ? `/api/gates?operator=${operator}` : "/api/gates";
  const res = await fetch(url);
  if (!res.ok) throw new Error("could not load gates");
  return ((await res.json()).gates ?? []) as OperatorGateSummary[];
}

export async function createGateMetadata(params: {
  address: string;
  description?: string;
  reward?: string;
  decimals: number;
  wallet: string;
  auth: SignedAuth;
}): Promise<{ slug: string }> {
  const { address, description, reward, decimals, wallet, auth } = params;
  const res = await fetch("/api/gates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address,
      description,
      reward,
      decimals,
      wallet,
      timestamp: auth.timestamp,
      signature: auth.signature,
    }),
  });
  const json = await res.json();
  if (!json.gate?.slug)
    throw new Error(json.error ?? "metadata registration failed");
  return { slug: json.gate.slug as string };
}

export async function requestSnapshot(
  slug: string,
  wallet: string,
  signMessage: SignMessage,
): Promise<{ rootBytes: number[]; memberCount: number }> {
  const { timestamp, signature } = await signAuth(
    "snapshot",
    slug,
    signMessage,
  );
  const res = await fetch(`/api/gates/${slug}/snapshot`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, timestamp, signature }),
  });
  const json = await res.json();
  if (!json.root) throw new Error(json.error ?? "snapshot failed");
  return { rootBytes: json.rootBytes, memberCount: json.memberCount };
}
