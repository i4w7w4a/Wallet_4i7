"use client";

import { ActionRouteMenu, type ActionRouteMenuProps } from "./action-route-menu";

export type SendMenuProps = Omit<ActionRouteMenuProps, "action">;

export function SendMenu(props: SendMenuProps) {
  return <ActionRouteMenu {...props} action="send" />;
}
