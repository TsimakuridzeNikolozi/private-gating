"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { toast } from "sonner";
import {
  fieldToBytes32,
  gateIdFromPubkey,
  nullifierFor,
  pubkeyToLimbs,
} from "@private-gating/shared";
import {
  clientConnection,
  explorerTxUrl,
  fetchGate,
  fetchProofInput,
  type GateInfo,
  nullifierPdaClient,
  type OnChainInfo,
  type ProofInput,
  registerCommitment,
  relay,
} from "@/lib/client/api";
import { deriveIdentity, type PrivateIdentity } from "@/lib/client/identity";
import { proveInWorker } from "@/lib/client/prover";
import { actionNoun, type Step } from "./steps";

function toNullifierHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function declineCopy(message: string, fallback: string, declined: string) {
  return /reject|cancel|denied/i.test(message) ? declined : fallback;
}

export interface GateFlow {
  gate: GateInfo | null;
  onChain: OnChainInfo | null;
  notFound: boolean;
  connected: boolean;
  address: string | null;
  hasIdentity: boolean;
  isOperatorWallet: boolean;
  proofInput: ProofInput | null;
  effectiveStep: Step;
  busy: boolean;
  error: string | null;
  txSignature: string | null;
  nullifierHex: string | null;
  isWinner: boolean;
  claimRecipient: string;
  setClaimRecipient: (value: string) => void;
  claimTx: string | null;
  claimBusy: boolean;
  connectWallet: () => void;
  handleDerive: () => void;
  handleRegister: () => void;
  handleProve: () => void;
  handleClaim: () => void;
}

