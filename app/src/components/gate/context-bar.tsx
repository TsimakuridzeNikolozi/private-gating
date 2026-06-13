"use client";

import { clusterLabel } from "@/lib/client/api";
import { cn, shortenAddress } from "@/lib/utils";

export function ContextBar({
  connected,
  address,
  hasIdentity,
}: {
  connected: boolean;
  address: string | null;
  hasIdentity: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <ContextPill
        label="Wallet (global)"
        ok={connected}
        value={connected && address ? shortenAddress(address) : "Not connected"}
        hint={`On Solana ${clusterLabel()}`}
      />
      <ContextPill
        label="Gate identity (private)"
        ok={hasIdentity}
        value={hasIdentity ? "Derived on this device" : "Not derived yet"}
        hint="Never leaves your device"
      />
    </div>
  );
}

function ContextPill({
  label,
  value,
  ok,
  hint,
}: {
  label: string;
  value: string;
  ok: boolean;
  hint: string;
}) {
  return (
    <div className="bg-card flex items-center gap-3 rounded-xl border px-3.5 py-2.5">
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          ok ? "bg-primary" : "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="text-muted-foreground text-[11px] tracking-wide uppercase">
          {label}
        </div>
        <div className="truncate text-sm font-medium" title={value}>
          {value}
        </div>
      </div>
      <div className="text-muted-foreground/70 ml-auto hidden text-right text-[10px] leading-tight sm:block">
        {hint}
      </div>
    </div>
  );
}
