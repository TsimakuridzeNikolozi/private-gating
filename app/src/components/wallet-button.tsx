"use client";

import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ChevronDown, Loader2, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shortenAddress } from "@/lib/utils";

export function WalletButton() {
  const { publicKey, connected, connecting, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58();

  if (!connected || !address) {
    return (
      <Button size="sm" onClick={() => setVisible(true)} disabled={connecting}>
        {connecting ? (
          <>
            <Loader2 className="animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <Wallet />
            <span className="hidden sm:inline">Connect wallet</span>
            <span className="sm:hidden">Connect</span>
          </>
        )}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="font-mono">
          {wallet?.adapter.icon ? (
            <Image
              src={wallet.adapter.icon}
              alt=""
              width={16}
              height={16}
              unoptimized
              className="size-4 rounded-sm"
            />
          ) : (
            <Wallet className="text-primary" />
          )}
          {shortenAddress(address)}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="text-[11px] tracking-wide text-muted-foreground uppercase">
            {wallet?.adapter.name ?? "Connected"}
          </div>
          <div className="mt-0.5 font-mono text-xs break-all">{address}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="font-medium text-red-500 focus:bg-red-500/10 focus:text-red-500"
          onClick={() => void disconnect().catch(() => {})}
        >
          <LogOut className="text-red-500" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
