export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Private Gating</h1>
      <p className="text-base opacity-80">
        Prove you qualify — hold enough of a token or own an NFT from a collection —
        without revealing your wallet, balance, or history. The proof reveals exactly
        one bit: you qualify.
      </p>
      <p className="text-sm opacity-50">
        Phase 1 scaffold: monorepo, Anchor program (groth16-solana linked), and
        toolchain are in place. The holder and operator experiences arrive in later
        phases.
      </p>
    </main>
  );
}
