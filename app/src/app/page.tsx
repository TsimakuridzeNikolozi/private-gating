import Link from "next/link";
import { Eye, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  {
    icon: KeyRound,
    title: "Register",
    text: "Connect, sign a fixed message to derive a private identity, and register a one-way commitment. No balance leaves your device.",
  },
  {
    icon: Sparkles,
    title: "Prove",
    text: "A zero-knowledge proof is generated in your browser against the operator's snapshot — proving only that you qualify.",
  },
  {
    icon: ShieldCheck,
    title: "Unlock",
    text: "A relayer submits the proof and pays the fee. Your wallet never appears on-chain; the gate learns one bit: you qualify.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <section className="space-y-6 text-center">
        <Badge
          variant="outline"
          className="border-primary/40 text-primary gap-1.5"
        >
          <Eye className="size-3" />
          Zero-knowledge access on Solana
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Prove you qualify, reveal nothing else.
        </h1>
        <p className="text-muted-foreground mx-auto max-w-xl text-lg text-pretty">
          Hold enough of a token or own an NFT from a collection — and unlock
          access without exposing your wallet, balance, or history. The proof
          reveals exactly one bit: you qualify.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/gates">Browse gates</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">Operator dashboard</Link>
          </Button>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <CardContent className="space-y-3">
              <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md">
                <Icon className="size-4.5" />
              </div>
              <div className="font-medium">{title}</div>
              <p className="text-muted-foreground text-sm">{text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-12">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3">
            <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">
                Private by construction.
              </span>{" "}
              Your identity is derived from a wallet signature and never leaves
              your browser. Proofs are generated on-device and submitted by a
              relayer, so there is no on-chain link between you and the gate you
              unlock.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
