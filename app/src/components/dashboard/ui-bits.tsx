"use client";

import type { ReactNode } from "react";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="gap-0 py-0" title={hint}>
      <CardContent className="p-4">
        <div className="text-muted-foreground text-xs tracking-wide uppercase">
          {label}
        </div>
        <div className="mt-1 truncate text-xl font-semibold" title={value}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Label className="flex flex-col items-start gap-1.5">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-muted-foreground/80 text-xs font-normal normal-case">
          {hint}
        </span>
      )}
    </Label>
  );
}

export function ConnectPrompt({
  title,
  onConnect,
  children,
}: {
  title: string;
  onConnect: () => void;
  children: ReactNode;
}) {
  return (
    <Notice
      variant="info"
      title={title}
      action={
        <Button size="sm" onClick={onConnect}>
          Connect wallet
        </Button>
      }
    >
      {children}
    </Notice>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6 sm:py-12">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}
