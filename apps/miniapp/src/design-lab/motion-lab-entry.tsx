"use client";

import { useEffect, useState } from "react";
import type { WalletSnapshot } from "@wallet/core";
import type { ApplyLaunch } from "./control-feedback-handoff";
import { DesignLab } from "./design-lab";
import { parseMotionLabSearch } from "./motion-lab-launch";

/** Keep the route static; validate the session in the browser before enabling the existing Apply protocol. */
export function MotionLabEntry({ snapshot }: { snapshot: WalletSnapshot }) {
  const [launch, setLaunch] = useState<ApplyLaunch | null>(null);
  useEffect(() => { setLaunch(parseMotionLabSearch(window.location.search)); }, []);
  return <DesignLab launch={launch} walletSnapshot={snapshot} />;
}
