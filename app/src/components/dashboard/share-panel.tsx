"use client";

import { useSyncExternalStore } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const subscribeOrigin = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

export function SharePanel({ slug }: { slug: string }) {
  const origin = useSyncExternalStore(
    subscribeOrigin,
    getOrigin,
    getServerOrigin,
  );
  const url = `${origin}/g/${slug}`;

  const copy = () => {
    void navigator.clipboard.writeText(url);
    toast.success("Link copied", {
      description: "Anyone with this link can register and prove privately.",
    });
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">Share</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono"
          />
          <Button variant="outline" onClick={copy} className="shrink-0">
            <Copy />
            Copy
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Holders open this link, prove they qualify, and unlock — their wallet
          never appears on-chain.
        </p>
      </CardContent>
    </Card>
  );
}
