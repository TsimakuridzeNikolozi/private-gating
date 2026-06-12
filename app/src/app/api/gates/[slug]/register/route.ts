import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { SCALAR_FIELD } from "@private-gating/shared";
import { db } from "@/server/db";
import { verifyWalletSignature } from "@/server/auth";
import { checkRateLimit } from "@/server/rate-limit";
import { readJsonBody } from "@/server/http";

/** Register a holder's identity commitment for inclusion in the next snapshot. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/gates/[slug]/register">,
) {
  const { slug } = await ctx.params;

  const limited = checkRateLimit(req, "register", {
    perClient: 5,
    global: 120,
  });
  if (limited) return limited;

  const body = await readJsonBody<{
    wallet?: string;
    commitment?: string;
    timestamp?: number;
    signature?: string;
  }>(req);
  if (!body)
    return Response.json({ error: "invalid JSON body" }, { status: 400 });

  if (!body.wallet || !body.commitment) {
    return Response.json(
      { error: "wallet and commitment required" },
      { status: 400 },
    );
  }
  try {
    new PublicKey(body.wallet);
  } catch {
    return Response.json({ error: "invalid wallet" }, { status: 400 });
  }
  let commitment: bigint;
  try {
    commitment = BigInt(body.commitment);
  } catch {
    return Response.json({ error: "invalid commitment" }, { status: 400 });
  }
  if (commitment <= 0n || commitment >= SCALAR_FIELD) {
    return Response.json(
      { error: "commitment out of field range" },
      { status: 400 },
    );
  }

  // Prove control of `wallet`: the snapshot reads THIS wallet's holdings, so
  // without this an attacker could bind their own commitment to someone
  // else's balance (eligibility forgery) or overwrite an honest registrant.
  // The signature commits to the exact commitment being registered.
  if (
    !body.timestamp ||
    !body.signature ||
    !verifyWalletSignature({
      action: "register",
      slug,
      wallet: body.wallet,
      timestamp: body.timestamp,
      signature: body.signature,
      extra: commitment.toString(),
    })
  ) {
    return Response.json(
      { error: "wallet signature required" },
      { status: 401 },
    );
  }

  const gate = await db.gate.findUnique({ where: { slug } });
  if (!gate) return Response.json({ error: "gate not found" }, { status: 404 });

  // Product rule: an operator must not be a member of their own gate. They
  // control snapshots, so admitting them would let them seed the eligible set
  // / sybil-action raffle they administer.
  if (body.wallet === gate.operator) {
    return Response.json(
      { error: "operators cannot register for their own gate" },
      { status: 403 },
    );
  }

  await db.registrant.upsert({
    where: { gateId_wallet: { gateId: gate.id, wallet: body.wallet } },
    update: { commitment: commitment.toString() },
    create: {
      gateId: gate.id,
      wallet: body.wallet,
      commitment: commitment.toString(),
    },
  });

  // Whether THIS commitment is actually present in the latest snapshot's
  // leaves. A createdAt comparison is wrong after a commitment rotation: the
  // row's createdAt stays put on upsert while the snapshot leaf still holds the
  // previous commitment, so the new one is not yet provable.
  const latest = await db.snapshot.findFirst({
    where: { gateId: gate.id },
    orderBy: { takenAt: "desc" },
    select: { id: true },
  });
  const includedInLatest = latest
    ? (await db.snapshotLeaf.count({
        where: { snapshotId: latest.id, commitment: commitment.toString() },
      })) > 0
    : false;

  return Response.json({
    registered: true,
    includedInLatestSnapshot: includedInLatest,
  });
}
