"use client";

import Link from "next/link";
import { Notice } from "@/components/notice";
import { Stepper } from "@/components/stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { explorerAddressUrl } from "@/lib/client/api";
import { cn, shortenAddress } from "@/lib/utils";
import { ContextBar } from "./context-bar";
import { FlowPanel } from "./flow-panel";
import { ResultPanel } from "./result-card";
import { actionNoun, FLOW_STEPS, requirementText, stepIndex } from "./steps";
import { GateSkeleton } from "./ui-bits";
import { useGateFlow } from "./use-gate-flow";

export function GateView({ slug }: { slug: string }) {
  const flow = useGateFlow(slug);

  if (flow.notFound) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-lg font-medium">This gate doesn&apos;t exist</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The link may be wrong or the gate was removed.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/gates">Browse all gates</Link>
        </Button>
      </div>
    );
  }

  if (!flow.gate) return <GateSkeleton />;

  const { onChain, effectiveStep, error, isOperatorWallet } = flow;
  const gate = flow.gate;
  const { verb, done } = actionNoun(gate);
  const live = onChain?.status === "live";
  const errorIsDecline = !!error && /declined/i.test(error);

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10 sm:px-6 sm:py-12">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {gate.label}
          </h1>
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
            {live ? "Snapshot live" : "Gathering members"}
          </Badge>
        </div>
        {gate.description && (
          <p className="text-muted-foreground mt-1">{gate.description}</p>
        )}
      </div>

      {!isOperatorWallet && (
        <Card className="py-4">
          <CardContent>
            <Stepper
              steps={FLOW_STEPS}
              current={stepIndex(effectiveStep)}
              blocked={effectiveStep === "short"}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardDescription className="tracking-wide uppercase">
            Requirement
          </CardDescription>
          <CardTitle className="text-lg">{requirementText(gate)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              {gate.gateType === "nftCollection" ? "Collection" : "Token mint"}
            </span>
            <a
              href={explorerAddressUrl(gate.target)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary font-mono hover:underline"
              title={gate.target}
            >
              {shortenAddress(gate.target)}
            </a>
          </div>
          <p className="text-muted-foreground text-sm">
            This check is zero-knowledge: the gate never sees your wallet, your
            balance, or which asset you hold — only a proof that you qualify.
          </p>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
            <span>{gate.registrantCount} registered</span>
            {onChain && (
              <span>
                {onChain.passCount} anonymous{" "}
                {gate.gateType === "sybilAction" ? "entries" : "unlocks"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {!isOperatorWallet && (
        <ContextBar
          connected={flow.connected}
          address={flow.address}
          hasIdentity={flow.hasIdentity}
        />
      )}

      {isOperatorWallet && (
        <Notice
          variant="info"
          title="You operate this gate"
          action={
            <Button asChild size="sm">
              <Link href={`/dashboard/${gate.slug}`}>Manage this gate</Link>
            </Button>
          }
        >
          You&apos;re connected with this gate&apos;s operator wallet. Operators
          run the gate — taking snapshots and drawing winners — and don&apos;t
          register or prove as members of their own gate. To join as a holder,
          switch to a different wallet from the header.
        </Notice>
      )}

      {error && (
        <Notice
          variant={errorIsDecline ? "warning" : "error"}
          title={errorIsDecline ? "Request declined" : "Something went wrong"}
        >
          {error}
        </Notice>
      )}

      {!isOperatorWallet && (
        <>
          <FlowPanel
            step={effectiveStep}
            gate={gate}
            proofInput={flow.proofInput}
            busy={flow.busy}
            verb={verb}
            onConnect={flow.connectWallet}
            onDerive={flow.handleDerive}
            onRegister={flow.handleRegister}
            onProve={flow.handleProve}
          />
          <ResultPanel
            step={effectiveStep}
            gate={gate}
            onChain={onChain}
            done={done}
            nullifierHex={flow.nullifierHex}
            txSignature={flow.txSignature}
            isWinner={flow.isWinner}
            claimRecipient={flow.claimRecipient}
            setClaimRecipient={flow.setClaimRecipient}
            claimTx={flow.claimTx}
            claimBusy={flow.claimBusy}
            onClaim={flow.handleClaim}
          />
        </>
      )}

      <p className="text-muted-foreground/70 text-xs">
        Your identity is derived from your wallet signature — re-signing always
        recovers it, on any device. Losing the wallet itself is the one
        unrecoverable case.
      </p>
    </div>
  );
}
