"use client";

import { Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RaffleEntry } from "./use-operator-gate";

export function RafflePanel({
  isOperator,
  address,
  entries,
  winningNullifier,
  prizeClaimed,
  busy,
  onDraw,
}: {
  isOperator: boolean;
  address: string;
  entries: RaffleEntry[];
  winningNullifier: string | null;
  prizeClaimed: boolean;
  busy: boolean;
  onDraw: () => void;
}) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">Raffle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {entries.length} anonymous entr{entries.length === 1 ? "y" : "ies"}.
          Fund the prize by sending SOL to the gate address:{" "}
          <code className="text-foreground/80 text-xs break-all">
            {address}
          </code>
        </p>

        {winningNullifier ? (
          <div className="text-sm">
            <span className="text-muted-foreground">Winning entry: </span>
            <code className="text-primary text-xs break-all">
              {winningNullifier}
            </code>
            <p className="text-muted-foreground mt-1 text-xs">
              {prizeClaimed
                ? "Prize claimed — by a proof, not an identity."
                : "Waiting for the winner to claim by re-proving control of this marker."}
            </p>
          </div>
        ) : (
          <Button
            onClick={onDraw}
            disabled={!isOperator || entries.length === 0 || busy}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Trophy />}
            {busy ? "Drawing…" : "Draw a winner at random"}
          </Button>
        )}

        <p className="text-muted-foreground/70 text-xs">
          The draw selects among one-time markers; the operator never learns who
          is behind any of them. (Randomness is operator-side in this demo.)
        </p>
      </CardContent>
    </Card>
  );
}
