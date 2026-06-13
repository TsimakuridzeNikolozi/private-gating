import Link from "next/link";
import { db } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const GATE_TYPE_LABELS: Record<string, string> = {
  nftCollection: "NFT collection gate",
  sybilAction: "One-entry-per-member action",
};

function gateTypeLabel(t: string) {
  return GATE_TYPE_LABELS[t] ?? "Token balance gate";
}

export default async function GatesPage() {
  const gates = await db.gate.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { registrants: true, snapshots: true } } },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gates</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick a gate and prove you qualify — privately. Your wallet never
          appears on-chain.
        </p>
      </div>

      {gates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <div className="text-sm font-medium">No gates yet</div>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
              Gates appear here once an operator creates one.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/dashboard/new">Create a gate</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {gates.map((g) => {
            const live = g._count.snapshots > 0;
            return (
              <li key={g.id}>
                <Link
                  href={`/g/${g.slug}`}
                  className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent>
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{g.label}</div>
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
                          {live ? "Open" : "Gathering members"}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground mt-1 text-sm">
                        {gateTypeLabel(g.gateType)} · {g._count.registrants}{" "}
                        registered
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
