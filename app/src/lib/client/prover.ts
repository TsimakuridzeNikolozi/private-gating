"use client";

import {
  proofToSolanaBytes,
  publicSignalsToBytes,
  type SnarkjsProof,
} from "@private-gating/shared";

export interface ProofResult {
  proofBytes: number[];
  publicSignals: number[][];
  rawSignals: string[];
}

/**
 * Run snarkjs groth16.fullProve in a Web Worker against the served wasm/zkey.
 * Inputs are passed as decimal strings; the worker posts back the finished
 * proof, already encoded for the on-chain verifier.
 */
export function proveInWorker(
  circuit: "gate" | "claim",
  input: Record<string, string | string[] | number[]>,
): Promise<ProofResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/prover-worker.js");
    worker.onmessage = (event) => {
      worker.terminate();
      const data = event.data as
        | { ok: true; proof: SnarkjsProof; publicSignals: string[] }
        | { ok: false; error: string };
      if (!data.ok) return reject(new Error(data.error));
      resolve({
        proofBytes: Array.from(proofToSolanaBytes(data.proof)),
        publicSignals: publicSignalsToBytes(data.publicSignals).map((s) =>
          Array.from(s),
        ),
        rawSignals: data.publicSignals,
      });
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "proving failed"));
    };
    worker.postMessage({
      input,
      wasmUrl: `${self.location.origin}/zk/${circuit}.wasm`,
      zkeyUrl: `${self.location.origin}/zk/${circuit}.zkey`,
    });
  });
}
