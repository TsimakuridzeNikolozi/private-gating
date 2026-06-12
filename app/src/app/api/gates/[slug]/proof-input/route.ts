import { NextRequest } from "next/server";
import { SCALAR_FIELD } from "@private-gating/shared";
import { db } from "@/server/db";
import { proofInputFor } from "@/server/snapshot";
import { checkRateLimit } from "@/server/rate-limit";

/**
 * Merkle path + recorded attribute for one commitment in the latest snapshot.
 * Within the disclosed trust model the service already knows wallet <->
 * commitment; this endpoint reveals a member's own leaf data to whoever holds
 * the commitment (documented in the README).
 */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/gates/[slug]/proof-input">,
) {
  // proof-input rebuilds the Merkle tree (O(n) Poseidon) per call; cap abuse
  const limited = checkRateLimit(req, "proof-input", {
    perClient: 30,
    global: 300,
  });
  if (limited) return limited;

  const { slug } = await ctx.params;
  const commitment = req.nextUrl.searchParams.get("commitment");
  if (!commitment)
    return Response.json({ error: "commitment required" }, { status: 400 });

  const gate = await db.gate.findUnique({ where: { slug } });
  if (!gate) return Response.json({ error: "gate not found" }, { status: 404 });

  let normalized: string;
  try {
    const value = BigInt(commitment);
    if (value <= 0n || value >= SCALAR_FIELD) {
      return Response.json(
        { error: "commitment out of field range" },
        { status: 400 },
      );
    }
    normalized = value.toString();
  } catch {
    return Response.json({ error: "invalid commitment" }, { status: 400 });
  }

  const result = await proofInputFor(gate.id, normalized);
  return Response.json(result);
}
