"use client";

import { Loader2 } from "lucide-react";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GateTypePicker } from "./gate-type-picker";
import { ConnectPrompt, Field } from "./ui-bits";
import { useCreateGate } from "./use-create-gate";

export function CreateGate() {
  const form = useCreateGate();
  const declined = !!form.error && /declined/i.test(form.error);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create a gate</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Creating a gate sends one transaction from your wallet — you&apos;re
          the operator. Holders never sign on-chain.
        </p>
      </div>

      {!form.connected && (
        <ConnectPrompt
          title="Connect the operator wallet"
          onConnect={form.connectWallet}
        >
          You sign one transaction to create the gate on-chain, so connect
          first.
        </ConnectPrompt>
      )}

      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          1 · Choose a gate type
        </div>
        <GateTypePicker value={form.kind} onChange={form.setKind} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            2 · Configure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Label (also scopes the one-time markers)">
            <Input
              value={form.label}
              onChange={(e) => form.setLabel(e.target.value)}
              placeholder="e.g. signals-club"
              maxLength={64}
            />
          </Field>
          <Field label="Description (shown to holders)">
            <Input
              value={form.description}
              onChange={(e) => form.setDescription(e.target.value)}
              placeholder="e.g. Trading signals for committed holders"
            />
          </Field>
          <Field
            label={form.isNft ? "Collection address" : "Token mint address"}
          >
            <Input
              className="font-mono"
              value={form.target}
              onChange={(e) => form.setTarget(e.target.value)}
              placeholder="mint / collection pubkey"
            />
          </Field>
          <Field
            label={form.isNft ? "Minimum NFTs (usually 1)" : "Minimum balance"}
            hint={
              form.isNft
                ? undefined
                : "Human units — converted using the mint's decimals."
            }
          >
            <Input
              value={form.threshold}
              onChange={(e) => form.setThreshold(e.target.value)}
            />
          </Field>
          {!form.isSybil && (
            <Field
              label="Unlock content (revealed only after a successful pass)"
              hint="A link or short message. Holders see it only once they've proven they qualify; it's never served from the public gate page."
            >
              <Input
                value={form.reward}
                onChange={(e) => form.setReward(e.target.value)}
                placeholder="e.g. https://discord.gg/your-invite"
                maxLength={1000}
              />
            </Field>
          )}
          {form.isSybil && (
            <p className="text-muted-foreground text-xs">
              Success records a one-time entry per member. Fund the gate address
              with SOL afterwards if the entries compete for a prize.
            </p>
          )}
          {form.error && (
            <Notice
              variant={declined ? "warning" : "error"}
              title={declined ? "Request declined" : "Couldn't create the gate"}
            >
              {form.error}
            </Notice>
          )}
          <Button onClick={form.submit} disabled={form.busy || !form.connected}>
            {form.busy && <Loader2 className="animate-spin" />}
            {form.busy ? "Creating…" : "Create gate"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
