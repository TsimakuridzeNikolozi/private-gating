"use client";

import { useMemo } from "react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import idl from "@/lib/idl/private_gating.json";
import type { PrivateGating } from "@/lib/idl/private_gating";
import { PROGRAM_ID } from "@/lib/client/api";

export type GateKind = "tokenBalance" | "nftCollection" | "sybilAction";

type GateTypeArg =
  | { tokenBalance: Record<string, never> }
  | { nftCollection: Record<string, never> }
  | { sybilAction: Record<string, never> };

export function useGateProgram(): Program<PrivateGating> | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program(idl as PrivateGating, provider);
  }, [connection, wallet]);
}

export async function sha256Browser(data: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data)),
  );
}

export async function gatePdaFor(
  operator: PublicKey,
  label: string,
): Promise<PublicKey> {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode("gate"),
      operator.toBytes(),
      await sha256Browser(label),
    ],
    PROGRAM_ID,
  )[0];
}

export function parseUnits(human: string, decimals: number): bigint {
  const trimmed = human.trim();
  if (!/^\d+(\.\d*)?$/.test(trimmed))
    throw new Error("enter a positive number");
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals)
    throw new Error(`this token supports at most ${decimals} decimal places`);
  return BigInt(whole + frac.padEnd(decimals, "0"));
}

export function gateTypeArg(kind: GateKind): GateTypeArg {
  return { [kind]: {} } as GateTypeArg;
}
