import { PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connection } from "./solana";

/**
 * Read a wallet's attribute for a gate at snapshot time.
 * tokenBalance  -> total raw units of the target mint across token accounts
 * nftCollection -> number of NFTs held from the target collection
 */
export async function readAttribute(
  gateType: string,
  target: string,
  wallet: string,
): Promise<bigint> {
  if (gateType === "nftCollection") return countCollectionNfts(target, wallet);
  return readTokenBalance(target, wallet);
}

export async function readTokenBalance(
  mint: string,
  wallet: string,
): Promise<bigint> {
  let accounts;
  try {
    accounts = await connection().getParsedTokenAccountsByOwner(
      new PublicKey(wallet),
      {
        mint: new PublicKey(mint),
      },
    );
  } catch (e) {
    // e.g. the mint does not exist on this cluster — count as holding nothing
    console.warn(
      `readTokenBalance(${mint}, ${wallet}): ${(e as Error).message}`,
    );
    return 0n;
  }
  let total = 0n;
  for (const { account } of accounts.value) {
    total += BigInt(account.data.parsed.info.tokenAmount.amount as string);
  }
  return total;
}

interface DasAsset {
  grouping?: { group_key: string; group_value: string }[];
}

async function countCollectionNfts(
  collection: string,
  wallet: string,
): Promise<bigint> {
  const dasUrl = process.env.DAS_RPC_URL;
  if (dasUrl) return countViaDas(dasUrl, collection, wallet);
  return countViaDemoList(collection, wallet);
}

/** DAS (e.g. Helius devnet): assets by owner, filtered by collection grouping. */
async function countViaDas(
  dasUrl: string,
  collection: string,
  wallet: string,
): Promise<bigint> {
  let count = 0n;
  // A transport/RPC failure must throw, not return 0: silently counting a
  // holder as owning nothing would wrongly drop them from the snapshot.
  for (let page = 1; ; page++) {
    if (page > 1000) throw new Error("DAS pagination exceeded the safety cap");
    const res = await fetch(dasUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "private-gating",
        method: "getAssetsByOwner",
        params: { ownerAddress: wallet, page, limit: 1000 },
      }),
    });
    if (!res.ok)
      throw new Error(`DAS request failed: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as {
      result?: { items: DasAsset[]; total: number };
      error?: unknown;
    };
    if (json.error) throw new Error(`DAS error: ${JSON.stringify(json.error)}`);
    const items = json.result?.items ?? [];
    for (const asset of items) {
      if (
        asset.grouping?.some(
          (g) => g.group_key === "collection" && g.group_value === collection,
        )
      ) {
        count += 1n;
      }
    }
    if (items.length < 1000) break;
  }
  return count;
}

/**
 * Localnet fallback: the seeding script writes scripts/demo-collection.json
 * mapping a collection address to its member mints; count amount-1 holdings.
 */
async function countViaDemoList(
  collection: string,
  wallet: string,
): Promise<bigint> {
  let mints: Record<string, string[]>;
  try {
    mints = JSON.parse(
      readFileSync(
        join(process.cwd(), "..", "scripts", "demo-collection.json"),
        "utf8",
      ),
    );
  } catch {
    return 0n;
  }
  const members = new Set(mints[collection] ?? []);
  if (members.size === 0) return 0n;

  const accounts = await connection().getParsedTokenAccountsByOwner(
    new PublicKey(wallet),
    {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    },
  );
  let count = 0n;
  for (const { account } of accounts.value) {
    const info = account.data.parsed.info;
    if (members.has(info.mint as string) && info.tokenAmount.amount === "1")
      count += 1n;
  }
  return count;
}
