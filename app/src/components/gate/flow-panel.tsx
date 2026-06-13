"use client";

import {
  formatThreshold,
  type GateInfo,
  type ProofInput,
} from "@/lib/client/api";
import { Notice } from "@/components/notice";
import { Action, Progress } from "./ui-bits";
import type { Step } from "./steps";

export function FlowPanel({
  step,
  gate,
  proofInput,
  busy,
  verb,
  onConnect,
  onDerive,
  onRegister,
  onProve,
}: {
  step: Step;
  gate: GateInfo;
  proofInput: ProofInput | null;
  busy: boolean;
  verb: string;
  onConnect: () => void;
  onDerive: () => void;
  onRegister: () => void;
  onProve: () => void;
}) {
  return (
    <>
      {step === "connect" && (
        <Action
          title="Connect your wallet"
          text="Connecting reveals nothing to the gate — your wallet is only used locally to derive a private identity. It never signs or pays for anything on-chain."
          button="Connect wallet"
          onClick={onConnect}
        />
      )}

      {step === "derive" && (
        <Action
          title="Create your private identity for this gate"
          text="Sign a fixed message to derive a private identity. This is separate from connecting — the signature never leaves this device, and re-signing later always recovers the same identity, so there's nothing to back up."
          button={busy ? "Waiting for signature…" : "Sign in privately"}
          busy={busy}
          disabled={busy}
          onClick={onDerive}
        />
      )}

      {step === "register" && (
        <Action
          title="Register for this gate"
          text="Register your one-way commitment so the next snapshot can include you. The commitment reveals nothing about you or your holdings."
          button={busy ? "Registering…" : "Register for this gate"}
          busy={busy}
          disabled={busy}
          onClick={onRegister}
        />
      )}

      {step === "waiting-snapshot" && (
        <Notice variant="info" title="You're registered">
          The operator hasn&apos;t taken a snapshot yet. You&apos;ll be included
          in the next one — check back after the operator publishes it.
        </Notice>
      )}

      {step === "pending-next-snapshot" && (
        <Notice
          variant="info"
          title="You're in — just waiting on the next snapshot"
        >
          The latest snapshot was taken before you registered, purely a matter
          of timing. You&apos;ll be included in the next snapshot. Ask the
          operator to re-snapshot, or check back shortly.
        </Notice>
      )}

      {step === "short" && proofInput?.status === "included" && (
        <Notice variant="warning" title="Not quite there yet">
          The snapshot recorded your holding at{" "}
          <strong>
            {formatThreshold(proofInput.attribute, gate.decimals)}
          </strong>
          , and this gate requires{" "}
          <strong>{formatThreshold(gate.threshold, gate.decimals)}</strong>.
          Nothing was sent anywhere — this check happened on your device. Top up
          before the next snapshot to qualify.
        </Notice>
      )}

      {step === "ready" && (
        <Action
          title="You qualify"
          text="Generate the proof on your device — only the finished proof is submitted, by a relayer, so your wallet never appears on-chain."
          button={`Generate proof & ${verb.toLowerCase()}`}
          accent
          disabled={busy}
          onClick={onProve}
        />
      )}

      {step === "proving" && (
        <Progress
          label="Generating zero-knowledge proof on your device…"
          sub="This runs in a Web Worker; nothing leaves your device until it's done."
        />
      )}
      {step === "relaying" && (
        <Progress
          label="Submitting through the relayer…"
          sub="The relayer signs and pays — your wallet stays out of it."
        />
      )}
    </>
  );
}
