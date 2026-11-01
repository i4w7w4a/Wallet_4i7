"use client";

import type { RefObject } from "react";
import { useProductViewMotion } from "./product-view-motion";

/**
 * Identity belongs to the host controller. null means the card list, a stable
 * id means that card's details. The hook never holds a snapshot of the content.
 */
export function useLinkedCardMotion({ surfaceRef, contentRef, detailId, enabled }: {
  surfaceRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  detailId: string | null;
  enabled: boolean;
}) {
  useProductViewMotion({ surfaceRef, contentRef, view: { section: "assets", assetId: detailId }, enabled });
}
