// Proof generation runs entirely in this worker, on the holder's device.
// Nothing about the wallet, balance, or secret leaves the browser — only the
// finished proof is posted back (and then to the relayer).
importScripts("/snarkjs.min.js");

self.onmessage = async (event) => {
  const { input, wasmUrl, zkeyUrl } = event.data;
  try {
    const { proof, publicSignals } = await self.snarkjs.groth16.fullProve(
      input,
      wasmUrl,
      zkeyUrl,
    );
    self.postMessage({ ok: true, proof, publicSignals });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
