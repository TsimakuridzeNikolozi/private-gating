"use client";

import type { GateKind } from "@/lib/client/anchor";
import { cn } from "@/lib/utils";

const KINDS: { kind: GateKind; title: string; body: string }[] = [
  {
    kind: "tokenBalance",
    title: "Token balance",
    body: "Unlock access for holders of at least a threshold of a token.",
  },
  {
    kind: "nftCollection",
    title: "NFT collection",
    body: "Unlock access for holders of any NFT from a collection.",
  },
  {
    kind: "sybilAction",
    title: "Raffle entry",
    body: "One-time entry per qualifying member — raffles, fair mints, votes.",
  },
];

export function GateTypePicker({
  value,
  onChange,
}: {
  value: GateKind;
  onChange: (kind: GateKind) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {KINDS.map((k) => {
        const active = value === k.kind;
        return (
          <button
            key={k.kind}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(k.kind)}
            className={cn(
              "focus-visible:ring-ring rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "border-primary bg-primary/5"
                : "bg-card hover:border-primary/40",
            )}
          >
            <div className="text-sm font-medium">{k.title}</div>
            <p className="text-muted-foreground mt-1 text-xs">{k.body}</p>
          </button>
        );
      })}
    </div>
  );
}
