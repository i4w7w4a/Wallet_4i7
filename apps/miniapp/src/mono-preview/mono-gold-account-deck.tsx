"use client";

import type { MonoProductCommands, MonoProductView } from "../mono-product/product-controller";
import { ProductBalance } from "../mono-product/product-home";
import type { MonoBalanceAppearance } from "./mono-scene-lab-contract";

type Props = {
  view: MonoProductView;
  commands: MonoProductCommands;
  appearance: MonoBalanceAppearance;
  blinkEnabled: boolean;
};

/** Gold's single wallet estimate. The host supplies ALL without changing the working account. */
export function MonoGoldAccountDeck({ view, commands, appearance, blinkEnabled }: Props) {
  return <section className="mono-gold-account-deck" data-product-gold-account-deck>
    <div className="mono-gold-account-deck__balance">
      <ProductBalance view={view} commands={commands} appearance={appearance} blinkEnabled={blinkEnabled} compact />
    </div>
  </section>;
}
