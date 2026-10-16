import { resolveActionRoutes, type ProductSnapshot } from "@wallet/core";
import type { DemoInternalReceiveBinding, ReceiveDataPort } from "./receive-types";

/** Synthetic references only. Bindings are explicit UI fixtures, never backend permissions. */
export function createDemoReceiveDataPort(
  snapshot: Pick<ProductSnapshot, "accounts">,
  bindings: readonly DemoInternalReceiveBinding[] = [],
): ReceiveDataPort {
  return {
    async load(request, { signal }) {
      signal.throwIfAborted();
      const resolution = resolveActionRoutes(snapshot, { kind: "account", accountId: request.accountId }, "receive");
      if (resolution.reason === "account-inactive") return { status: "unavailable", reason: "account-inactive" };
      if (resolution.reason === "account-not-found" || resolution.reason === "account-unavailable") {
        return { status: "unavailable", reason: "account-unavailable" };
      }
      const route = resolution.routes.find(candidate => candidate.action === "receive" &&
        candidate.receiveMode === request.receiveMode && candidate.assetId === request.assetId &&
        candidate.networkId === request.networkId);
      if (!route) return { status: "unavailable", reason: "route-unavailable" };
      const target = { accountId: request.accountId, assetId: request.assetId, networkId: request.networkId };
      if (request.receiveMode === "external-address") {
        return { status: "ready", data: { ...target, mode: "external-address", safety: "demo-non-payable",
          reference: `DEMO-NON-PAYABLE:${[target.accountId, target.assetId, target.networkId].map(encodeURIComponent).join("/")}` } };
      }
      const sourceIds = [...new Set(bindings.filter(binding => binding.destinationAccountId === request.accountId &&
        binding.assetId === request.assetId && binding.networkId === request.networkId &&
        binding.sourceAccountId !== request.accountId).map(binding => binding.sourceAccountId))];
      if (!sourceIds.length) return { status: "unavailable", reason: "sources-not-connected" };
      return { status: "ready", data: { ...target, mode: "internal-transfer", sources: sourceIds.map(accountId => {
        const account = snapshot.accounts.find(candidate => candidate.id === accountId);
        const canSend = account?.status === "active" && account.capabilities.some(capability =>
          capability.action === "send" && capability.assetId === request.assetId && capability.networkId === request.networkId);
        return { accountId, accountLabel: account?.label ?? "Недоступный счёт", assetId: request.assetId,
          networkId: request.networkId, status: canSend ? "available" : account?.status === "inactive" ? "inactive" : "unavailable" };
      }) } };
    },
  };
}
