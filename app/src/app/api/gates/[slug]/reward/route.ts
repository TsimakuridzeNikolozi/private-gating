import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { verifyWalletSignature } from "@/server/auth";
import { proofInputFor } from "@/server/snapshot";
import { checkRateLimit } from "@/server/rate-limit";
import { readJsonBody } from "@/server/http";

/**
 * Re-reveal a gate's members-only content to someone who already passed.
 * The first pass returns the content from the relayer; on a later visit the
 * on-chain pass is anonymous, so we can't recognise the holder there. Instead
 * the wallet signs a `reveal` message and we confirm it is a registrant whose
 * commitment is in the latest snapshot — i.e. it still qualifies. The content
 * is never part of the public gate metadata, so this is the only read path.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/gates/[slug]/reward">,
) {
  const limited = checkRateLimit(req, "reveal", { perClient: 20, global: 120 });
  if (limited) return limited;

  const { slug } = await ctx.params;
  const body = await readJsonBody<{
    wallet?: string;
    timestamp?: number;
    signature?: string;
  }>(req);

  if (
    !body?.wallet ||
    !body.timestamp ||
    !body.signature ||
    !verifyWalletSignature({
      action: "reveal",
      slug,
      wallet: body.wallet,
      timestamp: body.timestamp,
      signature: body.signature,
    })
  ) {
    return Response.json({ error: "wallet signature required" }, { status: 401 });
  }

  const gate = await db.gate.findUnique({ where: { slug } });
  if (!gate) return Response.json({ error: "gate not found" }, { status: 404 });

  const registrant = await db.registrant.findUnique({
    where: { gateId_wallet: { gateId: gate.id, wallet: body.wallet } },
  });
  if (!registrant)
    return Response.json(
      { error: "not a member of this gate" },
      { status: 403 },
    );

  const proof = await proofInputFor(gate.id, registrant.commitment);
  if (proof.status !== "included")
    return Response.json(
      { error: "not eligible in the latest snapshot" },
      { status: 403 },
    );

  return Response.json({ reward: gate.reward ?? null });
}