export function useGateFlow(slug: string): GateFlow {
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58() ?? null;

  const [gate, setGate] = useState<GateInfo | null>(null);
  const [onChain, setOnChain] = useState<OnChainInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [identity, setIdentity] = useState<PrivateIdentity | null>(null);
  // address the in-memory identity was derived for, so we can detect a switch
  const [identityAddress, setIdentityAddress] = useState<string | null>(null);
  const [proofInput, setProofInput] = useState<ProofInput | null>(null);
  // progress within the identity flow; the pre-identity steps are derived below
  const [step, setStep] = useState<Step>("derive");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [nullifierHex, setNullifierHex] = useState<string | null>(null);

  const [isWinner, setIsWinner] = useState(false);
  const [claimRecipient, setClaimRecipient] = useState("");
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);

  const refreshGate = useCallback(
    () =>
      fetchGate(slug).then(
        ({ gate, onChain }) => {
          setGate(gate);
          setOnChain(onChain);
        },
        () => setNotFound(true),
      ),
    [slug],
  );

  useEffect(() => {
    void refreshGate();
  }, [refreshGate]);

  const evaluate = useCallback(
    async (id: PrivateIdentity) => {
      if (!gate) return;
      setError(null);
      const input = await fetchProofInput(slug, id.commitment);
      setProofInput(input);

      if (input.status === "not-registered") return setStep("register");
      if (input.status === "no-snapshot") return setStep("waiting-snapshot");
      if (input.status === "pending-next-snapshot")
        return setStep("pending-next-snapshot");

      const gateKey = new PublicKey(gate.address);
      const gateId = await gateIdFromPubkey(gateKey.toBytes());
      const nullifier = await nullifierFor(id.secret, gateId);
      const nullifierBytes = fieldToBytes32(nullifier);
      const hex = toNullifierHex(nullifierBytes);
      setNullifierHex(hex);

      const existing = await clientConnection().getAccountInfo(
        nullifierPdaClient(gateKey, nullifierBytes),
      );
      if (existing) {
        setStep("already-passed");
        if (onChain?.winningNullifier)
          setIsWinner(onChain.winningNullifier === hex);
        return;
      }

      if (BigInt(input.attribute) < BigInt(gate.threshold))
        return setStep("short");
      setStep("ready");
    },
    [gate, onChain, slug],
  );

  if (identity && identityAddress !== address) {
    setIdentity(null);
    setIdentityAddress(null);
    setProofInput(null);
    setNullifierHex(null);
    setIsWinner(false);
    setStep("derive");
  }

  const effectiveStep: Step = !connected
    ? "connect"
    : !identity
      ? "derive"
      : step;

  const connectedAsOperator = () =>
    !!gate && !!publicKey && gate.operator === publicKey.toBase58();

  const handleDerive = async () => {
    if (connectedAsOperator())
      return setError("Operators can't register or prove in their own gate.");
    if (!signMessage) return setError("This wallet cannot sign messages.");
    setBusy(true);
    setError(null);
    try {
      const id = await deriveIdentity(signMessage);
      setIdentity(id);
      setIdentityAddress(address);
      await evaluate(id);
    } catch (e) {
      const message = (e as Error).message ?? "";
      setError(
        declineCopy(
          message,
          `Could not derive identity: ${message}`,
          "Signature request was declined — nothing happened. Sign when you're ready.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    if (connectedAsOperator())
      return setError("Operators can't register or prove in their own gate.");
    if (!identity || !publicKey || !signMessage) return;
    setBusy(true);
    setError(null);
    try {
      await registerCommitment(
        slug,
        publicKey.toBase58(),
        identity.commitment,
        signMessage,
      );
      toast.success("Registered for this gate", {
        description:
          "Your commitment is in. The next snapshot will include you.",
      });
      await refreshGate();
      await evaluate(identity);
    } catch (e) {
      const message = (e as Error).message ?? "";
      setError(
        declineCopy(
          message,
          message,
          "Signature request was declined — nothing was registered. Sign when you're ready.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleProve = async () => {
    if (connectedAsOperator() || busy) return;
    if (!identity || !gate || !proofInput || proofInput.status !== "included")
      return;
    setBusy(true);
    setError(null);
    setStep("proving");
    const { done } = actionNoun(gate);
    try {
      const gateKey = new PublicKey(gate.address);
      const gateId = await gateIdFromPubkey(gateKey.toBytes());
      const result = await proveInWorker("gate", {
        merkleRoot: proofInput.root,
        threshold: gate.threshold,
        gateId: gateId.toString(),
        secret: identity.secret.toString(),
        attribute: proofInput.attribute,
        pathElements: proofInput.pathElements,
        pathIndices: proofInput.pathIndices,
      });
      setStep("relaying");
      const signature = await relay(slug, {
        kind: "pass",
        proof: result.proofBytes,
        publicSignals: result.publicSignals,
      });
      setTxSignature(signature);
      setStep("passed");
      toast.success(done, {
        description:
          "Submitted by the relayer — your wallet appears nowhere on-chain.",
        action: {
          label: "View",
          onClick: () =>
            window.open(
              explorerTxUrl(signature),
              "_blank",
              "noopener,noreferrer",
            ),
        },
      });
      await refreshGate();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setStep("ready");
      toast.error("Couldn't complete the pass", { description: message });
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async () => {
    if (connectedAsOperator()) return;
    if (!identity || !gate) return;
    setClaimBusy(true);
    setError(null);
    try {
      const recipient = new PublicKey(claimRecipient.trim());
      const gateKey = new PublicKey(gate.address);
      const gateId = await gateIdFromPubkey(gateKey.toBytes());
      const nullifier = await nullifierFor(identity.secret, gateId);
      const { hi, lo } = pubkeyToLimbs(recipient.toBytes());
      const result = await proveInWorker("claim", {
        nullifier: nullifier.toString(),
        gateId: gateId.toString(),
        recipientHi: hi.toString(),
        recipientLo: lo.toString(),
        secret: identity.secret.toString(),
      });
      const signature = await relay(slug, {
        kind: "claim",
        proof: result.proofBytes,
        publicSignals: result.publicSignals,
        recipient: recipient.toBase58(),
      });
      setClaimTx(signature);
      toast.success("Prize claimed", {
        description: "Paid out to your chosen address by the relayer.",
        action: {
          label: "View",
          onClick: () =>
            window.open(
              explorerTxUrl(signature),
              "_blank",
              "noopener,noreferrer",
            ),
        },
      });
      await refreshGate();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      toast.error("Couldn't claim the prize", { description: message });
    } finally {
      setClaimBusy(false);
    }
  };

  const isOperatorWallet =
    connected &&
    !!publicKey &&
    !!gate &&
    gate.operator === publicKey.toBase58();

  return {
    gate,
    onChain,
    notFound,
    connected,
    address,
    hasIdentity: !!identity,
    isOperatorWallet,
    proofInput,
    effectiveStep,
    busy,
    error,
    txSignature,
    nullifierHex,
    isWinner,
    claimRecipient,
    setClaimRecipient,
    claimTx,
    claimBusy,
    connectWallet: () => setVisible(true),
    handleDerive,
    handleRegister,
    handleProve,
    handleClaim,
  };
}
