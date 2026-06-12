import { NextRequest } from "next/server";

/**
 * Fixed-window rate limiting with bounded memory. Per-instance and volatile —
 * fine for the single-server demo; a deployed relayer would back this with
 * shared durable state (Redis or similar).
 *
 * The per-IP key is best-effort only: X-Forwarded-For is client-controlled
 * unless a trusted proxy sets it, so every limit here is paired with a global
 * bucket that no header spoofing can escape.
 */

const MAX_TRACKED_KEYS = 10_000;

interface Bucket {
  windowStart: number;
  count: number;
}

// Per-client buckets are keyed by a spoofable client identifier, so they are
// capped and pruned. Global buckets are keyed only by scope (a tiny, bounded
// set) and live in their own map that prune() never touches — otherwise a flood
// of unique per-client keys could evict the spoof-proof global counter and
// reset it mid-window.
const buckets = new Map<string, Bucket>();
const globalBuckets = new Map<string, Bucket>();

function prune(now: number, windowMs: number) {
  if (buckets.size <= MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= windowMs) buckets.delete(key);
  }
  // still over the cap (an active flood of unique keys): drop oldest first
  if (buckets.size > MAX_TRACKED_KEYS) {
    const excess = buckets.size - MAX_TRACKED_KEYS;
    let dropped = 0;
    for (const key of buckets.keys()) {
      if (dropped++ >= excess) break;
      buckets.delete(key);
    }
  }
}

function hit(
  map: Map<string, Bucket>,
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = map.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    map.set(key, { windowStart: now, count: 1 });
    return false;
  }
  bucket.count++;
  return bucket.count > max;
}

/** Count one hit against a prunable per-client `key`; true if it exceeded `max`. */
export function rateLimited(
  key: string,
  max: number,
  windowMs = 60_000,
): boolean {
  prune(Date.now(), windowMs);
  return hit(buckets, key, max, windowMs);
}

/** Count one hit against an unprunable global `key`; true if it exceeded `max`. */
export function globalRateLimited(
  key: string,
  max: number,
  windowMs = 60_000,
): boolean {
  return hit(globalBuckets, key, max, windowMs);
}

/** Best-effort client key: last X-Forwarded-For hop (the only one a trusted proxy appends). */
export function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (!fwd) return "local";
  const hops = fwd.split(",");
  return hops[hops.length - 1].trim() || "local";
}

/**
 * Apply the standard pair of limits for an endpoint: a spoof-proof global
 * cap plus a per-client courtesy cap. Returns a 429 response when limited.
 */
export function checkRateLimit(
  req: NextRequest,
  scope: string,
  limits: { perClient: number; global: number },
): Response | null {
  if (
    globalRateLimited(`${scope}:global`, limits.global) ||
    rateLimited(`${scope}:${clientKey(req)}`, limits.perClient)
  ) {
    return Response.json(
      { error: "rate limited, try again shortly" },
      { status: 429 },
    );
  }
  return null;
}
