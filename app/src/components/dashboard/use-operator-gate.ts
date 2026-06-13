"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { toast } from "sonner";
import { useGateProgram } from "@/lib/client/anchor";
import {
  explorerTxUrl,
  fetchGate,
  type GateInfo,
  type OnChainInfo,
} from "@/lib/client/api";
import { requestSnapshot } from "@/lib/client/operator";

export interface RaffleEntry {
  address: string;
  nullifierHex: string;
}

function declineCopy(message: string) {
  return /reject|cancel|denied/i.test(message)
    ? "Signature request was declined — nothing happened. Sign when you're ready."
    : message;
}

function viewAction(tx: string) {
  return {
    label: "View",
    onClick: () =>
      window.open(explorerTxUrl(tx), "_blank", "noopener,noreferrer"),
  };
}

export interface OperatorGateState {
  gate: GateInfo | null;
  onChain: OnChainInfo | null;
  notFound: boolean;
  connected: boolean;
  address: string | null;
  isOperator: boolean;
  live: boolean;
  isRaffle: boolean;
  entries: RaffleEntry[];
  busy: string | null;
  error: string | null;
  lastTx: string | null;
  connectWallet: () => void;
  handleSnapshot: () => void;
  handleDraw: () => void;
}

export function useOperatorGate(slug: string): OperatorGateState {
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const program = useGateProgram();

  const [gate, setGate] = useState<GateInfo | null>(null);
  const [onChain, setOnChain] = useState<OnChainInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [entries, setEntries] = useState<RaffleEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const refresh = useCallback(
    () =>
      fetchGate(slug).then(
        (data) => {
          loadedRef.current = true;
          setNotFound(false);
          setGate(data.gate);
          setOnChain(data.onChain);
        },
        () => {
          if (!loadedRef.current) setNotFound(true);
        },
      ),
    [slug],
  );

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const isRaffle = gate?.gateType === "sybilAction";
  const gateAddress = gate?.address ?? null;

  const loadEntries = useCallback(() => {
    if (!program || !gateAddress || !isRaffle) return;
    return program.account.nullifierRecord
      .all([{ memcmp: { offset: 8, bytes: gateAddress } }])
      .then((records) =>
        setEntries(
          records.map((r) => ({
            address: r.publicKey.toBase58(),
            nullifierHex: Array.from(r.account.nullifier as number[], (b) =>
              b.toString(16).padStart(2, "0"),
            ).join(""),
          })),
        ),
      );
  }, [program, gateAddress, isRaffle]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries, onChain?.passCount]);

  const isOperator =
    !!gate && !!publicKey && gate.operator === publicKey.toBase58();
  const live = onChain?.status === "live";

  const handleSnapshot = async () => {
    if (!gate || !publicKey || !signMessage || !program) return;
    setBusy("snapshot");
    setError(null);
    try {
      const { rootBytes, memberCount } = await requestSnapshot(
        gate.slug,
        publicKey.toBase58(),
        signMessage,
      );
      const tx = await program.methods
        .publishRoot(rootBytes, memberCount)
        .accountsPartial({
          gate: new PublicKey(gate.address),
          operator: publicKey,
        })
        .rpc();
      setLastTx(tx);
      toast.success("Snapshot published", {
        description: `${memberCount} member${memberCount === 1 ? "" : "s"} in the new root. The gate is live.`,
        action: viewAction(tx),
      });
      await refresh();
    } catch (e) {
      const message = declineCopy((e as Error).message);
      setError(message);
      toast.error("Snapshot failed", { description: message });
    } finally {
      setBusy(null);
    }
  };

  const handleDraw = async () => {
    if (!gate || !publicKey || !program || entries.length === 0) return;
    setBusy("draw");
    setError(null);
    try {
      const winner = entries[Math.floor(Math.random() * entries.length)];
      const tx = await program.methods
        .drawWinner()
        .accountsPartial({
          gate: new PublicKey(gate.address),
          operator: publicKey,
          winner: new PublicKey(winner.address),
        })
        .rpc();
      setLastTx(tx);
      toast.success("Winner drawn", {
        description:
          "A one-time marker was selected — you still don't learn who's behind it.",
        action: viewAction(tx),
      });
      await refresh();
    } catch (e) {
      const message = declineCopy((e as Error).message);
      setError(message);
      toast.error("Draw failed", { description: message });
    } finally {
      setBusy(null);
    }
  };

  return {
    gate,
    onChain,
    notFound,
    connected,
    address: publicKey?.toBase58() ?? null,
    isOperator,
    live,
    isRaffle: !!isRaffle,
    entries,
    busy,
    error,
    lastTx,
    connectWallet: () => setVisible(true),
    handleSnapshot,
    handleDraw,
  };
}
