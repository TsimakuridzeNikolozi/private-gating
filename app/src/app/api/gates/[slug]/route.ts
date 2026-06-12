import { PublicKey } from "@solana/web3.js";
import { db } from "@/server/db";
import { readOnlyProgram } from "@/server/solana";

/** Public gate info: metadata, latest snapshot, live on-chain counters. */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/gates/[slug]">,
) {
  const { slug } = await ctx.params;
  const gate = await db.gate.findUnique({
    where: { slug },
    include: {
      _count: { select: { registrants: true } },
      snapshots: { orderBy: { takenAt: "desc" }, take: 1 },
    },
  });
  if (!gate) return Response.json({ error: "gate not found" }, { status: 404 });

  let onChain = null;
  try {
    const account = await readOnlyProgram().account.gate.fetch(
      new PublicKey(gate.address),
    );
    onChain = {
      status: Object.keys(account.status)[0],
      merkleRoot: Buffer.from(account.merkleRoot).toString("hex"),
      memberCount: account.memberCount,
      snapshotTs: account.snapshotTs.toNumber(),
      passCount: account.passCount.toNumber(),
      winningNullifier: account.winningNullifier
        ? Buffer.from(account.winningNullifier).toString("hex")
        : null,
      prizeClaimed: account.prizeClaimed,
    };
  } catch {
    // RPC unavailable or account closed; metadata alone is still useful
  }

  return Response.json({
    gate: {
      slug: gate.slug,
      label: gate.label,
      description: gate.description,
      gateType: gate.gateType,
      target: gate.target,
      threshold: gate.threshold,
      decimals: gate.decimals,
      operator: gate.operator,
      address: gate.address,
      registrantCount: gate._count.registrants,
      latestSnapshot: gate.snapshots[0]
        ? {
            root: gate.snapshots[0].root,
            memberCount: gate.snapshots[0].memberCount,
            takenAt: gate.snapshots[0].takenAt,
          }
        : null,
    },
    onChain,
  });
}
