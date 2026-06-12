// snarkjs ships no type declarations and exposes no types via its package
// `exports` map, so the `bundler` resolver can't resolve it. Treat it as an
// untyped module (the proof/signal shapes are validated by @private-gating/shared).
declare module "snarkjs";
