import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shared lib ships TypeScript source; let Next transpile it
  transpilePackages: ["@private-gating/shared"],
  // wasm-backed crypto libs misbehave when bundled server-side
  serverExternalPackages: ["circomlibjs", "ffjavascript", "snarkjs", "@prisma/client"],
};

export default nextConfig;
