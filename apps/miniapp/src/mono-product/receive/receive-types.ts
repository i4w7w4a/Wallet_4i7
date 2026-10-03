import type { ProductActionRoute } from "@wallet/core";
import type { ReactNode } from "react";

export type ReceiveRoute = Extract<ProductActionRoute, { action: "receive" }>;
export type ReceiveRequest = Pick<ReceiveRoute, "accountId" | "assetId" | "networkId" | "receiveMode">;
type ReceiveTarget = Pick<ReceiveRequest, "accountId" | "assetId" | "networkId">;

/** Deliberately not an address or a payment URI. Live destinations require a new contract. */
export type DemoReceiveReference = `DEMO-NON-PAYABLE:${string}`;

export type ExternalReceiveDestination = ReceiveTarget & {
  mode: "external-address";
  safety: "demo-non-payable";
  reference: DemoReceiveReference;
};

export type ReceiveSourceAccount = {
  accountId: string;
  accountLabel: string;
  assetId: string;
  networkId: string;
  status: "available" | "inactive" | "unavailable";
};

export type InternalReceiveDestination = ReceiveTarget & {
  mode: "internal-transfer";
  sources: readonly ReceiveSourceAccount[];
};

export type ReceiveDestination = ExternalReceiveDestination | InternalReceiveDestination;
export type ReceiveUnavailableReason =
  | "account-inactive"
  | "account-unavailable"
  | "route-unavailable"
  | "destination-not-connected"
  | "sources-not-connected";

export type ReceiveLoadResult =
  | { status: "ready"; data: ReceiveDestination }
  | { status: "unavailable"; reason: ReceiveUnavailableReason }
  | { status: "error"; reason: "load-failed" | "route-mismatch" | "unsafe-destination"; retryable: boolean };

/** Read-only port: no transfer, authorization, fee quote, or address-generation command. */
export type ReceiveDataPort = {
  load(request: ReceiveRequest, options: { signal: AbortSignal }): Promise<ReceiveLoadResult>;
};

export type ReceiveQrRenderer = (payload: {
  value: DemoReceiveReference;
  testOnly: true;
  accountId: string;
  assetId: string;
  networkId: string;
}) => ReactNode;

export type ReceiveFlowProps = {
  route: ProductActionRoute;
  dataPort: ReceiveDataPort;
  /** Removes reference/QR from the DOM and disables copy/share. Context labels stay visible. */
  privacy: boolean;
  onBack: (route: ProductActionRoute) => void;
  onClose: () => void;
  renderQr?: ReceiveQrRenderer;
  /** False when the containing sheet already owns a close control. */
  showCloseButton?: boolean;
};

/** An explicit demo assumption; send capability alone never creates an internal route. */
export type DemoInternalReceiveBinding = {
  destinationAccountId: string;
  sourceAccountId: string;
  assetId: string;
  networkId: string;
};
