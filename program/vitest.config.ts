import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 300_000,
    hookTimeout: 300_000,
    // on-chain tests share one gate's state; run files serially
    fileParallelism: false,
  },
});
