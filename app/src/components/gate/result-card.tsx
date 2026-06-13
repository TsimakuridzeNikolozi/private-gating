"use client";

import { CheckCircle2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import {
  explorerTxUrl,
  type GateInfo,
  type OnChainInfo,
} from "@/lib/client/api";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Step } from "./steps";

export function ResultPanel({
  step,
  gate,
  onChain,
  done,
  nullifierHex,
  txSignature,
  reward,
  revealBusy,
  onReveal,
  isWinner,
  claimRecipient,
  setClaimRecipient,
  claimTx,
  claimBusy,
  onClaim,
}: {
  step: Step;
  gate: GateInfo;
  onChain: OnChainInfo | null;
  done: string;
  nullifierHex: string | null;
  txSignature: string | null;
  reward: string | null;
  revealBusy: boolean;
  onReveal: () => void;
  isWinner: boolean;
  claimRecipient: string;
  setClaimRecipient: (value: string) => void;
  claimTx: string | null;
  claimBusy: boolean;
  onClaim: () => void;
}) {
  return (
    <>
      {(step === "passed" || step === "already-passed") && (
        <Card className="border-primary/40 bg-primary/5 gap-3">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <CheckCircle2 className="size-5" />
              {step === "passed" ? done : `${done} — welcome back`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {gate.gateType === "sybilAction" ? (
              <div className="text-muted-foreground space-y-2 text-sm">
                <p>
                  Your entry is recorded under the identifier below. No one —
                  not even the operator — can connect it to your wallet.
                </p>
                <code className="bg-muted text-muted-foreground block rounded p-2 text-xs break-all">
                  {nullifierHex}
                </code>
                <p>
                  If you win, you&apos;ll re-sign with this wallet to claim —
                  the prize can be sent to any address you choose.
                </p>
              </div>
            ) : (
              <UnlockedContent
                reward={reward}
                step={step}
                revealBusy={revealBusy}
                onReveal={onReveal}
              />
            )}
            <div className="border-primary/30 bg-primary/10 text-primary/90 flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
              <ShieldCheck className="mt-px size-4 shrink-0" />
              The relayer is the only signer — your wallet appears nowhere in
              this transaction. That&apos;s the whole point.
            </div>
            {txSignature && (
              <a
                className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                href={explorerTxUrl(txSignature)}
                target="_blank"
                rel="noreferrer"
              >
                View the (unlinkable) transaction
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {step === "already-passed" && onChain?.winningNullifier && (
        <Card>
          <CardHeader>
            <CardDescription className="tracking-wide uppercase">
              Raffle result
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RaffleResult
              prizeClaimed={onChain.prizeClaimed}
              isWinner={isWinner}
              claimRecipient={claimRecipient}
              setClaimRecipient={setClaimRecipient}
              claimTx={claimTx}
              claimBusy={claimBusy}
              onClaim={onClaim}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function UnlockedContent({
  reward,
  step,
  revealBusy,
  onReveal,
}: {
  reward: string | null;
  step: Step;
  revealBusy: boolean;
  onReveal: () => void;
}) {
  if (reward) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">Members-only content unlocked:</p>
        <div className="bg-muted rounded p-3 break-words">
          {isHttpUrl(reward) ? (
            <a
              className="text-primary hover:underline"
              href={reward}
              target="_blank"
              rel="noopener noreferrer"
            >
              {reward}
            </a>
          ) : (
            <span className="whitespace-pre-wrap">{reward}</span>
          )}
        </div>
      </div>
    );
  }

  if (step === "already-passed") {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          You&apos;ve already unlocked this gate. Re-sign with your wallet to
          view the members-only content again.
        </p>
        <Button size="sm" disabled={revealBusy} onClick={onReveal}>
          {revealBusy && <Loader2 className="animate-spin" />}
          {revealBusy ? "Revealing…" : "Show members-only content"}
        </Button>
      </div>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      You qualify. The operator hasn&apos;t attached any content to this gate.
    </p>
  );
}

function RaffleResult({
  prizeClaimed,
  isWinner,
  claimRecipient,
  setClaimRecipient,
  claimTx,
  claimBusy,
  onClaim,
}: {
  prizeClaimed: boolean;
  isWinner: boolean;
  claimRecipient: string;
  setClaimRecipient: (value: string) => void;
  claimTx: string | null;
  claimBusy: boolean;
  onClaim: () => void;
}) {
  if (prizeClaimed && !claimTx) {
    return (
      <p className="text-muted-foreground text-sm">
        The prize for this gate has been claimed.
      </p>
    );
  }

  if (!isWinner) {
    return (
      <p className="text-muted-foreground text-sm">
        A winner has been drawn. Your entry didn&apos;t win this time.
      </p>
    );
  }

  if (claimTx) {
    return (
      <Notice
        variant="success"
        title="Prize claimed"
        action={
          <a
            className="text-primary font-medium hover:underline"
            href={explorerTxUrl(claimTx)}
            target="_blank"
            rel="noreferrer"
          >
            View transaction ↗
          </a>
        }
      >
        Paid out to the address you chose.
      </Notice>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-primary text-sm">
        Your entry won. Choose any payout address — the proof binds it, so not
        even the relayer can redirect your prize. Use a fresh address to stay
        unlinkable.
      </p>
      <Input
        aria-label="Payout address"
        placeholder="Payout address"
        value={claimRecipient}
        onChange={(e) => setClaimRecipient(e.target.value)}
      />
      <Button disabled={claimBusy || !claimRecipient.trim()} onClick={onClaim}>
        {claimBusy && <Loader2 className="animate-spin" />}
        {claimBusy ? "Proving & claiming…" : "Claim prize privately"}
      </Button>
    </div>
  );
}
