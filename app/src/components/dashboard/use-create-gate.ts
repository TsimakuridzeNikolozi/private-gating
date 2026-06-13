"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { type Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { toast } from "sonner";
import { explorerTxUrl } from "@/lib/client/api";
import {
  gatePdaFor,
  type GateKind,
  gateTypeArg,
  parseUnits,
  sha256Browser,
  useGateProgram,
} from "@/lib/client/anchor";
import { createGateMetadata, signAuth } from "@/lib/client/operator";

function declineCopy(message: string) {
  return /reject|cancel|denied/i.test(message)
    ? "Signature request was declined — nothing was created. Sign when you're ready."
    : message;
}

async function readDecimals(
  connection: Connection,
  mint: PublicKey,
): Promise<number> {
  const info = await connection.getParsedAccountInfo(mint);
  const decimals = (
    info.value?.data as { parsed?: { info?: { decimals?: number } } }
  )?.parsed?.info?.decimals;
  if (typeof decimals !== "number")
    throw new Error(
      "That address isn't a token mint — check it and try again.",
    );
  return decimals;
}

export interface CreateGateForm {
  kind: GateKind;
  setKind: (kind: GateKind) => void;
  label: string;
  setLabel: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  target: string;
  setTarget: (value: string) => void;
  threshold: string;
  setThreshold: (value: string) => void;
  reward: string;
  setReward: (value: string) => void;
  isNft: boolean;
  isSybil: boolean;
  connected: boolean;
  busy: boolean;
  error: string | null;
  connectWallet: () => void;
  submit: () => void;
}

export function useCreateGate(): CreateGateForm {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const program = useGateProgram();

  const [kind, setKind] = useState<GateKind>("tokenBalance");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [threshold, setThreshold] = useState("1");
  const [reward, setReward] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNft = kind === "nftCollection";
  const isSybil = kind === "sybilAction";

  const submit = async () => {
    if (!program || !publicKey || !signMessage)
      return setError("Connect the operator wallet first.");
    setBusy(true);
    setError(null);
    try {
      const name = label.trim();
      if (!name || name.length > 64)
        throw new Error("Label must be 1–64 characters.");
      const targetKey = new PublicKey(target.trim());
      const decimals = isNft ? 0 : await readDecimals(connection, targetKey);
      const raw = parseUnits(threshold, decimals);
      if (raw <= 0n) throw new Error("Threshold must be positive.");

      const gate = await gatePdaFor(publicKey, name);
      const auth = await signAuth(
        "register-gate",
        gate.toBase58(),
        signMessage,
      );

      const tx = await program.methods
        .createGate(
          Array.from(await sha256Browser(name)),
          name,
          gateTypeArg(kind) as never,
          targetKey,
          new BN(raw.toString()),
        )
        .accountsPartial({
          gate,
          operator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const { slug } = await createGateMetadata({
        address: gate.toBase58(),
        description: description.trim() || undefined,
        reward: isSybil ? undefined : reward.trim() || undefined,
        decimals,
        wallet: publicKey.toBase58(),
        auth,
      });

      toast.success("Gate created", {
        description: `"${name}" is live in registration mode. Share it to gather members.`,
        action: {
          label: "View",
          onClick: () =>
            window.open(explorerTxUrl(tx), "_blank", "noopener,noreferrer"),
        },
      });
      router.push(`/dashboard/${slug}`);
    } catch (e) {
      setError(declineCopy((e as Error).message));
      setBusy(false);
    }
  };

  return {
    kind,
    setKind,
    label,
    setLabel,
    description,
    setDescription,
    target,
    setTarget,
    threshold,
    setThreshold,
    reward,
    setReward,
    isNft,
    isSybil,
    connected,
    busy,
    error,
    connectWallet: () => setVisible(true),
    submit,
  };
}
