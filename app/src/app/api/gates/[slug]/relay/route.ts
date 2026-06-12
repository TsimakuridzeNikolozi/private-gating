import { NextRequest } from "next/server";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { db } from "@/server/db";
import { nullifierPda, relayerProgram } from "@/server/solana";
import { checkRateLimit } from "@/server/rate-limit";
import { readJsonBody } from "@/server/http";

/**
 * The relayer. Accepts a finished proof and submits it with the server
 * keypair as the only signer/fee payer, so the holder's wallet never touches
 * the chain. The proof itself is the authorization; for claims the recipient
 * is bound inside the proof, so relaying is safe.
 *
 * Every accepted pass spends relayer SOL (fee + nullifier rent), so the
 * limiter pairs a spoof-proof global cap with a per-client courtesy cap.
 */

interface RelayBody {
  kind?: "pass" | "claim";
  proof?: number[];
  publicSignals?: number[][];
  recipient?: string;
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/gates/[slug]/relay">,
) {
  const limited = checkRateLimit(req, "relay", { perClient: 10, global: 60 });
  if (limited) return limited;

  const { slug } = await ctx.params;
  const body = await readJsonBody<RelayBody>(req);
  if (!body)
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  const { kind = "pass", proof, publicSignals } = body;

  if (
    !proof ||
    proof.length !== 256 ||
    !publicSignals ||
    publicSignals.length !== 4 ||
    publicSignals.some((s) => s.length !== 32)
  ) {
    return Response.json({ error: "malformed proof payload" }, { status: 400 });
  }

  const gate = await db.gate.findUnique({ where: { slug } });
  if (!gate) return Response.json({ error: "gate not found" }, { status: 404 });
  const gateAddress = new PublicKey(gate.address);

  let program;
  try {
    program = relayerProgram();
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  const relayer = program.provider.publicKey!;
  const budget = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });

  try {
    let signature: string;
    if (kind === "claim") {
      if (!body.recipient) {
        return Response.json(
          { error: "recipient required for claim" },
          { status: 400 },
        );
      }
      signature = await program.methods
        .claimPrize(proof, publicSignals)
        .accountsPartial({
          gate: gateAddress,
          recipient: new PublicKey(body.recipient),
          payer: relayer,
        })
        .preInstructions([budget])
        .rpc();
    } else {
      const nullifier = Uint8Array.from(publicSignals[0]);
      signature = await program.methods
        .verifyAndPass(publicSignals[0], proof, publicSignals)
        .accountsPartial({
          gate: gateAddress,
          nullifierRecord: nullifierPda(gateAddress, nullifier),
          payer: relayer,
        })
        .preInstructions([budget])
        .rpc();
    }
    return Response.json({ signature });
  } catch (e) {
    const message = (e as Error).message ?? "transaction failed";
    // Log the raw chain/RPC error server-side; don't echo internals (account
    // addresses, program logs) back to the client.
    console.warn(`relay ${kind} failed for ${slug}: ${message}`);
    // The nullifier-PDA collision is the one failure worth surfacing precisely.
    const friendly = message.includes("already in use")
      ? "This gate has already been used by this identity."
      : "transaction failed";
    return Response.json({ error: friendly }, { status: 400 });
  }
}
