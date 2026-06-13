"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clusterLabel } from "@/lib/client/api";
import { WalletButton } from "@/components/wallet-button";
import { cn } from "@/lib/utils";

type Role = "holder" | "operator" | null;

function roleForPath(pathname: string): Role {
  if (pathname.startsWith("/dashboard")) return "operator";
  if (pathname.startsWith("/g/") || pathname === "/gates") return "holder";
  return null;
}

const NAV = [
  {
    href: "/gates",
    label: "Browse gates",
    match: (p: string) => p === "/gates" || p.startsWith("/g/"),
  },
  {
    href: "/dashboard",
    label: "Operator",
    match: (p: string) => p.startsWith("/dashboard"),
  },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const role = roleForPath(pathname);
  const cluster = clusterLabel();

  return (
    <header className="bg-background/80 supports-backdrop-filter:bg-background/70 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="focus-visible:ring-ring flex items-center gap-2 rounded font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="text-primary">●</span>
            <span className="hidden sm:inline">Private Gating</span>
            <span className="sm:hidden">Gating</span>
          </Link>
          {role && (
            <span
              className={cn(
                "hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-flex",
                role === "operator"
                  ? "border-chart-3/40 bg-chart-3/10 text-chart-3"
                  : "border-primary/40 bg-primary/10 text-primary",
              )}
              title={
                role === "operator"
                  ? "You're acting as a gate operator"
                  : "You're acting as a holder proving access"
              }
            >
              {role === "operator" ? "Operator" : "Holder"} view
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <span
            className="text-muted-foreground hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:inline-flex"
            title={`App is configured for Solana ${cluster}. Make sure your wallet is set to the same network.`}
          >
            <span className="bg-primary size-1.5 rounded-full" />
            {cluster}
          </span>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
