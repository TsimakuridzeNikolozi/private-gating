import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import idl from "@/lib/idl/private_gating.json";
import type { PrivateGating } from "@/lib/idl/private_gating";

export const PROGRAM_ID = new PublicKey((idl as { address: string }).address);

/** Minimal Anchor wallet over a Keypair (anchor's ESM build has no NodeWallet). */
class KeypairWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
  async signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T> {
    if ("version" in tx) tx.sign([this.payer]);
    else tx.partialSign(this.payer);
    return tx;
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]> {
    return Promise.all(txs.map((tx) => this.signTransaction(tx)));
  }
}

export function rpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
}

export function connection(): Connection {
  return new Connection(rpcUrl(), "confirmed");
}

/**
 * The relayer keypair. It signs and pays for verify_and_pass / claim_prize so
 * the holder's wallet never appears on-chain. Privacy-critical: every pass
 * must go through this account, never through a holder wallet.
 */
export function relayerKeypair(): Keypair {
  const secret = process.env.RELAYER_SECRET;
  if (!secret || secret === "[]") {
    throw new Error("RELAYER_SECRET is not configured (see app/.env.example)");
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

export function relayerProgram(): Program<PrivateGating> {
  const provider = new AnchorProvider(
    connection(),
    new KeypairWallet(relayerKeypair()),
    {
      commitment: "confirmed",
    },
  );
  return new Program(idl as PrivateGating, provider);
}

// One throwaway keypair for the read-only provider (it never signs). Generated
// once at module load rather than per call to avoid needless ed25519 keygen.
const READ_ONLY_WALLET = new KeypairWallet(Keypair.generate());
let readOnly: Program<PrivateGating> | undefined;

/** Read-only program handle (no signer) for fetching accounts; cached. */
export function readOnlyProgram(): Program<PrivateGating> {
  if (!readOnly) {
    const provider = new AnchorProvider(connection(), READ_ONLY_WALLET, {
      commitment: "confirmed",
    });
    readOnly = new Program(idl as PrivateGating, provider);
  }
  return readOnly;
}

export function nullifierPda(
  gate: PublicKey,
  nullifier: Uint8Array,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("nullifier"), gate.toBuffer(), Buffer.from(nullifier)],
    PROGRAM_ID,
  )[0];
}
