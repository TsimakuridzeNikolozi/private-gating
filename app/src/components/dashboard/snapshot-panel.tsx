"use client";

import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SnapshotPanel({
  isOperator,
  registrantCount,
  live,
  merkleRoot,
  busy,
  onSnapshot,
}: {
  isOperator: boolean;
  registrantCount: number;
  live: boolean;
  merkleRoot: string | null;
  busy: boolean;
  onSnapshot: () => void;
}) {
  const empty = registrantCount === 0;
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Taking a snapshot reads every registrant&apos;s holdings, builds the
          membership tree, and publishes only its root on-chain. Members who
          register after a snapshot are included in the next one. You sign the
          publish transaction yourself.
        </p>
        {isOperator && empty && (
          <p className="text-xs text-amber-400">
            No one has registered yet — share the gate link below to gather
            members first.
          </p>
        )}
        {live && merkleRoot && (
          <div className="bg-muted/40 text-muted-foreground rounded-lg border p-3 text-xs">
            Published root:{" "}
            <code className="text-foreground/80 break-all">{merkleRoot}</code>
          </div>
        )}
        <Button onClick={onSnapshot} disabled={!isOperator || busy || empty}>
          {busy ? <Loader2 className="animate-spin" /> : <Camera />}
          {busy
            ? "Snapshotting…"
            : live
              ? "Re-snapshot (updates the root)"
              : "Take snapshot & go live"}
        </Button>
      </CardContent>
    </Card>
  );
}
