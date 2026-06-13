"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Action({
  title,
  text,
  button,
  onClick,
  disabled,
  busy,
  accent,
}: {
  title?: string;
  text: string;
  button: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  accent?: boolean;
}) {
  return (
    <Card className={cn("gap-4", accent && "border-primary/40 bg-primary/5")}>
      <CardHeader>{title && <CardTitle>{title}</CardTitle>}</CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{text}</p>
        <Button onClick={onClick} disabled={disabled}>
          {busy && <Loader2 className="animate-spin" />}
          {button}
        </Button>
      </CardContent>
    </Card>
  );
}

export function Progress({ label, sub }: { label: string; sub?: string }) {
  return (
    <Card className="py-5">
      <CardContent className="space-y-2">
        <div className="flex items-center gap-3">
          <Loader2 className="text-primary size-5 animate-spin" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {sub && <p className="text-muted-foreground pl-8 text-xs">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function GateSkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10 sm:px-6 sm:py-12">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-20" />
      <Skeleton className="h-28" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <Skeleton className="h-32" />
    </div>
  );
}
