"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { listGates, type OperatorGateSummary } from "@/lib/client/operator";

export function useOperatorGates() {
  const { publicKey, connected } = useWallet();
  const address = publicKey?.toBase58() ?? null;
  const [loaded, setLoaded] = useState<{
    address: string;
    rows: OperatorGateSummary[];
  } | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    listGates(address).then(
      (rows) => !cancelled && setLoaded({ address, rows }),
      () => !cancelled && setLoaded({ address, rows: [] }),
    );
    return () => {
      cancelled = true;
    };
  }, [address]);

  const gates = loaded?.address === address ? loaded.rows : null;

  return { connected, gates };
}
