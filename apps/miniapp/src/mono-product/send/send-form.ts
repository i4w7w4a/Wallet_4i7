import type { ProductActionRoute } from "@wallet/core";
import type { SendDemoResult, SendRecipient } from "./send-port";

export type SendDraft = {
  route: { accountId: string; assetId: string; networkId: string };
  recipient: SendRecipient;
  amount: string;
};

export type SendSimulationResult = {
  simulationId: string;
  route: ProductActionRoute;
  quantity: string;
  result: SendDemoResult;
};

export type SendFormOptions = {
  initialDraft?: SendDraft | null;
  onDraftChange?(draft: SendDraft | null): void;
  onSimulationResult?(event: SendSimulationResult): void;
};

export function formDraft(route: ProductActionRoute, recipient: SendRecipient, amount: string): SendDraft | null {
  if (!recipient.address && !recipient.memo && !amount) return null;
  return {
    route: { accountId: route.accountId, assetId: route.assetId, networkId: route.networkId },
    recipient: { address: recipient.address, ...(recipient.memo === undefined ? {} : { memo: recipient.memo }) },
    amount,
  };
}

export function matchingDraft(route: ProductActionRoute, draft: SendDraft | null | undefined): SendDraft | null {
  if (route.action !== "send" || !draft || draft.route?.accountId !== route.accountId ||
    draft.route.assetId !== route.assetId || draft.route.networkId !== route.networkId ||
    typeof draft.recipient?.address !== "string" || typeof draft.amount !== "string" ||
    (draft.recipient.memo !== undefined && typeof draft.recipient.memo !== "string")) return null;
  // Pick only form fields. Even a runtime object carrying quote/stage/result cannot restore them.
  return formDraft(route, draft.recipient, draft.amount);
}
