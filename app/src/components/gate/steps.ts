import { formatThreshold, type GateInfo } from "@/lib/client/api";

/** Where the holder stands in the gate flow. */
export type Step =
  | "connect"
  | "derive"
  | "register"
  | "waiting-snapshot"
  | "pending-next-snapshot"
  | "short"
  | "ready"
  | "proving"
  | "relaying"
  | "passed"
  | "already-passed";

export const FLOW_STEPS = [
  "Connect",
  "Sign in",
  "Register",
  "Snapshot",
  "Prove & pass",
];

export function stepIndex(step: Step): number {
  switch (step) {
    case "connect":
      return 0;
    case "derive":
      return 1;
    case "register":
      return 2;
    case "waiting-snapshot":
    case "pending-next-snapshot":
      return 3;
    case "short":
    case "ready":
    case "proving":
    case "relaying":
      return 4;
    case "passed":
    case "already-passed":
      return FLOW_STEPS.length;
  }
}

export function requirementText(gate: GateInfo): string {
  const threshold = formatThreshold(gate.threshold, gate.decimals);
  if (gate.gateType === "nftCollection") {
    return `Hold at least ${threshold} NFT${gate.threshold === "1" ? "" : "s"} from the collection`;
  }
  return `Hold at least ${threshold} of the token`;
}

export function actionNoun(gate: GateInfo): { verb: string; done: string } {
  return gate.gateType === "sybilAction"
    ? { verb: "Enter", done: "Entry confirmed" }
    : { verb: "Unlock access", done: "Access granted" };
}
