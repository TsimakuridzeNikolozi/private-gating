import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { groth16 } from "snarkjs";
import {
  gateIdFromPubkey,
  nullifierFor,
  pubkeyToLimbs,
} from "@private-gating/shared";

const BUILD = join(__dirname, "..", "build");
const WASM = join(BUILD, "claim_js", "claim.wasm");
const ZKEY = join(BUILD, "claim.zkey");
const VKEY = JSON.parse(readFileSync(join(BUILD, "claim_vkey.json"), "utf8"));

afterAll(async () => {
  const curve = (globalThis as Record<string, any>).curve_bn128;
  if (curve) await curve.terminate();
});

describe("claim circuit", () => {
  it("proves knowledge of the secret behind a nullifier, bound to a recipient", async () => {
    const secret = 424242n;
    const gateId = await gateIdFromPubkey(new Uint8Array(32).fill(5));
    const nullifier = await nullifierFor(secret, gateId);
    const recipient = new Uint8Array(32);
    for (let i = 0; i < 32; i++) recipient[i] = 255 - i;
    const { hi, lo } = pubkeyToLimbs(recipient);

    const { proof, publicSignals } = await groth16.fullProve(
      { nullifier, gateId, recipientHi: hi, recipientLo: lo, secret },
      WASM,
      ZKEY,
    );
    expect(publicSignals.map(BigInt)).toEqual([nullifier, gateId, hi, lo]);
    expect(await groth16.verify(VKEY, publicSignals, proof)).toBe(true);
  });

  it("rejects the wrong secret", async () => {
    const gateId = await gateIdFromPubkey(new Uint8Array(32).fill(5));
    const nullifier = await nullifierFor(424242n, gateId);
    await expect(
      groth16.fullProve(
        { nullifier, gateId, recipientHi: 1n, recipientLo: 2n, secret: 999n },
        WASM,
        ZKEY,
      ),
    ).rejects.toThrow(/Assert Failed/i);
  });
});
