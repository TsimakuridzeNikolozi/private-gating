"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  explorerTxUrl,
  formatThreshold,
  type GateInfo,
} from "@/lib/client/api";
import { cn, shortenAddress } from "@/lib/utils";
import { RafflePanel } from "./raffle-panel";
import { SharePanel } from "./share-panel";
import { SnapshotPanel } from "./snapshot-panel";
import { type OperatorGateState, useOperatorGate } from "./use-operator-gate";
import { DashboardSkeleton, Stat } from "./ui-bits";

export function OperatorGate({ slug }: { slug: string }) {
  const op = useOperatorGate(slug);

  if (op.notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-lg font-medium">This gate doesn&apos;t exist</h1>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  if (!op.gate) return <DashboardSkeleton />;
  const { gate, onChain } = op;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6 sm:py-12">
      <Header gate={gate} live={op.live} />
      <Guard op={op} />
      {op.error && (
        <Notice variant="error" title="Something went wrong">
          {op.error}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Registered" value={String(gate.registrantCount)} />
        <Stat label="In snapshot" value={String(onChain?.memberCount ?? 0)} />
        <Stat
          label={op.isRaffle ? "Entries" : "Unlocks"}
          value={String(onChain?.passCount ?? 0)}
          hint="anonymous — no identities attached"
        />
        <Stat
          label="Snapshot"
          value={
            onChain?.snapshotTs
              ? new Date(onChain.snapshotTs * 1000).toLocaleTimeString()
              : "—"
          }
        />
      </div>

      <SnapshotPanel
        isOperator={op.isOperator}
        registrantCount={gate.registrantCount}
        live={op.live}
        merkleRoot={onChain?.merkleRoot ?? null}
        busy={op.busy === "snapshot"}
        onSnapshot={op.handleSnapshot}
      />
      <SharePanel slug={gate.slug} />
      {op.isRaffle && (
        <RafflePanel
          isOperator={op.isOperator}
          address={gate.address}
          entries={op.entries}
          winningNullifier={onChain?.winningNullifier ?? null}
          prizeClaimed={!!onChain?.prizeClaimed}
          busy={op.busy === "draw"}
          onDraw={op.handleDraw}
        />
      )}

      {op.lastTx && (
        <a
          href={explorerTxUrl(op.lastTx)}
          target="_blank"
          rel="noreferrer"
          className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline"
        >
          View last transaction
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}

function Header({ gate, live }: { gate: GateInfo; live: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{gate.label}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {gate.gateType} · requires{" "}
          {formatThreshold(gate.threshold, gate.decimals)}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 gap-1.5",
          live ? "border-primary/40 text-primary" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            live ? "bg-primary" : "bg-muted-foreground",
          )}
        />
        {live ? "Live" : "Registration"}
      </Badge>
    </div>
  );
}

function Guard({ op }: { op: OperatorGateState }) {
  if (!op.gate) return null;
  if (!op.connected) {
    return (
      <Notice
        variant="info"
        title="Connect the operator wallet"
        action={
          <Button size="sm" onClick={op.connectWallet}>
            Connect wallet
          </Button>
        }
      >
        This gate is managed by{" "}
        <code className="text-foreground/80">
          {shortenAddress(op.gate.operator)}
        </code>
        . Connect that wallet to take snapshots or draw winners.
      </Notice>
    );
  }
  if (!op.isOperator) {
    return (
      <Notice variant="warning" title="Different wallet connected">
        You&apos;re connected as{" "}
        <code className="text-foreground/80">
          {shortenAddress(op.address ?? "")}
        </code>
        , but this gate is managed by{" "}
        <code className="text-foreground/80">
          {shortenAddress(op.gate.operator)}
        </code>
        . Switch wallets from the header to manage it — you can still view its
        live stats below.
      </Notice>
    );
  }
  return null;
}
