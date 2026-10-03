"use client";

import { ActionRouteMenu, type ActionRouteMenuProps } from "./action-route-menu";

export type ReceiveMenuProps = Omit<ActionRouteMenuProps, "action">;

export function ReceiveMenu(props: ReceiveMenuProps) {
  return <ActionRouteMenu {...props} action="receive" />;
}
