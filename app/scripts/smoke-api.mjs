import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import anchorPkg from "@coral-xyz/anchor";
const { AnchorProvider, Program, BN } = anchorPkg;
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { buildPoseidon } from "circomlibjs";
import nacl from "tweetnacl";
import bs58 from "bs58";

const API = "http://localhost:3000/api";
const idl = JSON.parse(
  readFileSync(new URL("../src/lib/idl/private_gating.json", import.meta.url)),
);

const operator = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(readFileSync(`${os.homedir()}/.config/solana/id.json`, "utf8")),
  ),
);
const wallet = {
  publicKey: operator.publicKey,
  signTransaction: async (tx) => (tx.partialSign(operator), tx),
  signAllTransactions: async (txs) =>
    txs.map((tx) => (tx.partialSign(operator), tx)),
};
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
const program = new Program(idl, new AnchorProvider(connection, wallet, {}));

const sha256 = (data) => createHash("sha256").update(data).digest();
const label = `smoke-${Date.now()}`;
const [gatePda] = PublicKey.findProgramAddressSync(
  [Buffer.from("gate"), operator.publicKey.toBuffer(), sha256(label)],
  program.programId,
);

console.log("1. create_gate on-chain:", gatePda.toBase58());
await program.methods
  .createGate(
    Array.from(sha256(label)),
    label,
    { tokenBalance: {} },
    Keypair.generate().publicKey,
    new BN(10),
  )
  .accountsPartial({
    gate: gatePda,
    operator: operator.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

console.log("2. register gate metadata via API (operator-signed)");
const regTs = Math.floor(Date.now() / 1000);
const regMsg = new TextEncoder().encode(
  `private-gating:register-gate:${gatePda.toBase58()}:${regTs}`,
);
const regSig = bs58.encode(nacl.sign.detached(regMsg, operator.secretKey));
let res = await fetch(`${API}/gates`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    address: gatePda.toBase58(),
    description: "smoke test gate",
    wallet: operator.publicKey.toBase58(),
    timestamp: regTs,
    signature: regSig,
  }),
});
const { gate } = await res.json();
if (!gate?.slug) throw new Error("gate metadata registration failed");
console.log("   slug:", gate.slug);

console.log("3. register two signed holder commitments");
const poseidon = await buildPoseidon();
const commitment = (secret) =>
  poseidon.F.toObject(poseidon([secret])).toString();
for (const [i, secret] of [
  [0, 1111n],
  [1, 2222n],
]) {
  const holder = Keypair.generate();
  const c = commitment(secret);
  const timestamp = Math.floor(Date.now() / 1000);
  const message = new TextEncoder().encode(
    `private-gating:register:${gate.slug}:${timestamp}:${c}`,
  );
  const signature = bs58.encode(nacl.sign.detached(message, holder.secretKey));
  res = await fetch(`${API}/gates/${gate.slug}/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      wallet: holder.publicKey.toBase58(),
      commitment: c,
      timestamp,
      signature,
    }),
  });
  const json = await res.json();
  if (!json.registered)
    throw new Error(`registration ${i} failed: ${JSON.stringify(json)}`);
}

console.log("4. take snapshot (operator-signed)");
const timestamp = Math.floor(Date.now() / 1000);
const message = new TextEncoder().encode(
  `private-gating:snapshot:${gate.slug}:${timestamp}`,
);
const signature = bs58.encode(nacl.sign.detached(message, operator.secretKey));
res = await fetch(`${API}/gates/${gate.slug}/snapshot`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    wallet: operator.publicKey.toBase58(),
    timestamp,
    signature,
  }),
});
const snap = await res.json();
if (!snap.root) throw new Error(`snapshot failed: ${JSON.stringify(snap)}`);
console.log(
  "   root:",
  snap.root.slice(0, 24) + "…",
  "members:",
  snap.memberCount,
);

console.log("5. publish root on-chain");
await program.methods
  .publishRoot(snap.rootBytes, snap.memberCount)
  .accountsPartial({ gate: gatePda, operator: operator.publicKey })
  .rpc();

console.log("6. fetch proof input for member 0");
res = await fetch(
  `${API}/gates/${gate.slug}/proof-input?commitment=${commitment(1111n)}`,
);
const pi = await res.json();
if (pi.status !== "included" || pi.pathElements?.length !== 20) {
  throw new Error(`proof-input failed: ${JSON.stringify(pi)}`);
}
console.log(
  "   included at index",
  pi.leafIndex,
  "attribute:",
  pi.attribute,
  "root match:",
  pi.root === snap.root,
);

console.log("7. unregistered commitment is not included");
res = await fetch(
  `${API}/gates/${gate.slug}/proof-input?commitment=${commitment(9999n)}`,
);
if ((await res.json()).status !== "not-registered")
  throw new Error("expected not-registered");

console.log("\nSMOKE TEST PASSED");
process.exit(0);
