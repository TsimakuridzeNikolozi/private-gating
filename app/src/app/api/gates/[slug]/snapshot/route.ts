import { fieldToBytes32 } from "@private-gating/shared";
import { db } from "@/server/db";
import { verifyWalletSignature } from "@/server/auth";
import { readJsonBody } from "@/server/http";
import { takeSnapshot } from "@/server/snapshot";

/**
 * Operator-only: read every registrant's holdings, build the Merkle tree,
 * persist the snapshot. Returns the root for the operator to publish on-chain.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/gates/[slug]/snapshot">,
) {
  const { slug } = await ctx.params;
  const body = await readJsonBody<{
    wallet?: string;
    timestamp?: number;
    signature?: string;
  }>(req);
  if (!body)
    return Response.json({ error: "invalid JSON body" }, { status: 400 });

  const gate = await db.gate.findUnique({ where: { slug } });
  if (!gate) return Response.json({ error: "gate not found" }, { status: 404 });

  if (
    !body.wallet ||
    !body.timestamp ||
    !body.signature ||
    body.wallet !== gate.operator ||
    !verifyWalletSignature({
      action: "snapshot",
      slug,
      wallet: body.wallet,
      timestamp: body.timestamp,
      signature: body.signature,
    })
  ) {
    return Response.json(
      { error: "operator signature required" },
      { status: 401 },
    );
  }

  const { snapshot, root, memberCount } = await takeSnapshot(gate.id);
  return Response.json({
    snapshotId: snapshot.id,
    root: root.toString(),
    rootBytes: Array.from(fieldToBytes32(root)),
    memberCount,
  });
}
