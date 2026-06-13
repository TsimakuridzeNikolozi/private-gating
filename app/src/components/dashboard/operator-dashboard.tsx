"use client";

import Link from "next/link";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { OperatorGateSummary } from "@/lib/client/operator";
import { ConnectPrompt } from "./ui-bits";
import { useOperatorGates } from "./use-operator-gates";

function gateTypeLabel(type: string): string {
  if (type === "nftCollection") return "NFT collection gate";
  if (type === "sybilAction") return "One-entry-per-member action";
  return "Token balance gate";
}

export function OperatorDashboard() {
  const { connected, gates } = useOperatorGates();
  const { setVisible } = useWalletModal();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your gates</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gates you operate with the connected wallet.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/dashboard/new">
            <Plus />
            New gate
          </Link>
        </Button>
      </div>

      {!connected ? (
        <ConnectPrompt
          title="Connect the operator wallet"
          onConnect={() => setVisible(true)}
        >
          Your gates are tied to your wallet. Connect it to see what you operate
          and to create new gates.
        </ConnectPrompt>
      ) : gates === null ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : gates.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {gates.map((gate) => (
            <GateRow key={gate.slug} gate={gate} />
          ))}
        </ul>
      )}
    </div>
  );
}

function GateRow({ gate }: { gate: OperatorGateSummary }) {
  const live = gate.snapshots.length > 0;
  return (
    <li>
      <Link
        href={`/dashboard/${gate.slug}`}
        className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      >
        <Card className="hover:border-primary/50 transition-colors">
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">{gate.label}</div>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5",
                  live
                    ? "border-primary/40 text-primary"
                    : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    live ? "bg-primary" : "bg-muted-foreground",
                  )}
                />
                {live ? "Live" : "Gathering members"}
              </Badge>
            </div>
            <div className="text-muted-foreground mt-1 text-sm">
              {gateTypeLabel(gate.gateType)} · {gate._count.registrants}{" "}
              registered
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-8 text-center">
        <div className="text-sm font-medium">No gates yet</div>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
          Create your first gate to admit holders privately — a token balance,
          an NFT collection, or a one-entry-per-member action.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard/new">Create a gate</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
