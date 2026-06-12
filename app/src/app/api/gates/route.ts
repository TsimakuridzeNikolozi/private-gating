import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { db } from "@/server/db";
import { readOnlyProgram } from "@/server/solana";
import { verifyWalletSignature } from "@/server/auth";
import { checkRateLimit } from "@/server/rate-limit";
import { readJsonBody } from "@/server/http";

const GATE_TYPES = new Set(["tokenBalance", "nftCollection", "sybilAction"]);

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Register metadata for a gate the operator already created on-chain. */
export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, "register-gate", {
    perClient: 5,
    global: 60,
  });
  if (limited) return limited;

  const body = await readJsonBody<{
    address?: string;
    description?: string;
    decimals?: number;
    wallet?: string;
    timestamp?: number;
    signature?: string;
  }>(request);
  if (!body)
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  if (!body.address)
    return Response.json({ error: "address required" }, { status: 400 });

  let address: PublicKey;
  try {
    address = new PublicKey(body.address);
  } catch {
    return Response.json({ error: "invalid address" }, { status: 400 });
  }

  // the chain is the source of truth: fetch the account the operator created
  let onChain;
  try {
    onChain = await readOnlyProgram().account.gate.fetch(address);
  } catch {
    return Response.json(
      { error: "gate account not found on-chain" },
      { status: 404 },
    );
  }

  // Only the gate's on-chain operator may register or update its off-chain
  // metadata. Without this, anyone could squat a slug or overwrite the
  // description of a gate they do not control.
  if (
    !body.wallet ||
    !body.timestamp ||
    !body.signature ||
    body.wallet !== onChain.operator.toBase58() ||
    !verifyWalletSignature({
      action: "register-gate",
      slug: address.toBase58(),
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

  const gateType = Object.keys(onChain.gateType)[0];
  if (!GATE_TYPES.has(gateType)) {
    return Response.json(
      { error: `unsupported gate type: ${gateType}` },
      { status: 400 },
    );
  }

  const base = slugify(onChain.label) || "gate";
  let slug = base;
  for (let i = 2; await db.gate.findUnique({ where: { slug } }); i++)
    slug = `${base}-${i}`;

  const gate = await db.gate.upsert({
    where: { address: address.toBase58() },
    update: { description: body.description ?? undefined },
    create: {
      slug,
      label: onChain.label,
      description: body.description ?? null,
      gateType,
      target: onChain.target.toBase58(),
      threshold: onChain.threshold.toString(),
      decimals: body.decimals ?? 0,
      operator: onChain.operator.toBase58(),
      address: address.toBase58(),
    },
  });
  return Response.json({ gate });
}

/** List gates, optionally filtered by operator wallet. */
export async function GET(request: NextRequest) {
  const operator = request.nextUrl.searchParams.get("operator");
  const gates = await db.gate.findMany({
    where: operator ? { operator } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { registrants: true } },
      snapshots: { orderBy: { takenAt: "desc" }, take: 1 },
    },
  });
  return Response.json({ gates });
}
