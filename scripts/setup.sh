#!/usr/bin/env bash
# Dev-grade Groth16 trusted setup for both circuits.
#
# Reuses the public Hermez "Powers of Tau" phase-1 ceremony (pot15, 32k
# constraints — ample for ~6k in gate.circom) and adds a single local phase-2
# contribution.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CIRCUITS="$ROOT/circuits"
BUILD="$CIRCUITS/build"
PTAU="$BUILD/powersOfTau28_hez_final_15.ptau"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau"
# Known SHA-256 of the Hermez pot15 phase-1 artifact. A corrupted or MITM'd
# download would silently taint the trusted setup, so we fail closed on
# mismatch rather than trusting HTTPS transport alone.
PTAU_SHA256="3ef2ecc5b75d687048cf2d59195119b42fb07c5af639c5f283d84bfa69829e7f"

snark() { pnpm --dir "$CIRCUITS" exec snarkjs "$@"; }

verify_ptau() {
  local actual
  actual="$(shasum -a 256 "$PTAU" | awk '{print $1}')"
  if [ "$actual" != "$PTAU_SHA256" ]; then
    echo "FATAL: powers-of-tau checksum mismatch" >&2
    echo "  expected $PTAU_SHA256" >&2
    echo "  got      $actual" >&2
    rm -f "$PTAU"
    exit 1
  fi
  echo "==> powers of tau checksum verified"
}

echo "==> compiling circuits"
bash "$CIRCUITS/compile.sh"

if [ ! -f "$PTAU" ]; then
  echo "==> downloading powers of tau (pot15, ~36MB)"
  curl -fL -o "$PTAU" "$PTAU_URL"
fi
verify_ptau

for c in gate claim; do
  echo "==> groth16 setup: $c"
  snark groth16 setup "$BUILD/$c.r1cs" "$PTAU" "$BUILD/${c}_0000.zkey"
  snark zkey contribute "$BUILD/${c}_0000.zkey" "$BUILD/$c.zkey" \
    --name="private-gating dev contribution" -v \
    -e="$(head -c 64 /dev/urandom | xxd -p | tr -d '\n')"
  snark zkey export verificationkey "$BUILD/$c.zkey" "$BUILD/${c}_vkey.json"
  rm -f "$BUILD/${c}_0000.zkey"
done

echo "==> copying prover artifacts to app/public/zk"
mkdir -p "$ROOT/app/public/zk"
cp "$BUILD/gate_js/gate.wasm" "$BUILD/claim_js/claim.wasm" "$BUILD/gate.zkey" "$BUILD/claim.zkey" "$ROOT/app/public/zk/"

echo "==> generating Rust verifying keys"
node "$ROOT/scripts/vkey-to-rust.mjs" \
  "$BUILD/gate_vkey.json" GATE_VERIFYING_KEY \
  "$BUILD/claim_vkey.json" CLAIM_VERIFYING_KEY \
  > "$ROOT/program/programs/private_gating/src/verifying_keys.rs"

echo "==> done"
