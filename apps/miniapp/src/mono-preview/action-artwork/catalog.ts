import type { ButtonTargetId } from "@wallet/ui";
import type { MonoActionArtworkV1 } from "./model";

export type OwnerArtworkPack = Exclude<MonoActionArtworkV1["packId"], "original">;
export type ArtworkMotion = "send" | "receive" | "swap" | "buy";
export type ActionArtworkAsset = Readonly<{
  id: string;
  src: string;
  cssSize: number;
  motion: ArtworkMotion;
}>;

const root = "/action-icons/novex-owner-v1";

const catalog: Readonly<Record<OwnerArtworkPack, Readonly<Record<ButtonTargetId, ActionArtworkAsset>>>> = {
  "volume-v1": {
    "quick.send": { id: "novex-owner-v1.volume-v1.quick.send", src: `${root}/volume-v1/send.png`, cssSize: 70, motion: "send" },
    "quick.receive": { id: "novex-owner-v1.volume-v1.quick.receive", src: `${root}/volume-v1/receive.png`, cssSize: 66, motion: "receive" },
    "quick.swap": { id: "novex-owner-v1.volume-v1.quick.swap", src: `${root}/volume-v1/swap.png`, cssSize: 66, motion: "swap" },
    "quick.buy": { id: "novex-owner-v1.volume-v1.quick.buy", src: `${root}/volume-v1/buy.png`, cssSize: 68, motion: "buy" },
  },
  "contour-v1": {
    "quick.send": { id: "novex-owner-v1.contour-v1.quick.send", src: `${root}/contour-v1/send.png`, cssSize: 76, motion: "send" },
    "quick.receive": { id: "novex-owner-v1.contour-v1.quick.receive", src: `${root}/contour-v1/receive.png`, cssSize: 74, motion: "receive" },
    "quick.swap": { id: "novex-owner-v1.contour-v1.quick.swap", src: `${root}/contour-v1/swap.png`, cssSize: 68, motion: "swap" },
    "quick.buy": { id: "novex-owner-v1.contour-v1.quick.buy", src: `${root}/contour-v1/buy.png`, cssSize: 72, motion: "buy" },
  },
};

export function getActionArtworkAsset(packId: MonoActionArtworkV1["packId"], actionId: ButtonTargetId): ActionArtworkAsset | null {
  return packId === "original" ? null : catalog[packId][actionId];
}
