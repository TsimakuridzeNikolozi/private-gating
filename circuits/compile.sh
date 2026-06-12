#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
for c in gate claim; do
  circom "src/$c.circom" --r1cs --wasm --sym -o build -l node_modules
done
